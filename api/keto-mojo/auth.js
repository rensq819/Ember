import { setcors, generatePkce, buildAuthorizeUrl, setOauthCookie } from "./_shared.js";

export default function handler(req, res) {
  setcors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const { verifier, challenge, state } = generatePkce();
    setOauthCookie(res, { verifier, state });
    const url = buildAuthorizeUrl({ state, challenge });
    res.statusCode = 302;
    res.setHeader("Location", url);
    res.end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
