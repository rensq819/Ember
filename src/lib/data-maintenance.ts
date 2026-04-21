import { db } from "@/db";
import { normalizeTag } from "@/lib/tags";

export interface CleanupResult {
  scanned: number;
  updated: number;
  tagsExtracted: number;
}

const HASHTAG_RE = /#([\p{L}\p{N}_-]+)/gu;

interface TaggedRow {
  id?: number;
  notes?: string;
  tags?: string[];
}

type Table<T extends TaggedRow> = {
  toArray(): Promise<T[]>;
  update(id: number, changes: Partial<T>): Promise<number>;
};

async function cleanTable<T extends TaggedRow>(table: Table<T>): Promise<CleanupResult> {
  const rows = await table.toArray();
  let scanned = 0;
  let updated = 0;
  let tagsExtracted = 0;

  for (const row of rows) {
    scanned++;
    if (row.id === undefined || !row.notes) continue;

    const raw = [...row.notes.matchAll(HASHTAG_RE)].map((m) => normalizeTag(m[1]));
    const found = raw.filter(Boolean);
    if (found.length === 0) continue;

    const merged = Array.from(new Set([...(row.tags ?? []), ...found]));
    const cleanedNotes = row.notes.replace(HASHTAG_RE, "").replace(/\s+/g, " ").trim();

    await table.update(row.id, {
      tags: merged,
      notes: cleanedNotes || undefined,
    } as Partial<T>);

    updated++;
    tagsExtracted += found.length;
  }

  return { scanned, updated, tagsExtracted };
}

export async function extractHashtagsFromNotes(): Promise<CleanupResult> {
  const [metabolic, electrolyte] = await Promise.all([
    cleanTable(db.metabolicLogs),
    cleanTable(db.electrolyteLogs),
  ]);
  return {
    scanned: metabolic.scanned + electrolyte.scanned,
    updated: metabolic.updated + electrolyte.updated,
    tagsExtracted: metabolic.tagsExtracted + electrolyte.tagsExtracted,
  };
}
