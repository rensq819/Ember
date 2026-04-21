#!/usr/bin/env node
/**
 * LoseIt local proxy for Ember
 * Run: node scripts/loseit-proxy.js
 *
 * Proxies LoseIt API calls from the browser, managing session cookies server-side
 * (required because LoseIt's GWT-RPC endpoint has CORS restrictions).
 *
 * Session + credentials are cached at ~/.ember-loseit/session.json so the proxy
 * can re-authenticate automatically after session expiry.
 */

import { createServer } from "node:http";
import { request as httpsRequest } from "node:https";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const PORT = 4242;
const SESSION_PATH = join(homedir(), ".ember-loseit", "session.json");

const GWT_MODULE_BASE = "https://d3hsih69yn4d89.cloudfront.net/web/";
const GWT_POLICY_HASH = "2755A092A086CADF822A722370D298F9";
const GWT_PERMUTATION = "79FCB90B69F5FF2C7877662E5529652C";
const GWT_SERVICE_CLASS = "com.loseit.core.client.service.LoseItRemoteService";

/** @type {{ cookies: Record<string,string>, userId: number|null, username: string|null, timezone: string, email: string, password: string }} */
let session = {
  cookies: {},
  userId: null,
  username: null,
  timezone: "America/Chicago",
  email: "",
  password: "",
};

// ── Session persistence ───────────────────────────────────────────────────────

async function loadSession() {
  try {
    const raw = await readFile(SESSION_PATH, "utf-8");
    session = { ...session, ...JSON.parse(raw) };
    console.log(
      session.userId
        ? `Session loaded for ${session.username} (user ${session.userId})`
        : "No prior session found"
    );
  } catch {
    // no saved session — first run
  }
}

async function saveSession() {
  await mkdir(dirname(SESSION_PATH), { recursive: true });
  await writeFile(SESSION_PATH, JSON.stringify(session), { mode: 0o600 });
}

// ── HTTPS helper ──────────────────────────────────────────────────────────────

function httpsPost(urlStr, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const buf = Buffer.from(body);
    const req = httpsRequest(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: "POST",
        headers: { ...headers, "Content-Length": buf.length },
        timeout: 15000,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf-8"),
          })
        );
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("HTTPS request timed out"));
    });
    req.write(buf);
    req.end();
  });
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function login(email, password, timezone) {
  const body = new URLSearchParams({
    username: email,
    password,
    grant_type: "password",
  }).toString();

  const res = await httpsPost(
    "https://api.loseit.com/account/login",
    {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body
  );

  if (res.status !== 200) {
    throw new Error(
      `LoseIt login failed (${res.status}): ${res.body.slice(0, 200)}`
    );
  }

  const setCookies = [].concat(res.headers["set-cookie"] ?? []);
  const cookies = {};
  for (const h of setCookies) {
    const m = h.match(/^([^=]+)=([^;]*)/);
    if (m) cookies[m[1]] = m[2];
  }

  const data = JSON.parse(res.body);
  const prefix = String(data.username ?? email).split("@")[0] ?? "User";
  const username = prefix.charAt(0).toUpperCase() + prefix.slice(1);

  session = {
    cookies,
    userId: data.user_id,
    username,
    timezone: timezone ?? session.timezone,
    email,
    password,
  };

  await saveSession();
  console.log(`Authenticated as ${email} → ${username} (user ${data.user_id})`);
}

// ── GWT-RPC ───────────────────────────────────────────────────────────────────

function getTimezoneOffset(tz) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "shortOffset",
  }).formatToParts(new Date());
  const m = parts
    .find((p) => p.type === "timeZoneName")
    ?.value?.match(/GMT([+-]?\d+)/);
  return m ? parseInt(m[1], 10) : -5;
}

function buildGwtBody(method, offset) {
  return (
    [
      "7",
      "0",
      "7",
      GWT_MODULE_BASE,
      GWT_POLICY_HASH,
      GWT_SERVICE_CLASS,
      method,
      "com.loseit.core.client.service.ServiceRequestToken/1076571655",
      "com.loseit.core.client.model.UserId/4281239478",
      session.username,
      "1",
      "2",
      "3",
      "4",
      "1",
      "5",
      "5",
      "0",
      "6",
      String(session.userId),
      "7",
      String(offset),
    ].join("|") + "|"
  );
}

async function gwtRpc(method, retried = false) {
  if (!session.userId) throw new Error("Not authenticated");

  const offset = getTimezoneOffset(session.timezone);
  const cookie = Object.entries(session.cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");

  const res = await httpsPost(
    "https://www.loseit.com/web/service",
    {
      "Content-Type": "text/x-gwt-rpc; charset=utf-8",
      "X-GWT-Module-Base": GWT_MODULE_BASE,
      "X-GWT-Permutation": GWT_PERMUTATION,
      "x-Loseit-GWTVersion": "devmode",
      "x-Loseit-HoursFromGMT": String(offset),
      Cookie: cookie,
    },
    buildGwtBody(method, offset)
  );

  if (res.status === 401 && !retried && session.email) {
    await login(session.email, session.password, session.timezone);
    return gwtRpc(method, true);
  }

  if (res.status >= 400) {
    throw new Error(`GWT ${method} failed (HTTP ${res.status})`);
  }

  return parseGwtResponse(res.body);
}

// ── GWT Parser ────────────────────────────────────────────────────────────────

function parseGwtResponse(raw) {
  const t = raw.trim();
  if (t.startsWith("//EX"))
    throw new Error(`GWT exception: ${t.slice(0, 200)}`);
  if (!t.startsWith("//OK"))
    throw new Error(`Unexpected GWT prefix: ${t.slice(0, 20)}`);

  const parsed = JSON.parse(t.slice(4));
  if (!Array.isArray(parsed) || parsed.length < 3)
    throw new Error("GWT response malformed");

  const stringTable = parsed[parsed.length - 3];
  if (!Array.isArray(stringTable))
    throw new Error("GWT string table missing");

  return { stringTable, values: parsed.slice(0, parsed.length - 3) };
}

// ── Extractors (ported from atfinke/loseit-mcp) ───────────────────────────────

const DAY_EPOCH_MS = Date.UTC(2000, 11, 31); // Dec 31 2000
const MS_PER_DAY = 86_400_000;

function dateToDayNumber(date) {
  return Math.round(
    (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) -
      DAY_EPOCH_MS) /
      MS_PER_DAY
  );
}

function dayToDateStr(n) {
  const d = new Date(DAY_EPOCH_MS + n * MS_PER_DAY);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

const isDayNum = (n) => typeof n === "number" && n >= 7000 && n <= 11000;

function findRef(st, prefix) {
  const i = st.findIndex((s) => s.startsWith(prefix));
  return i >= 0 ? i + 1 : -1;
}

function extractFoodLog(gwt, targetDay) {
  const { values: v, stringTable: st } = gwt;
  const fiRef = findRef(st, "com.loseit.core.client.model.FoodIdentifier/");
  const fleRef = findRef(st, "com.loseit.core.client.model.FoodLogEntry/");

  if (fiRef === -1 || fleRef === -1) {
    return { date: dayToDateStr(targetDay), entries: [] };
  }

  const classRe = /^(com\.|java\.|org\.|net\.|\[)/;
  const skip = new Set([
    "Default",
    st[3] ?? "",
    "",
    "fatgrams",
    "fatgms",
    "protgrams",
    "protgms",
    "carbgrams",
    "carbgms",
    "fiber",
    "sod",
    "steps",
    "excal",
    "exmin",
    "aplmove",
    "aplexer",
    "aplstand",
    "Fat",
    "Protein",
    "Carbohydrates",
    "Fiber",
    "Sodium",
    "Steps",
    "Apple Activity Move Goal",
    "Apple Activity Exercise Goal",
    "Apple Activity Stand Goal",
  ]);

  const isFoodName = (r) =>
    r >= 1 &&
    r <= st.length &&
    st[r - 1]?.length > 0 &&
    !classRe.test(st[r - 1]) &&
    !skip.has(st[r - 1]);

  const positions = [];
  for (let i = 5; i < v.length - 1; i++) {
    if (v[i] !== fiRef || v[i + 1] !== fleRef) continue;
    if (typeof v[i - 1] !== "number" || v[i - 1] > 0) continue;

    let name = "",
      brand = "";
    if (v[i - 3] === 0) {
      const nR = v[i - 4],
        bR = v[i - 5];
      if (typeof nR === "number" && isFoodName(nR)) name = st[nR - 1];
      if (typeof bR === "number" && isFoodName(bR)) brand = st[bR - 1];
    }
    if (!name) {
      const catR = v[i - 2];
      if (typeof catR === "number" && isFoodName(catR)) name = st[catR - 1];
    }
    if (name) positions.push({ name, brand, pos: i });
  }

  const dayPos = [];
  for (let i = 0; i < v.length; i++) if (v[i] === targetDay) dayPos.push(i);

  const entries = [];
  const seen = new Set();
  for (const f of positions) {
    if (!dayPos.some((p) => Math.abs(p - f.pos) < 300)) continue;
    const k = `${f.name}|${f.brand}`;
    if (seen.has(k)) continue;
    seen.add(k);
    entries.push({ name: f.name, brand: f.brand || null });
  }

  return { date: dayToDateStr(targetDay), entries };
}

function extractDailySummary(gwt, targetDay) {
  const { values: v } = gwt;
  const entries = [];
  const seen = new Set();

  for (let i = 1; i < v.length - 16; i++) {
    if (!isDayNum(v[i])) continue;
    const tz = v[i - 1];
    if (typeof tz !== "number" || tz < -12 || tz > 14) continue;
    // Removed strict `typeof v[i+1] !== "string"` check — field may be an integer
    // string-table reference in some LoseIt versions rather than an inline string.
    if (v[i + 16] !== v[i]) continue;

    const d = v[i];
    if (seen.has(d)) continue;
    seen.add(d);

    const tdee = v[i + 6];
    const budget = v[i + 9];
    const eaten = v[i + 11];
    const exercise = v[i + 13];
    if (typeof tdee !== "number" || typeof eaten !== "number") continue;

    entries.push({
      date: dayToDateStr(d),
      dayNumber: d,
      caloriesBudget: Math.round(typeof budget === "number" ? budget : tdee),
      caloriesEaten: Math.round(eaten),
      caloriesRemaining: Math.round((typeof budget === "number" ? budget : tdee) - eaten),
      exerciseCalories: Math.round(
        typeof exercise === "number" ? exercise : 0
      ),
    });
  }

  entries.sort((a, b) => a.dayNumber - b.dayNumber);
  return (
    entries.find((e) => e.dayNumber === targetDay) ?? entries.at(-1) ?? null
  );
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function respond(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json", ...CORS });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function parseDate(s) {
  if (!s) {
    const n = new Date();
    return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
  }
  return new Date(s + "T00:00:00Z");
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  console.log(`→ ${req.method} ${url.pathname}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  try {
    // Health check
    if (req.method === "GET" && url.pathname === "/health") {
      return respond(res, 200, {
        ok: true,
        authenticated: !!session.userId,
        username: session.username,
      });
    }

    // Authenticate
    if (req.method === "POST" && url.pathname === "/auth") {
      const { email, password, timezone } = JSON.parse(await readBody(req));
      if (!email || !password) {
        return respond(res, 400, { error: "email and password required" });
      }
      await login(email, password, timezone);
      return respond(res, 200, { ok: true, username: session.username });
    }

    // All other endpoints require auth
    if (!session.userId) {
      return respond(res, 401, {
        error: "Not authenticated — connect via Ember Settings",
      });
    }

    // Food log for a date
    if (req.method === "GET" && url.pathname === "/food-log") {
      const date = parseDate(url.searchParams.get("date"));
      const dayNum = dateToDayNumber(date);
      const gwt = await gwtRpc("getInitializationData");
      return respond(res, 200, extractFoodLog(gwt, dayNum));
    }

    // Daily calorie summary
    if (req.method === "GET" && url.pathname === "/daily-summary") {
      const date = parseDate(url.searchParams.get("date"));
      const dayNum = dateToDayNumber(date);
      const gwt = await gwtRpc("getGoalsData");
      const result = extractDailySummary(gwt, dayNum);
      if (!result) {
        return respond(res, 404, { error: "No data for this date" });
      }
      return respond(res, 200, result);
    }

    respond(res, 404, { error: "Not found" });
  } catch (err) {
    console.error("[proxy error]", err?.message ?? err);
    respond(res, 500, { error: err?.message ?? "Internal proxy error" });
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`\nLoseIt proxy → http://127.0.0.1:${PORT}`);
  console.log(
    "  Endpoints: GET /health  POST /auth  GET /food-log  GET /daily-summary\n"
  );
});

await loadSession();
