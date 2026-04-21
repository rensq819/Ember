import { useEffect, useRef, useState } from "react";
import { db } from "@/db";
import { loseItDailySummary, loseItFoodLog } from "@/lib/loseit";

const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const LAST_SYNC_KEY = "loseit-last-sync";

// Module-level flag so auto-sync fires at most once per page load.
let autoSyncTriggered = false;

export function useLoseItSync() {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(() => {
    const stored = localStorage.getItem(LAST_SYNC_KEY);
    return stored ? parseInt(stored, 10) : null;
  });

  const syncRef = useRef<((date?: string) => Promise<void>) | null>(null);

  async function sync(date?: string) {
    setSyncing(true);
    setError(null);

    try {
      const [foodData, summaryData] = await Promise.all([
        loseItFoodLog(date),
        loseItDailySummary(date),
      ]);

      const syncedAt = Date.now();

      await db.transaction("rw", db.foodLogEntries, db.dailyCalories, async () => {
        await db.foodLogEntries
          .where("date")
          .equals(foodData.date)
          .delete();

        if (foodData.entries.length > 0) {
          await db.foodLogEntries.bulkAdd(
            foodData.entries.map((e) => ({
              date: foodData.date,
              name: e.name,
              brand: e.brand,
              syncedAt,
            }))
          );
        }

        await db.dailyCalories.put({ ...summaryData, syncedAt });
      });

      localStorage.setItem(LAST_SYNC_KEY, String(syncedAt));
      setLastSyncedAt(syncedAt);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      const friendlyMsg =
        msg.includes("Failed to fetch") || msg.includes("NetworkError")
          ? "Proxy not running. Start it with: node scripts/loseit-proxy.js"
          : msg.includes("Not authenticated")
            ? "Not connected to LoseIt. Add credentials in Settings."
            : msg;
      setError(friendlyMsg);
    } finally {
      setSyncing(false);
    }
  }

  syncRef.current = sync;

  // Auto-sync on app open (once per page load, respects 5-min cooldown)
  useEffect(() => {
    if (autoSyncTriggered) return;
    autoSyncTriggered = true;

    const lastSync = parseInt(localStorage.getItem(LAST_SYNC_KEY) ?? "0", 10);
    if (Date.now() - lastSync > SYNC_COOLDOWN_MS) {
      syncRef.current?.();
    }
  }, []);

  return { sync, syncing, error, lastSyncedAt };
}
