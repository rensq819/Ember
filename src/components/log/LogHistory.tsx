import { useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { db } from "@/db";
import type { ElectrolyteLog, MetabolicLog } from "@/db/types";
import { gkiZone, mmolToMgDl } from "@/lib/gki";
import { formatDate, formatTime } from "@/lib/format";
import { formatTag } from "@/lib/tags";
import { useSettings } from "@/hooks/useLogs";
import { useRecentTags } from "@/hooks/useTags";
import { TagInput } from "@/components/log/TagInput";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { deleteMetabolicLog, deleteElectrolyteLog, patchMetabolicLog, patchElectrolyteLog } from "@/lib/sync";

type Entry =
  | { kind: "metabolic"; ts: number; row: MetabolicLog }
  | { kind: "electrolyte"; ts: number; row: ElectrolyteLog };

interface Props {
  metabolic: MetabolicLog[] | undefined;
  electrolyte: ElectrolyteLog[] | undefined;
}

const ZONE_COLOR: Record<string, string> = {
  therapeutic: "text-emerald-400",
  "deep-ketosis": "text-teal-400",
  optimal: "text-ember",
  mild: "text-amber-400",
  "out-of-ketosis": "text-rose-400",
};

export function LogHistory({ metabolic, electrolyte }: Props) {
  const { user } = useAuth();
  const settings = useSettings();
  const suggestions = useRecentTags(24);
  const [editing, setEditing] = useState<string | null>(null);
  const entries: Entry[] = [
    ...(metabolic ?? []).map<Entry>((row) => ({ kind: "metabolic", ts: row.timestamp, row })),
    ...(electrolyte ?? []).map<Entry>((row) => ({ kind: "electrolyte", ts: row.timestamp, row })),
  ].sort((a, b) => b.ts - a.ts);

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No entries yet. Your logs will appear here.
      </div>
    );
  }

  async function remove(entry: Entry) {
    if (!window.confirm("Delete this entry?")) return;
    const id = entry.row.id;
    if (id === undefined) return;
    if (entry.kind === "metabolic") {
      await db.metabolicLogs.delete(id);
      if (user && entry.row.uuid) deleteMetabolicLog(entry.row.uuid).catch(console.error);
    } else {
      await db.electrolyteLogs.delete(id);
      if (user && entry.row.uuid) deleteElectrolyteLog(entry.row.uuid).catch(console.error);
    }
  }

  async function saveEntryEdits(entry: Entry, notes: string, tags: string[]) {
    const id = entry.row.id;
    if (id === undefined) return;
    const trimmedNotes = notes.trim();
    const patch = {
      notes: trimmedNotes.length > 0 ? trimmedNotes : undefined,
      tags: tags.length > 0 ? tags : undefined,
    };
    if (entry.kind === "metabolic") {
      await db.metabolicLogs.update(id, patch);
      if (user && entry.row.uuid) patchMetabolicLog(entry.row.uuid, patch.notes, patch.tags).catch(console.error);
    } else {
      await db.electrolyteLogs.update(id, patch);
      if (user && entry.row.uuid) patchElectrolyteLog(entry.row.uuid, patch.notes, patch.tags).catch(console.error);
    }
    setEditing(null);
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {entries.map((entry) => {
        const key = `${entry.kind}-${entry.row.id}`;
        const isEditing = editing === key;
        return (
          <li key={key} className="flex items-start gap-3 px-4 py-3">
            <div className="flex-1 space-y-1.5">
              <div className="text-xs text-muted-foreground">
                {formatDate(entry.ts)} · {formatTime(entry.ts)}
              </div>
              {entry.kind === "metabolic" ? (
                <MetabolicRow row={entry.row} unit={settings.glucoseUnit} />
              ) : (
                <ElectrolyteRow row={entry.row} />
              )}
              {isEditing ? (
                <EntryEditor
                  initialNotes={entry.row.notes ?? ""}
                  initialTags={entry.row.tags ?? []}
                  suggestions={suggestions}
                  onSave={(notes, tags) => saveEntryEdits(entry, notes, tags)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                entry.row.tags && entry.row.tags.length > 0 && <TagRow tags={entry.row.tags} />
              )}
            </div>
            <div className="flex flex-col items-center gap-2">
              {!isEditing && (
                <button
                  onClick={() => setEditing(key)}
                  className="text-muted-foreground hover:text-ember"
                  aria-label="Edit notes and tags"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => remove(entry)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Delete entry"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function MetabolicRow({ row, unit }: { row: MetabolicLog; unit: "mmol/L" | "mg/dL" }) {
  const zone = row.gki !== null ? gkiZone(row.gki) : null;
  const glucoseDisplay =
    row.glucoseMmol !== null
      ? unit === "mg/dL"
        ? `${mmolToMgDl(row.glucoseMmol).toFixed(0)} mg/dL`
        : `${row.glucoseMmol.toFixed(1)} mmol/L`
      : null;

  return (
    <div className="space-y-0.5">
      <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-sm tabular-nums">
        {glucoseDisplay && <span>Glu {glucoseDisplay}</span>}
        {row.ketonesMmol !== null && <span>β-HB {row.ketonesMmol.toFixed(1)}</span>}
        {row.gki !== null && zone && (
          <span className={cn("font-semibold", ZONE_COLOR[zone.zone])}>GKI {row.gki.toFixed(2)}</span>
        )}
      </div>
      {row.notes && <div className="text-xs text-muted-foreground">{row.notes}</div>}
    </div>
  );
}

function EntryEditor({
  initialNotes,
  initialTags,
  suggestions,
  onSave,
  onCancel,
}: {
  initialNotes: string;
  initialTags: string[];
  suggestions: string[];
  onSave: (notes: string, tags: string[]) => void;
  onCancel: () => void;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [tags, setTags] = useState<string[]>(initialTags);
  return (
    <div className="space-y-2">
      <label className="block">
        <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Notes</div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="context — e.g. meal, workout, stress"
          className="w-full resize-none rounded-md border border-border bg-background px-2.5 py-1.5 text-xs focus:border-ember focus:outline-none"
        />
      </label>
      <TagInput value={tags} onChange={setTags} suggestions={suggestions} />
      <div className="flex gap-2">
        <button
          onClick={() => onSave(notes, tags)}
          className="inline-flex items-center gap-1 rounded-md bg-ember px-2 py-1 text-xs font-medium text-ember-foreground"
        >
          <Check className="h-3 w-3" /> Save
        </button>
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" /> Cancel
        </button>
      </div>
    </div>
  );
}

function TagRow({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <span
          key={t}
          className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
        >
          {formatTag(t)}
        </span>
      ))}
    </div>
  );
}

function ElectrolyteRow({ row }: { row: ElectrolyteLog }) {
  const parts: string[] = [];
  if (row.sodiumMg !== null) parts.push(`Na ${row.sodiumMg}`);
  if (row.potassiumMg !== null) parts.push(`K ${row.potassiumMg}`);
  if (row.magnesiumMg !== null) parts.push(`Mg ${row.magnesiumMg}`);
  if (row.calciumMg !== null) parts.push(`Ca ${row.calciumMg}`);
  return (
    <div className="space-y-0.5">
      <div className="font-mono text-sm tabular-nums">
        {parts.join(" · ")} <span className="text-xs text-muted-foreground">mg</span>
      </div>
      {row.notes && <div className="text-xs text-muted-foreground">{row.notes}</div>}
    </div>
  );
}
