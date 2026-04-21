import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";

export function useRecentTags(limit = 12): string[] {
  const tags = useLiveQuery(async () => {
    const [metabolic, electrolyte] = await Promise.all([
      db.metabolicLogs.orderBy("timestamp").reverse().limit(200).toArray(),
      db.electrolyteLogs.orderBy("timestamp").reverse().limit(200).toArray(),
    ]);
    const counts = new Map<string, number>();
    for (const row of [...metabolic, ...electrolyte]) {
      for (const tag of row.tags ?? []) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag]) => tag);
  }, [limit]);
  return tags ?? [];
}
