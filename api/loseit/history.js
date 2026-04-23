import { setcors, getOrCreateSession, gwtRpc, extractAllDailySummaries, dayToDateStr, dateToDayNumber } from "./_shared.js";

// Try LoseIt REST API for a date range — uses session cookies from login.
// Returns null if the endpoint is unavailable or returns unexpected data.
async function fetchRestHistory(session, startDate, endDate) {
  const { cookies, userId } = session;
  const cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");

  const url = `https://api.loseit.com/goal/?user_key=${userId}&start_date=${startDate}&end_date=${endDate}&format=json`;
  let res;
  try {
    res = await fetch(url, { headers: { Cookie: cookie, Accept: "application/json" } });
  } catch { return null; }

  if (!res.ok) return null;
  let data;
  try { data = await res.json(); } catch { return null; }

  // Response is typically an array of daily goal objects
  if (!Array.isArray(data)) return null;

  const results = [];
  for (const row of data) {
    const date = row.date ?? row.day ?? row.entry_date;
    if (!date || typeof date !== "string") continue;
    const eaten = Number(row.calories_eaten ?? row.caloriesEaten ?? row.calories ?? 0);
    const base = Number(row.calories_budget ?? row.budget ?? row.calorie_goal ?? 0);
    const exercise = Number(row.exercise_calories ?? row.exerciseCalories ?? row.exercise ?? 0);
    const budget = base + exercise;
    if (budget === 0 && eaten === 0) continue;
    results.push({
      date: date.slice(0, 10),
      caloriesBudget: Math.round(budget),
      caloriesEaten: Math.round(eaten),
      caloriesRemaining: Math.round(budget - eaten),
      exerciseCalories: Math.round(exercise),
    });
  }
  return results.length > 0 ? results : null;
}

export default async function handler(req, res) {
  setcors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const timezone = req.headers["x-loseit-timezone"];
    const startDate = req.query.start;  // YYYY-MM-DD — first day of desired range
    const endDate   = req.query.end;    // YYYY-MM-DD — last day of desired range

    const session = await getOrCreateSession(req);

    // Always pull the standard GWT window (covers recent days)
    const goalsGwt = await gwtRpc("getGoalsData", session, timezone);
    const gwtSummaries = extractAllDailySummaries(goalsGwt);

    // Try the REST API for the requested range
    let restSummaries = [];
    if (startDate && endDate) {
      restSummaries = await fetchRestHistory(session, startDate, endDate) ?? [];
    }

    // Merge all sources — GWT covers the recent window, REST covers the requested range.
    // Do NOT filter GWT results by date: GWT always returns recent days regardless of
    // what range was requested, so filtering would drop all GWT data for old ranges.
    const byDate = new Map();
    for (const s of [...restSummaries, ...gwtSummaries]) byDate.set(s.date, s);

    const dailySummaries = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

    res.status(200).json({ dailySummaries, restWorked: restSummaries.length > 0, gwtCount: gwtSummaries.length, restCount: restSummaries.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
