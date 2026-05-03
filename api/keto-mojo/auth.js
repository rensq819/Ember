import { setcors, generatePkce, buildAuthorizeUrl, setOauthCookie } from "./_shared.js";

export default function handler(req, res) {
  setcors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const { verifier, challenge, state } = generatePkce();
    setOauthCookie(res, { verifier, state });
    const url = buildAuthorizeUrl({ state, challenge });

    if (req.query.redirect === "1") {
      res.statusCode = 302;
      res.setHeader("Location", url);
      res.end();
      return;
    }
    res.status(200).json({ authorize_url: url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
