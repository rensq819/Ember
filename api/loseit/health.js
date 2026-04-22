import { CORS, setcors } from "./_shared.js";

export default function handler(req, res) {
  setcors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const hasEmail = !!req.headers["x-loseit-email"];
  const hasPassword = !!req.headers["x-loseit-password"];
  res.status(200).json({ ok: true, authenticated: hasEmail && hasPassword, username: null });
}
