import { useEffect, useRef, useState } from "react";
import { db } from "@/db";
import { loseItSync, loseItHistory, getStoredCreds } from "@/lib/loseit";

const SYNC_COOLDOWN_MS = 5 * 60 * 1000;
const LAST_SYNC_KEY = "loseit-last-sync";
const OLDEST_SYNCED_KEY = "loseit-oldest-synced";

function localDateStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

let autoSyncTriggered = false;

export function useLoseItSync() {
  const [syncing, setSyncing] = useState(false);
  const [syncingLabel, setSyncingLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(() => {
    const stored = localStorage.getItem(LAST_SYNC_KEY);
    return stored ? parseInt(stored, 10) : null;
  });
  // oldest date we've requested history for (ISO YYYY-MM-DD)
  const [oldestSynced, setOldestSynced] = useState<string>(
    () => localStorage.getItem(OLDEST_SYNCED_KEY) ?? localDateStr()
  );

  const syncRef = useRef<((date?: string) => Promise<void>) | null>(null);

  function friendlyError(e: unknown) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    return msg.includes("Missing credentials") || msg.includes("Not authenticated")
      ? "Not connected to LoseIt. Add credentials in Settings."
      : msg;
  }

  async function sync(date?: string) {
    setSyncing(true);
    setSyncingLabel(null);
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

  // Fetch one older week and save it. Called each time the user taps "Sync more".
  async function syncMore() {
    setSyncing(true);
    setError(null);
    try {
      // The next week to fetch ends one day before what we already have
      const weekEnd   = addDays(oldestSynced, -1);
      const weekStart = addDays(weekEnd, -6);

      setSyncingLabel(`${weekStart} – ${weekEnd}`);

      const { dailySummaries } = await loseItHistory(weekStart, weekEnd);
      const syncedAt = Date.now();

      if (dailySummaries.length > 0) {
        await db.dailyCalories.bulkPut(dailySummaries.map(s => ({ ...s, syncedAt })));
        // Only advance the pointer when we actually received data
        localStorage.setItem(OLDEST_SYNCED_KEY, weekStart);
        setOldestSynced(weekStart);
      }

      localStorage.setItem(LAST_SYNC_KEY, String(syncedAt));
      setLastSyncedAt(syncedAt);
    } catch (e) {
      console.error("[loseit] syncMore error:", e);
      setError(friendlyError(e));
    } finally {
      setSyncing(false);
      setSyncingLabel(null);
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

  return { sync, syncMore, syncing, syncingLabel, error, lastSyncedAt };
}
