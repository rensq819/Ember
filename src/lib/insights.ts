import type { FastingSession, MetabolicLog } from "@/db/types";

export interface Digest {
  avgGki: number | null;
  readingCount: number;
  fastingHours: number;
  longestFastHours: number;
  fastCount: number;
  gkiTrend: "improving" | "worsening" | "flat" | null;
}

export function computeDigest(
  metabolic: MetabolicLog[],
  fasts: FastingSession[]
): Digest {
  const withGki = metabolic.filter((m) => m.gki !== null) as (MetabolicLog & { gki: number })[];
  const avgGki =
    withGki.length > 0
      ? withGki.reduce((sum, m) => sum + m.gki, 0) / withGki.length
      : null;

  const completed = fasts.filter((f) => f.endedAt !== null) as (FastingSession & { endedAt: number })[];
  const totalMs = completed.reduce((sum, f) => sum + (f.endedAt - f.startedAt), 0);
  const longestMs = completed.reduce((max, f) => Math.max(max, f.endedAt - f.startedAt), 0);

  let gkiTrend: Digest["gkiTrend"] = null;
  if (withGki.length >= 4) {
    const sorted = [...withGki].sort((a, b) => a.timestamp - b.timestamp);
    const half = Math.floor(sorted.length / 2);
    const firstAvg = sorted.slice(0, half).reduce((s, m) => s + m.gki, 0) / half;
    const secondAvg =
      sorted.slice(half).reduce((s, m) => s + m.gki, 0) / (sorted.length - half);
    const diff = secondAvg - firstAvg;
    if (Math.abs(diff) < 0.3) gkiTrend = "flat";
    else if (diff < 0) gkiTrend = "improving";
    else gkiTrend = "worsening";
  }

  return {
    avgGki,
    readingCount: withGki.length,
    fastingHours: totalMs / 3_600_000,
    longestFastHours: longestMs / 3_600_000,
    fastCount: completed.length,
    gkiTrend,
  };
}

export function filterByRange<T>(items: T[], days: number, getTs: (item: T) => number): T[] {
  const since = Date.now() - days * 86_400_000;
  return items.filter((item) => getTs(item) >= since);
}

export function filterByTags<T extends { tags?: string[] }>(items: T[], activeTags: string[]): T[] {
  if (activeTags.length === 0) return items;
  const wanted = new Set(activeTags);
  return items.filter((item) => item.tags?.some((t) => wanted.has(t)) ?? false);
}

export interface GkiPoint {
  timestamp: number;
  gki: number;
}

export interface GlucoseKetonePoint {
  timestamp: number;
  glucoseMmol: number | null;
  ketonesMmol: number | null;
}

export interface FastBar {
  startedAt: number;
  hours: number;
  targetHours: number | null;
  hitTarget: boolean;
}

export function toGkiSeries(metabolic: MetabolicLog[]): GkiPoint[] {
  return metabolic
    .filter((m): m is MetabolicLog & { gki: number } => m.gki !== null)
    .map((m) => ({ timestamp: m.timestamp, gki: m.gki }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

export function toGlucoseKetoneSeries(metabolic: MetabolicLog[]): GlucoseKetonePoint[] {
  return metabolic
    .filter((m) => m.glucoseMmol !== null || m.ketonesMmol !== null)
    .map((m) => ({
      timestamp: m.timestamp,
      glucoseMmol: m.glucoseMmol,
      ketonesMmol: m.ketonesMmol,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

export function toFastBars(fasts: FastingSession[]): FastBar[] {
  return fasts
    .filter((f): f is FastingSession & { endedAt: number } => f.endedAt !== null)
    .map((f) => {
      const hours = (f.endedAt - f.startedAt) / 3_600_000;
      return {
        startedAt: f.startedAt,
        hours,
        targetHours: f.targetHours,
        hitTarget: f.targetHours !== null ? hours >= f.targetHours : true,
      };
    })
    .sort((a, b) => a.startedAt - b.startedAt);
}
