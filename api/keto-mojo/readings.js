import { setcors, refreshAccessToken, fetchReadings } from "./_shared.js";

export default async function handler(req, res) {
  setcors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const refreshToken = req.headers["x-ketomojo-refresh-token"];
    if (!refreshToken) return res.status(401).json({ error: "Missing refresh token. Connect Keto-Mojo first." });

    const tokens = await refreshAccessToken(refreshToken);

    const fromDate = req.query.from || req.query.from_date;
    const toDate = req.query.to || req.query.to_date;
    const typesParam = req.query.type || req.query.types || "glucose,ketone";
    const types = String(typesParam).split(",").map(s => s.trim()).filter(Boolean);

    const readings = await fetchReadings(tokens.access_token, { fromDate, toDate, types });

    res.status(200).json({
      readings,
      refreshToken: tokens.refresh_token || refreshToken,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
