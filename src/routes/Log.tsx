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

function localDateStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function FoodTab() {
  const { sync, syncing, error, lastSyncedAt } = useLoseItSync();
  const today = localDateStr();
  const entries = useLiveQuery(() => db.foodLogEntries.where("date").equals(today).toArray(), [today]);
  const summary = useLiveQuery(() => db.dailyCalories.get(today), [today]);
  const minutesAgo = lastSyncedAt ? Math.floor((Date.now() - lastSyncedAt) / 60_000) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono" style={{ color: 'hsl(var(--muted-foreground))' }}>
          {minutesAgo === null ? "Never synced" : minutesAgo < 1 ? "Synced just now" : `Synced ${minutesAgo}m ago`}
        </span>
        <button
          onClick={() => sync()}
          disabled={syncing}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 999, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', color: 'hsl(var(--muted-foreground))', fontSize: 12, cursor: 'pointer', opacity: syncing ? 0.6 : 1 }}
        >
          <RefreshCw className={cn("h-3 w-3", syncing && "animate-spin")} />
          {syncing ? "Syncing…" : "Sync"}
        </button>
      </div>

      {error && (
        <div style={{ borderRadius: 12, border: '1px solid rgba(226,102,64,0.3)', background: 'rgba(226,102,64,0.05)', padding: '10px 14px', fontSize: 12, color: '#E26640' }}>
          {error}
        </div>
      )}

      {summary && (
        <div style={{ borderRadius: 20, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <div>
              <div className="text-xs font-semibold tracking-[1.6px] uppercase" style={{ color: 'hsl(var(--muted-foreground))' }}>Eaten today</div>
              <div className="font-mono" style={{ fontSize: 32, letterSpacing: -1, color: 'hsl(var(--foreground))', fontFeatureSettings: '"tnum"', marginTop: 2 }}>
                {summary.caloriesEaten}<span style={{ fontSize: 14, color: 'hsl(var(--muted-foreground))' }}> cal</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="text-xs font-semibold tracking-[1.6px] uppercase" style={{ color: 'hsl(var(--muted-foreground))' }}>Budget</div>
              <div className="font-mono" style={{ fontSize: 20, letterSpacing: -0.5, color: 'hsl(var(--foreground))', fontFeatureSettings: '"tnum"', marginTop: 2 }}>
                {summary.caloriesBudget}
              </div>
            </div>
          </div>
          <div style={{ height: 5, background: 'hsl(var(--border))', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3,
              background: summary.caloriesRemaining < 0 ? '#B97A63' : '#C89079',
              width: `${Math.min(100, (summary.caloriesEaten / Math.max(1, summary.caloriesBudget)) * 100)}%`,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <div className="flex justify-between text-xs mt-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
            <span>{summary.exerciseCalories > 0 ? `+${summary.exerciseCalories} burned` : '\u00a0'}</span>
            <span style={{ color: summary.caloriesRemaining < 0 ? '#B97A63' : 'hsl(var(--muted-foreground))' }}>
              {summary.caloriesRemaining >= 0 ? `${summary.caloriesRemaining} remaining` : `${Math.abs(summary.caloriesRemaining)} over`}
            </span>
          </div>
        </div>
      )}

      {entries && entries.length > 0 ? (
        <div style={{ borderRadius: 18, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', overflow: 'hidden' }}>
          {entries.map((e, i) => (
            <div key={e.id} style={{
              padding: '12px 16px',
              borderBottom: i < entries.length - 1 ? '1px solid hsl(var(--border))' : 'none',
            }}>
              <div style={{ fontSize: 14, color: 'hsl(var(--foreground))' }}>{e.name}</div>
              {e.brand && <div className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>{e.brand}</div>}
            </div>
          ))}
        </div>
      ) : entries !== undefined && !syncing ? (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div className="font-display" style={{ fontSize: 20, color: 'hsl(var(--muted-foreground))' }}>Nothing logged yet.</div>
          <div className="text-xs mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>Tap Sync to pull from LoseIt</div>
        </div>
      ) : null}
    </div>
  );
}

export function LogRoute() {
  const [tab, setTab] = useState<Tab>("metabolic");
  const metabolic = useMetabolicLogs(50);
  const electrolyte = useElectrolyteLogs(50);

  const TABS: { key: Tab; label: string }[] = [
    { key: "metabolic",   label: "Glucose · Ketones" },
    { key: "electrolyte", label: "Electrolytes" },
    { key: "food",        label: "Food" },
  ];

  const accentColors: Record<Tab, string> = {
    metabolic:   '#D076B7',
    electrolyte: '#F5A64A',
    food:        '#C89079',
  };

  return (
    <div className="mx-auto max-w-md" style={{ paddingBottom: 24 }}>
      {/* Editorial header */}
      <div className="px-6" style={{ paddingTop: 64 }}>
        <div className="text-xs font-semibold tracking-[2.4px] uppercase" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Phase 02 · Record
        </div>
        <h1 className="font-display" style={{ fontWeight: 400, fontSize: 44, letterSpacing: -1.2, margin: '8px 0 0', lineHeight: 1 }}>
          Log a <em style={{ fontStyle: 'italic', color: accentColors[tab] }}>reading.</em>
        </h1>
        <p className="text-sm mt-3" style={{ color: 'hsl(var(--muted-foreground))', lineHeight: 1.55 }}>
          Pair glucose + ketones to compute GKI. Or track electrolytes.
        </p>
      </div>

      {/* Pill tab switcher */}
      <div className="px-6" style={{ paddingTop: 22 }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4,
          padding: 4, borderRadius: 999,
          background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
        }}>
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: '10px 6px', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, letterSpacing: -0.1,
              background: tab === key ? 'hsl(var(--foreground))' : 'transparent',
              color: tab === key ? 'hsl(var(--background))' : 'hsl(var(--muted-foreground))',
              transition: 'all 0.2s',
              fontFamily: '"Geist", system-ui, sans-serif',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-6" style={{ paddingTop: 22 }}>
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
      </div>

      {/* History */}
      {tab !== "food" && (
        <div className="px-6" style={{ paddingTop: 34 }}>
          <div style={{ marginBottom: 12 }}>
            <div className="text-xs font-semibold tracking-[1.6px] uppercase" style={{ color: 'hsl(var(--muted-foreground))' }}>Ledger</div>
            <div className="font-display" style={{ fontSize: 26, letterSpacing: -0.5, lineHeight: 1 }}>History</div>
          </div>
          <LogHistory metabolic={metabolic} electrolyte={electrolyte} />
        </div>
      )}
    </div>
  );
}
