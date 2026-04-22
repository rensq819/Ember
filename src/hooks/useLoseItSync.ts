import { useEffect, useRef, useState } from "react";
import { db } from "@/db";
import { loseItSync, getStoredCreds } from "@/lib/loseit";

const SYNC_COOLDOWN_MS = 5 * 60 * 1000;
const LAST_SYNC_KEY = "loseit-last-sync";

function localDateStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

let autoSyncTriggered = false;

export function useLoseItSync() {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(() => {
    const stored = localStorage.getItem(LAST_SYNC_KEY);
    return stored ? parseInt(stored, 10) : null;
  });

  const syncRef = useRef<((date?: string) => Promise<void>) | null>(null);

  function friendlyError(e: unknown) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    return msg.includes("Missing credentials") || msg.includes("Not authenticated")
      ? "Not connected to LoseIt. Add credentials in Settings."
      : msg;
  }

  async function sync(date?: string) {
    setSyncing(true);
    setError(null);
    try {
      const targetDate = date ?? localDateStr();
      const { foodLog: foodData, dailySummary: summaryData, dailySummaries } = await loseItSync(targetDate);
      const syncedAt = Date.now();

      await db.transaction("rw", db.foodLogEntries, db.dailyCalories, async () => {
        await db.foodLogEntries.where("date").equals(foodData.date).delete();
        if (foodData.entries.length > 0) {
          await db.foodLogEntries.bulkAdd(
            foodData.entries.map((e) => ({ date: foodData.date, name: e.name, brand: e.brand, syncedAt }))
          );
        }
        const summaries = dailySummaries?.length ? dailySummaries : summaryData ? [summaryData] : [];
        if (summaries.length > 0) {
          await db.dailyCalories.bulkPut(summaries.map(s => ({ ...s, syncedAt })));
        }
      });

      localStorage.setItem(LAST_SYNC_KEY, String(syncedAt));
      setLastSyncedAt(syncedAt);
    } catch (e) {
      console.error("[loseit] sync error:", e);
      setError(friendlyError(e));
    } finally {
      setSyncing(false);
    }
  }

  syncRef.current = sync;

  useEffect(() => {
    if (autoSyncTriggered) return;
    if (!getStoredCreds()) return;
    autoSyncTriggered = true;
    const lastSync = parseInt(localStorage.getItem(LAST_SYNC_KEY) ?? "0", 10);
    if (Date.now() - lastSync > SYNC_COOLDOWN_MS) {
      syncRef.current?.();
    }
  }, []);

  return { sync, syncing, error, lastSyncedAt };
}
