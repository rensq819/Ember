import { setcors, getOrCreateSession, gwtRpc, extractFoodLog, extractDailySummary, extractAllDailySummaries, dateToDayNumber } from "./_shared.js";

export default async function handler(req, res) {
  setcors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const dateStr = req.query.date;
    const date = dateStr
      ? new Date(dateStr + "T00:00:00Z")
      : (() => { const n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())); })();
    const dayNum = dateToDayNumber(date);

    // Reuse a cached session if the client sent one, otherwise do a fresh login.
    const session = await getOrCreateSession(req);
    const [initGwt, goalsGwt] = await Promise.all([
      gwtRpc("getInitializationData", session),
      gwtRpc("getGoalsData", session),
    ]);

    res.status(200).json({
      foodLog: extractFoodLog(initGwt, dayNum),
      dailySummary: extractDailySummary(goalsGwt, dayNum),
      dailySummaries: extractAllDailySummaries(goalsGwt),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
