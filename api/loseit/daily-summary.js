import { setcors, getCredentials, loginToLoseIt, gwtRpc, extractDailySummary, dateToDayNumber } from "./_shared.js";

export default async function handler(req, res) {
  setcors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const { email, password } = getCredentials(req);
    const dateStr = req.query.date;
    const date = dateStr ? new Date(dateStr + "T00:00:00Z") : (() => { const n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())); })();
    const dayNum = dateToDayNumber(date);
    const session = await loginToLoseIt(email, password);
    const gwt = await gwtRpc("getGoalsData", session);
    const result = extractDailySummary(gwt, dayNum);
    if (!result) return res.status(404).json({ error: "No data for this date" });
    res.status(200).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
