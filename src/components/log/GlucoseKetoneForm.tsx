import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { db } from "@/db";
import { autophagyScore, calculateGki, gkiZone, mgDlToMmol } from "@/lib/gki";
import { useActiveFast } from "@/hooks/useFasts";
import { useNow } from "@/hooks/useNow";
import { useSettings } from "@/hooks/useLogs";
import { useRecentTags } from "@/hooks/useTags";
import { TagInput } from "@/components/log/TagInput";
import { cn } from "@/lib/utils";

const ZONE_COLOR: Record<string, string> = {
  therapeutic: "text-emerald-400",
  "deep-ketosis": "text-teal-400",
  optimal: "text-ember",
  mild: "text-amber-400",
  "out-of-ketosis": "text-rose-400",
};

export function GlucoseKetoneForm() {
  const settings = useSettings();
  const active = useActiveFast();
  const now = useNow(60_000);
  const [glucose, setGlucose] = useState("");
  const [ketones, setKetones] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const recentTags = useRecentTags();

  const glucoseMmol = useMemo(() => {
    const n = parseFloat(glucose);
    if (!Number.isFinite(n)) return null;
    return settings.glucoseUnit === "mg/dL" ? mgDlToMmol(n) : n;
  }, [glucose, settings.glucoseUnit]);

  const ketonesMmol = useMemo(() => {
    const n = parseFloat(ketones);
    return Number.isFinite(n) ? n : null;
  }, [ketones]);

  const gki = glucoseMmol !== null && ketonesMmol !== null ? calculateGki(glucoseMmol, ketonesMmol) : null;
  const zone = gki !== null ? gkiZone(gki) : null;

  const fastingHours = active ? (now - active.startedAt) / 3_600_000 : 0;
  const autophagy = gki !== null ? autophagyScore(gki, fastingHours) : null;

  async function save() {
    if (glucoseMmol === null && ketonesMmol === null) return;
    await db.metabolicLogs.add({
      timestamp: Date.now(),
      glucoseMmol,
      ketonesMmol,
      gki,
      notes: notes.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
    });
    setGlucose("");
    setKetones("");
    setNotes("");
    setTags([]);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }

  const canSave = glucoseMmol !== null || ketonesMmol !== null;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
            Glucose ({settings.glucoseUnit})
          </div>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={glucose}
            onChange={(e) => setGlucose(e.target.value)}
            placeholder={settings.glucoseUnit === "mmol/L" ? "5.0" : "90"}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-lg font-mono tabular-nums focus:border-ember focus:outline-none"
          />
        </label>
        <label className="block">
          <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Ketones (mmol/L)</div>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={ketones}
            onChange={(e) => setKetones(e.target.value)}
            placeholder="1.5"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-lg font-mono tabular-nums focus:border-ember focus:outline-none"
          />
        </label>
      </div>

      {gki !== null && zone && (
        <div className="flex items-center justify-between rounded-lg bg-background px-4 py-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">GKI</div>
            <div className={cn("font-mono text-2xl font-semibold tabular-nums", ZONE_COLOR[zone.zone])}>
              {gki.toFixed(2)}
            </div>
          </div>
          <div className="text-right">
            <div className={cn("text-sm font-semibold", ZONE_COLOR[zone.zone])}>{zone.label}</div>
            {autophagy !== null && (
              <div className="text-xs text-muted-foreground">
                Autophagy score: <span className="tabular-nums text-foreground">{autophagy}</span>
                {active ? ` · ${fastingHours.toFixed(1)}h fasted` : " · not fasting"}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-1">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Tags</div>
        <TagInput value={tags} onChange={setTags} suggestions={recentTags} />
      </div>

      <label className="block">
        <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Notes (optional)</div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="context — e.g. meal, workout, stress"
          className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-ember focus:outline-none"
        />
      </label>

      <button
        onClick={save}
        disabled={!canSave}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-colors",
          canSave
            ? "bg-ember text-ember-foreground"
            : "cursor-not-allowed bg-muted text-muted-foreground"
        )}
      >
        {saved ? <><Check className="h-4 w-4" /> Saved</> : "Save reading"}
      </button>
    </div>
  );
}
