import { setcors, getCredentials, loginToLoseIt, gwtRpc, extractFoodLog, extractDailySummary, dateToDayNumber } from "./_shared.js";

export default async function handler(req, res) {
  setcors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const { email, password } = getCredentials(req);
    const dateStr = req.query.date;
    const date = dateStr
      ? new Date(dateStr + "T00:00:00Z")
      : (() => { const n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())); })();
    const dayNum = dateToDayNumber(date);

    // Single login reused for both GWT calls — avoids double-hitting LoseIt auth
    const session = await loginToLoseIt(email, password);
    const [initGwt, goalsGwt] = await Promise.all([
      gwtRpc("getInitializationData", session),
      gwtRpc("getGoalsData", session),
    ]);

    res.status(200).json({
      foodLog: extractFoodLog(initGwt, dayNum),
      dailySummary: extractDailySummary(goalsGwt, dayNum),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
