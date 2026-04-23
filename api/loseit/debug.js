import { setcors, getOrCreateSession, gwtRpc, extractAllDailySummaries, dateToDayNumber } from "./_shared.js";

const DAY_EPOCH_MS = Date.UTC(2000, 11, 31);
const MS_PER_DAY = 86_400_000;
const isDayNum = (n) => typeof n === "number" && n >= 7000 && n <= 11000;

export default async function handler(req, res) {
  setcors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const timezone = req.headers["x-loseit-timezone"];
    const session = await getOrCreateSession(req);
    const gwt = await gwtRpc("getGoalsData", session, timezone);

    const { values: v } = gwt;

    // Find all positions where a day number appears and dump surrounding context
    const dayHits = [];
    for (let i = 1; i < v.length - 20; i++) {
      if (!isDayNum(v[i])) continue;
      const tz = v[i - 1];
      if (typeof tz !== "number" || tz < -12 || tz > 14) continue;
      const dayNum = v[i];
      const epochDate = new Date(DAY_EPOCH_MS + dayNum * MS_PER_DAY);
      const dateStr = epochDate.toISOString().slice(0, 10);
      // dump offsets -2 to +20 around this hit
      const ctx = {};
      for (let off = -2; off <= 20; off++) ctx[off] = v[i + off];
      dayHits.push({ i, dayNum, dateStr, ctx });
    }

    const parsedSummaries = extractAllDailySummaries(gwt);

    res.status(200).json({
      parsedSummaries,
      dayHits,
      totalValues: v.length,
      stringTableLength: gwt.stringTable.length,
      stringTable: gwt.stringTable.slice(0, 40),
    });
  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
}
