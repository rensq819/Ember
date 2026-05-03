import crypto from "crypto";

const AUTH_BASE = process.env.KETO_MOJO_AUTH_BASE || "https://auth.us.mymojohealth.com";
const API_BASE = process.env.KETO_MOJO_API_BASE || "https://api.us.mymojohealth.com";
const SCOPES = "readings:retrieve users:profile:retrieve";
const COOKIE_NAME = "km_oauth";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-KetoMojo-Refresh-Token",
};

export function setcors(res) {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
}

function requireConfig() {
  const CLIENT_ID = process.env.KETO_MOJO_CLIENT_ID;
  const CLIENT_SECRET = process.env.KETO_MOJO_CLIENT_SECRET;
  const REDIRECT_URI = process.env.KETO_MOJO_REDIRECT_URI;
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    throw new Error("Keto-Mojo OAuth not configured. Set KETO_MOJO_CLIENT_ID, KETO_MOJO_CLIENT_SECRET, KETO_MOJO_REDIRECT_URI in Vercel env.");
  }
  return { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI };
}

export function generatePkce() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const state = crypto.randomBytes(16).toString("base64url");
  return { verifier, challenge, state };
}

export function buildAuthorizeUrl({ state, challenge }) {
  const { CLIENT_ID, REDIRECT_URI } = requireConfig();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${AUTH_BASE}/oauth/authorize?${params.toString()}`;
}

function basicAuthHeader() {
  const { CLIENT_ID, CLIENT_SECRET } = requireConfig();
  return "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
}

export async function exchangeCode({ code, verifier }) {
  const { REDIRECT_URI } = requireConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  });
  const res = await fetch(`${AUTH_BASE}/api/v1/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Token exchange failed (${res.status}): ${data.error_description || data.error || JSON.stringify(data)}`);
  return data;
}

export async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken });
  const res = await fetch(`${AUTH_BASE}/api/v1/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Refresh failed (${res.status}): ${data.error_description || data.error || JSON.stringify(data)}`);
  return data;
}

export async function fetchReadings(accessToken, { fromDate, toDate, types } = {}) {
  const params = new URLSearchParams();
  if (fromDate) params.set("from_date", fromDate);
  if (toDate) params.set("to_date", toDate);
  for (const t of types || []) params.append("reading_type", t);
  const url = `${API_BASE}/api/v1/readings${params.toString() ? `?${params}` : ""}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Readings fetch failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return res.json();
}

export function setOauthCookie(res, payload) {
  const value = Buffer.from(JSON.stringify(payload)).toString("base64url");
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);
}

export function clearOauthCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}

export function readOauthCookie(req) {
  const raw = req.headers.cookie || "";
  const m = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!m) return null;
  try {
    return JSON.parse(Buffer.from(m[1], "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}
