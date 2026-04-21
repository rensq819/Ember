import { useLiveQuery } from "dexie-react-hooks";
import { db, DEFAULT_SETTINGS } from "@/db";

export function useMetabolicLogs(limit = 50) {
  return useLiveQuery(
    async () => db.metabolicLogs.orderBy("timestamp").reverse().limit(limit).toArray(),
    [limit]
  );
}

export function useMetabolicLogsInWindow(
  startedAt: number | null | undefined,
  endedAt: number | null | undefined
) {
  return useLiveQuery(
    async () => {
      if (startedAt === null || startedAt === undefined) return [];
      const upperBound = endedAt ?? Date.now();
      if (upperBound < startedAt) return [];
      return db.metabolicLogs.where("timestamp").between(startedAt, upperBound, true, true).toArray();
    },
    [startedAt, endedAt],
    []
  );
}

export function useElectrolyteLogs(limit = 50) {
  return useLiveQuery(
    async () => db.electrolyteLogs.orderBy("timestamp").reverse().limit(limit).toArray(),
    [limit]
  );
}

export function useSettings() {
  return useLiveQuery(
    async () => (await db.userSettings.get("singleton")) ?? DEFAULT_SETTINGS,
    [],
    DEFAULT_SETTINGS
  );
}
