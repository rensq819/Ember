import { setcors, exchangeCode, readOauthCookie, clearOauthCookie } from "./_shared.js";

const APP_BASE = process.env.KETO_MOJO_APP_BASE || "https://ember-app-ten.vercel.app";

export default async function handler(req, res) {
  setcors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const { code, state, error, error_description } = req.query;
    if (error) throw new Error(`OAuth error: ${error_description || error}`);
    if (!code) throw new Error("Missing code parameter");

    const cookie = readOauthCookie(req);
    if (!cookie || cookie.state !== state) throw new Error("State mismatch — possible CSRF.");

    const tokens = await exchangeCode({ code, verifier: cookie.verifier });
    clearOauthCookie(res);

    if (!tokens.refresh_token) {
      throw new Error(`No refresh_token in response. Got fields: ${Object.keys(tokens).join(", ")}. Check that the OAuth client has 'refresh_token' grant type enabled and is_active=true in the partner portal.`);
    }

    const fragment = new URLSearchParams({
      keto_mojo_connected: "1",
      refresh_token: tokens.refresh_token,
    }).toString();
    res.statusCode = 302;
    res.setHeader("Location", `${APP_BASE}/settings#${fragment}`);
    res.end();
  } catch (e) {
    clearOauthCookie(res);
    res.status(400).send(`Keto-Mojo auth failed: ${e.message}`);
  }
}
