import { CORS, setcors, loginToLoseIt } from "./_shared.js";

export default async function handler(req, res) {
  setcors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) return res.status(400).json({ error: "email and password required" });
    const session = await loginToLoseIt(email, password);
    res.status(200).json({
      ok: true,
      username: session.username,
      session: { cookies: session.cookies, userId: session.userId, username: session.username },
    });
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
}
