import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { GlucoseKetoneForm } from "@/components/log/GlucoseKetoneForm";
import { ElectrolyteForm } from "@/components/log/ElectrolyteForm";
import { LogHistory } from "@/components/log/LogHistory";
import { CsvImportButton } from "@/components/log/CsvImportButton";
import { useElectrolyteLogs, useMetabolicLogs } from "@/hooks/useLogs";
import { useLoseItSync } from "@/hooks/useLoseItSync";
import { db } from "@/db";
import { cn } from "@/lib/utils";

type Tab = "metabolic" | "electrolyte" | "food";

function FoodTab() {
  const { sync, syncing, error, lastSyncedAt } = useLoseItSync();

  const today = new Date().toISOString().slice(0, 10);
  const entries = useLiveQuery(
    () => db.foodLogEntries.where("date").equals(today).toArray(),
    [today]
  );
  const summary = useLiveQuery(() => db.dailyCalories.get(today), [today]);

  const minutesAgo =
    lastSyncedAt ? Math.floor((Date.now() - lastSyncedAt) / 60_000) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {minutesAgo === null
            ? "Never synced"
            : minutesAgo < 1
              ? "Synced just now"
              : `Synced ${minutesAgo}m ago`}
        </span>
        <button
          onClick={() => sync()}
          disabled={syncing}
          className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:border-ember/50 disabled:opacity-60"
        >
          <RefreshCw className={cn("h-3 w-3", syncing && "animate-spin")} />
          {syncing ? "Syncing…" : "Sync"}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {summary && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Eaten</span>
            <span className="font-medium">{summary.caloriesEaten} cal</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-ember transition-all"
              style={{
                width: `${Math.min(100, (summary.caloriesEaten / Math.max(1, summary.caloriesBudget)) * 100)}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Budget: {summary.caloriesBudget}</span>
            <span className={summary.caloriesRemaining < 0 ? "text-red-400" : ""}>
              {summary.caloriesRemaining >= 0
                ? `${summary.caloriesRemaining} remaining`
                : `${Math.abs(summary.caloriesRemaining)} over`}
            </span>
          </div>
          {summary.exerciseCalories > 0 && (
            <div className="text-xs text-muted-foreground">
              +{summary.exerciseCalories} cal burned
            </div>
          )}
        </div>
      )}

      {entries && entries.length > 0 ? (
        <div className="space-y-1">
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex flex-col rounded-lg border border-border bg-card px-3 py-2"
            >
              <span className="text-sm">{e.name}</span>
              {e.brand && (
                <span className="text-xs text-muted-foreground">{e.brand}</span>
              )}
            </div>
          ))}
        </div>
      ) : entries !== undefined && !syncing ? (
        <p className="text-center text-sm text-muted-foreground py-6">
          No food logged today — tap Sync to pull from LoseIt
        </p>
      ) : null}
    </div>
  );
}

export function LogRoute() {
  const [tab, setTab] = useState<Tab>("metabolic");
  const metabolic = useMetabolicLogs(50);
  const electrolyte = useElectrolyteLogs(50);

  const TABS: { key: Tab; label: string }[] = [
    { key: "metabolic", label: "Glucose · Ketones" },
    { key: "electrolyte", label: "Electrolytes" },
    { key: "food", label: "Food" },
  ];

  return (
    <div className="mx-auto max-w-md space-y-6 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Log</h1>
        <p className="text-xs text-muted-foreground">Tap a tab to record, scroll for history.</p>
      </header>

      <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-card p-1">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "rounded-md py-2 text-sm font-medium transition-colors",
              tab === key
                ? "bg-ember text-ember-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "metabolic" ? (
        <div className="space-y-4">
          <GlucoseKetoneForm />
          <CsvImportButton />
        </div>
      ) : tab === "electrolyte" ? (
        <ElectrolyteForm />
      ) : (
        <FoodTab />
      )}

      {tab !== "food" && (
        <section className="space-y-2 pt-2">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground">History</h2>
          <LogHistory metabolic={metabolic} electrolyte={electrolyte} />
        </section>
      )}
    </div>
  );
}
