const GWT_MODULE_BASE = "https://d3hsih69yn4d89.cloudfront.net/web/";
const GWT_POLICY_HASH = "2755A092A086CADF822A722370D298F9";
const GWT_PERMUTATION = "79FCB90B69F5FF2C7877662E5529652C";
const GWT_SERVICE_CLASS = "com.loseit.core.client.service.LoseItRemoteService";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-LoseIt-Email, X-LoseIt-Password, X-LoseIt-Session",
};

export function setcors(res) {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
}

export function getCredentials(req) {
  const email = req.headers["x-loseit-email"];
  const password = req.headers["x-loseit-password"];
  if (!email || !password) throw new Error("Missing credentials — connect LoseIt in Settings.");
  return { email, password };
}

// Decode a cached LoseIt session from the X-LoseIt-Session header.
export function resolveSession(req) {
  const header = req.headers["x-loseit-session"];
  if (!header) return null;
  try {
    const data = JSON.parse(Buffer.from(header, "base64").toString("utf-8"));
    if (data.cookies && data.userId && data.username) return data;
  } catch {}
  return null;
}

// Use a cached session if the client sent one, otherwise do a fresh login.
export async function getOrCreateSession(req) {
  const cached = resolveSession(req);
  if (cached) return cached;
  const { email, password } = getCredentials(req);
  return loginToLoseIt(email, password);
}

export async function loginToLoseIt(email, password) {
  const body = new URLSearchParams({ username: email, password, grant_type: "password" });
  const res = await fetch("https://api.loseit.com/account/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: body.toString(),
  });

  if (res.status === 429) {
    throw new Error("LoseIt is rate-limiting sign-ins. Wait a minute and try again.");
  }
  if (!res.ok) {
    throw new Error(`LoseIt login failed (${res.status}).`);
  }

  const data = await res.json();
  const setCookies = typeof res.headers.getSetCookie === "function"
    ? res.headers.getSetCookie()
    : (res.headers.get("set-cookie") ?? "").split(/,(?=[^ ])/).filter(Boolean);

  const cookies = {};
  for (const h of setCookies) {
    const m = h.match(/^([^=]+)=([^;]*)/);
    if (m) cookies[m[1]] = m[2];
  }

  const prefix = String(data.username ?? email).split("@")[0] ?? "User";
  const username = prefix.charAt(0).toUpperCase() + prefix.slice(1);
  const accessToken = data.access_token ?? data.token ?? null;
  console.log(`[loseit] login ok userId=${data.user_id} hasAccessToken=${!!accessToken}`);
  return { cookies, userId: data.user_id, username, accessToken };
}

function getTimezoneOffset(tz) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, timeZoneName: "shortOffset",
  }).formatToParts(new Date());
  const m = parts.find(p => p.type === "timeZoneName")?.value?.match(/GMT([+-]?\d+)/);
  return m ? parseInt(m[1], 10) : -5;
}

export async function gwtRpc(method, session, timezone) {
  const { cookies, userId, username } = session;
  const tz = timezone || "America/Chicago";
  const offset = getTimezoneOffset(tz);
  const cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");

  const body = [
    "7", "0", "7",
    GWT_MODULE_BASE, GWT_POLICY_HASH, GWT_SERVICE_CLASS, method,
    "com.loseit.core.client.service.ServiceRequestToken/1076571655",
    "com.loseit.core.client.model.UserId/4281239478",
    username,
    "1", "2", "3", "4", "1", "5", "5", "0", "6",
    String(userId), "7", String(offset),
  ].join("|") + "|";

  const res = await fetch("https://www.loseit.com/web/service", {
    method: "POST",
    headers: {
      "Content-Type": "text/x-gwt-rpc; charset=utf-8",
      "X-GWT-Module-Base": GWT_MODULE_BASE,
      "X-GWT-Permutation": GWT_PERMUTATION,
      "x-Loseit-GWTVersion": "devmode",
      "x-Loseit-HoursFromGMT": String(offset),
      Cookie: cookie,
    },
    body,
  });

  if (!res.ok) throw new Error(`GWT ${method} failed (HTTP ${res.status})`);
  return parseGwtResponse(await res.text());
}

function parseGwtResponse(raw) {
  const t = raw.trim();
  if (t.startsWith("//EX")) throw new Error(`GWT exception: ${t.slice(0, 200)}`);
  if (!t.startsWith("//OK")) throw new Error(`Unexpected GWT prefix: ${t.slice(0, 20)}`);
  const parsed = JSON.parse(t.slice(4));
  if (!Array.isArray(parsed) || parsed.length < 3) throw new Error("GWT response malformed");
  const stringTable = parsed[parsed.length - 3];
  if (!Array.isArray(stringTable)) throw new Error("GWT string table missing");
  return { stringTable, values: parsed.slice(0, parsed.length - 3) };
}

const DAY_EPOCH_MS = Date.UTC(2000, 11, 31);
const MS_PER_DAY = 86_400_000;

export function dateToDayNumber(date) {
  return Math.round(
    (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - DAY_EPOCH_MS) / MS_PER_DAY
  );
}

export function dayToDateStr(n) {
  const d = new Date(DAY_EPOCH_MS + n * MS_PER_DAY);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

const isDayNum = (n) => typeof n === "number" && n >= 7000 && n <= 11000;

function findRef(st, prefix) {
  const i = st.findIndex(s => s.startsWith(prefix));
  return i >= 0 ? i + 1 : -1;
}

export function extractFoodLog(gwt, targetDay) {
  const { values: v, stringTable: st } = gwt;
  const fiRef = findRef(st, "com.loseit.core.client.model.FoodIdentifier/");
  const fleRef = findRef(st, "com.loseit.core.client.model.FoodLogEntry/");
  if (fiRef === -1 || fleRef === -1) return { date: dayToDateStr(targetDay), entries: [] };

  const classRe = /^(com\.|java\.|org\.|net\.|\[)/;
  const skip = new Set([
    "Default", st[3] ?? "", "", "fatgrams", "fatgms", "protgrams", "protgms",
    "carbgrams", "carbgms", "fiber", "sod", "steps", "excal", "exmin",
    "aplmove", "aplexer", "aplstand", "Fat", "Protein", "Carbohydrates",
    "Fiber", "Sodium", "Steps", "Apple Activity Move Goal",
    "Apple Activity Exercise Goal", "Apple Activity Stand Goal",
  ]);
  const isFoodName = (r) =>
    r >= 1 && r <= st.length && st[r - 1]?.length > 0 &&
    !classRe.test(st[r - 1]) && !skip.has(st[r - 1]);

  const positions = [];
  for (let i = 5; i < v.length - 1; i++) {
    if (v[i] !== fiRef || v[i + 1] !== fleRef) continue;
    if (typeof v[i - 1] !== "number" || v[i - 1] > 0) continue;
    let name = "", brand = "";
    if (v[i - 3] === 0) {
      const nR = v[i - 4], bR = v[i - 5];
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

  const entries = [], seen = new Set();
  for (const f of positions) {
    if (!dayPos.some(p => Math.abs(p - f.pos) < 300)) continue;
    const k = `${f.name}|${f.brand}`;
    if (seen.has(k)) continue;
    seen.add(k);
    entries.push({ name: f.name, brand: f.brand || null });
  }
  return { date: dayToDateStr(targetDay), entries };
}

function parseDailySummaries(gwt) {
  const { values: v } = gwt;
  const entries = [], seen = new Set();
  for (let i = 1; i < v.length - 16; i++) {
    if (!isDayNum(v[i])) continue;
    const tz = v[i - 1];
    if (typeof tz !== "number" || tz < -12 || tz > 14) continue;
    if (v[i + 16] !== v[i]) continue;
    const d = v[i];
    if (seen.has(d)) continue;
    seen.add(d);
    const tdee = v[i + 6], budget = v[i + 9], eaten = v[i + 11], exercise = v[i + 13];
    if (typeof tdee !== "number" || typeof eaten !== "number") continue;
    const baseBudget = Math.round(typeof budget === "number" ? budget : tdee);
    const exerciseCal = Math.round(typeof exercise === "number" ? exercise : 0);
    const effectiveBudget = baseBudget + exerciseCal;
    console.log(`[loseit] day=${dayToDateStr(d)} tdee=${tdee} budget=${budget} eaten=${eaten} exercise=${exercise} => effectiveBudget=${effectiveBudget}`);
    entries.push({
      date: dayToDateStr(d), dayNumber: d,
      caloriesBudget: effectiveBudget,
      caloriesEaten: Math.round(eaten),
      caloriesRemaining: effectiveBudget - Math.round(eaten),
      exerciseCalories: exerciseCal,
    });
  }
  entries.sort((a, b) => a.dayNumber - b.dayNumber);
  return entries;
}

export function extractAllDailySummaries(gwt) {
  return parseDailySummaries(gwt);
}

export function extractDailySummary(gwt, targetDay) {
  const entries = parseDailySummaries(gwt);
  return entries.find(e => e.dayNumber === targetDay) ?? entries.at(-1) ?? null;
}
