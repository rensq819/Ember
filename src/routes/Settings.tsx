import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { DEFAULT_SETTINGS, db, getSettings } from "@/db";
import type { GlucoseUnit, UserSettings } from "@/db/types";
import { extractHashtagsFromNotes, type CleanupResult } from "@/lib/data-maintenance";

export function SettingsRoute() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [cleanup, setCleanup] = useState<CleanupResult | null>(null);
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  async function updateUnit(unit: GlucoseUnit) {
    const next = { ...settings, glucoseUnit: unit };
    setSettings(next);
    await db.userSettings.put(next);
  }

  async function runCleanup() {
    setCleaning(true);
    setCleanup(null);
    try {
      const result = await extractHashtagsFromNotes();
      setCleanup(result);
    } finally {
      setCleaning(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-8 px-6 py-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">Local-only. Nothing leaves your device.</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Glucose unit</h2>
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-card p-1">
          {(["mmol/L", "mg/dL"] as const).map((unit) => (
            <button
              key={unit}
              onClick={() => updateUnit(unit)}
              className={
                settings.glucoseUnit === unit
                  ? "rounded-md bg-ember py-2 text-sm font-medium text-ember-foreground"
                  : "rounded-md py-2 text-sm text-muted-foreground hover:text-foreground"
              }
            >
              {unit}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Ketones are always in mmol/L (there is no widely used alternative).</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Data maintenance</h2>
        <button
          onClick={runCleanup}
          disabled={cleaning}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card py-2.5 text-sm text-foreground hover:border-ember/50 disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4" />
          {cleaning ? "Scanning…" : "Extract #hashtags from notes"}
        </button>
        <p className="text-xs text-muted-foreground">
          Moves any <span className="font-mono">#tag</span> tokens out of old notes into the proper tags field, then trims the notes. Safe to run any time — it merges with existing tags and only touches rows that still have hashtags in notes.
        </p>
        {cleanup && (
          <div className="rounded-md border border-ember/30 bg-ember/5 px-3 py-2 text-xs text-muted-foreground">
            <span className="text-foreground">
              {cleanup.updated === 0 ? "Already clean" : `Updated ${cleanup.updated} row${cleanup.updated === 1 ? "" : "s"}`}
            </span>
            {cleanup.updated > 0 && <> · extracted {cleanup.tagsExtracted} tag{cleanup.tagsExtracted === 1 ? "" : "s"}</>}
            {" "}({cleanup.scanned} total scanned)
          </div>
        )}
      </section>
    </div>
  );
}
