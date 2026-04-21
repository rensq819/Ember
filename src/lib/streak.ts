import type { FastingSession } from "@/db/types";

const DAY_MS = 86_400_000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function calculateStreak(sessions: FastingSession[]): number {
  const days = Array.from(
    new Set(
      sessions
        .filter((s) => s.endedAt !== null)
        .map((s) => startOfDay(s.endedAt as number))
    )
  ).sort((a, b) => b - a);

  if (days.length === 0) return 0;

  const today = startOfDay(Date.now());
  const yesterday = today - DAY_MS;

  if (days[0] !== today && days[0] !== yesterday) return 0;

  let streak = 1;
  let cursor = days[0];
  for (let i = 1; i < days.length; i++) {
    if (days[i] === cursor - DAY_MS) {
      streak++;
      cursor = days[i];
    } else {
      break;
    }
  }
  return streak;
}
