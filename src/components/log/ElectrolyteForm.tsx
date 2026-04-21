import { useState } from "react";
import { Check } from "lucide-react";
import { db } from "@/db";
import { ELECTROLYTE_TARGETS } from "@/lib/electrolytes";
import { useRecentTags } from "@/hooks/useTags";
import { TagInput } from "@/components/log/TagInput";
import { cn } from "@/lib/utils";

type Values = Record<string, string>;

export function ElectrolyteForm() {
  const [values, setValues] = useState<Values>({});
  const [tags, setTags] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const recentTags = useRecentTags();

  function parseField(key: string): number | null {
    const n = parseFloat(values[key] ?? "");
    return Number.isFinite(n) ? n : null;
  }

  async function save() {
    const sodium = parseField("sodium");
    const potassium = parseField("potassium");
    const magnesium = parseField("magnesium");
    const calcium = parseField("calcium");
    if (sodium === null && potassium === null && magnesium === null && calcium === null) return;
    await db.electrolyteLogs.add({
      timestamp: Date.now(),
      sodiumMg: sodium,
      potassiumMg: potassium,
      magnesiumMg: magnesium,
      calciumMg: calcium,
      tags: tags.length > 0 ? tags : undefined,
    });
    setValues({});
    setTags([]);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }

  const canSave = ELECTROLYTE_TARGETS.some((t) => parseField(t.key) !== null);

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-3">
        {ELECTROLYTE_TARGETS.map((t) => (
          <label key={t.key} className="block">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {t.symbol} · {t.label}
              </span>
            </div>
            <input
              type="number"
              inputMode="numeric"
              step="50"
              value={values[t.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [t.key]: e.target.value }))}
              placeholder={`${t.dailyMin}–${t.dailyMax} mg`}
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono tabular-nums focus:border-ember focus:outline-none"
            />
          </label>
        ))}
      </div>
      <div className="space-y-1">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Tags</div>
        <TagInput value={tags} onChange={setTags} suggestions={recentTags} />
      </div>
      <button
        onClick={save}
        disabled={!canSave}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-colors",
          canSave ? "bg-ember text-ember-foreground" : "cursor-not-allowed bg-muted text-muted-foreground"
        )}
      >
        {saved ? <><Check className="h-4 w-4" /> Saved</> : "Log electrolytes"}
      </button>
    </div>
  );
}
