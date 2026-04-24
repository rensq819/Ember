import { setcors, getOrCreateSession, gwtRpc, extractAllDailySummaries } from "./_shared.js";

function todayUtc() {
  const n = new Date();
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}-${String(n.getUTCDate()).padStart(2, "0")}`;
}

// Normalise a row from various possible LoseIt REST shapes into our summary format.
function rowToSummary(row) {
  const date = (row.date ?? row.day ?? row.entry_date ?? "").slice(0, 10);
  if (!date) return null;
  const eaten    = Number(row.calories_eaten   ?? row.caloriesEaten   ?? row.calories ?? 0);
  const base     = Number(row.calories_budget  ?? row.budget          ?? row.calorie_goal ?? row.goal ?? 0);
  const exercise = Number(row.exercise_calories ?? row.exerciseCalories ?? row.exercise ?? 0);
  const budget   = base + exercise;
  if (budget === 0 && eaten === 0) return null;
  return {
    date,
    caloriesBudget:   Math.round(budget),
    caloriesEaten:    Math.round(eaten),
    caloriesRemaining: Math.round(budget - eaten),
    exerciseCalories: Math.round(exercise),
  };
}

async function tryRestEndpoint(url, headers) {
  try {
    const res = await fetch(url, { headers });
    console.log(`[loseit/history] REST ${url} → ${res.status}`);
    if (!res.ok) return null;
    const data = await res.json();
    const rows = Array.isArray(data) ? data : (Array.isArray(data.results) ? data.results : null);
    if (!rows) { console.log(`[loseit/history] unexpected shape:`, JSON.stringify(data).slice(0, 200)); return null; }
    const summaries = rows.map(rowToSummary).filter(Boolean);
    console.log(`[loseit/history] REST parsed ${summaries.length} summaries`);
    return summaries.length > 0 ? summaries : null;
  } catch (e) {
    console.log(`[loseit/history] REST error: ${e.message}`);
    return null;
  }
}

async function fetchRestHistory(session, startDate, endDate) {
  const { cookies, userId, accessToken } = session;
  const cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");

  const cookieHeaders = { Cookie: cookie, Accept: "application/json" };
  const bearerHeaders = accessToken
    ? { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
    : null;

  // Try endpoints in order — first hit with data wins
  const endpoints = [
    `https://api.loseit.com/logs/nutrients/?user_key=${userId}&start_date=${startDate}&end_date=${endDate}`,
    `https://api.loseit.com/goal/?user_key=${userId}&start_date=${startDate}&end_date=${endDate}`,
    `https://api.loseit.com/nutrient_logs/?user_key=${userId}&start_date=${startDate}&end_date=${endDate}`,
    `https://api.loseit.com/reports/daily/?user_key=${userId}&start_date=${startDate}&end_date=${endDate}`,
  ];

  for (const url of endpoints) {
    const result = await tryRestEndpoint(url, cookieHeaders);
    if (result) return result;
    if (bearerHeaders) {
      const result2 = await tryRestEndpoint(url, bearerHeaders);
      if (result2) return result2;
    }
  }
  return null;
}

export default async function handler(req, res) {
  setcors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const timezone  = req.headers["x-loseit-timezone"];
    const startDate = req.query.start;   // YYYY-MM-DD
    const endDate   = req.query.end;     // YYYY-MM-DD
    const today     = todayUtc();

    const session = await getOrCreateSession(req);

    // GWT goals window — always includes recent days
    const goalsGwt    = await gwtRpc("getGoalsData", session, timezone);
    const gwtSummaries = extractAllDailySummaries(goalsGwt)
      .filter(s => s.date <= today);   // never return future dates

    // REST API — try to get the requested historical range
    let restSummaries = [];
    if (startDate && endDate) {
      restSummaries = await fetchRestHistory(session, startDate, endDate) ?? [];
    }

    // Merge: REST fills the old range, GWT covers recent days
    const byDate = new Map();
    for (const s of [...restSummaries, ...gwtSummaries]) byDate.set(s.date, s);

    const dailySummaries = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

    // Tell the client whether we got data in the requested old range
    const gotOldData = startDate
      ? dailySummaries.some(s => s.date >= startDate && s.date <= (endDate ?? today) && s.date < today)
      : false;

    res.status(200).json({
      dailySummaries,
      gotOldData,
      restWorked: restSummaries.length > 0,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
