import { useLiveQuery } from "dexie-react-hooks";
import { db, DEFAULT_SETTINGS } from "@/db";

export function useMetabolicLogs(limit = 50) {
  return useLiveQuery(
    async () => db.metabolicLogs.orderBy("timestamp").reverse().limit(limit).toArray(),
    [limit]
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
