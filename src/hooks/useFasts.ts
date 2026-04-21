import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";

export function useActiveFast() {
  return useLiveQuery(
    async () => (await db.fastingSessions.filter((s) => s.endedAt === null).first()) ?? null,
    []
  );
}

export function useFastHistory(limit = 20) {
  return useLiveQuery(
    async () => {
      const sessions = await db.fastingSessions
        .orderBy("startedAt")
        .reverse()
        .filter((s) => s.endedAt !== null)
        .limit(limit)
        .toArray();
      return sessions;
    },
    [limit]
  );
}
