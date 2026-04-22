import { db } from "@/db";
import type { MetabolicLog } from "@/db/types";
import { calculateGki, mgDlToMmol } from "@/lib/gki";
import { normalizeTag } from "@/lib/tags";
import { syncMetabolicLog } from "@/lib/sync";

export interface ImportResult {
  added: number;
  skipped: number;
  failed: number;
  total: number;
}

type CsvRow = Record<string, string>;

export function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/);
  const cleaned = lines.filter((l) => l.trim() !== "" && !l.trimStart().startsWith("#"));
  if (cleaned.length < 2) return [];
  const headers = splitRow(cleaned[0]);
  const rows: CsvRow[] = [];
  for (let i = 1; i < cleaned.length; i++) {
    const values = splitRow(cleaned[i]);
    if (values.length === 0) continue;
    const row: CsvRow = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? "";
    }
    rows.push(row);
  }
  return rows;
}

function splitRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ";") {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseCsvTags(raw: string | undefined): string[] {
  if (!raw) return [];
  const inside = raw.replace(/^\[|\]$/g, "").trim();
  if (!inside) return [];
  return inside
    .split(",")
    .map((t) => normalizeTag(t.replace(/['"`]/g, "")))
    .filter(Boolean);
}

function buildTags(glucose: CsvRow | undefined, ketone: CsvRow | undefined): string[] | undefined {
  const merged = Array.from(
    new Set([...parseCsvTags(glucose?.tags), ...parseCsvTags(ketone?.tags)])
  );
  return merged.length > 0 ? merged : undefined;
}

function buildNotes(glucose: CsvRow | undefined, ketone: CsvRow | undefined): string | undefined {
  const noteText = (glucose?.notes || ketone?.notes || "").trim();
  return noteText || undefined;
}

function toMmol(value: string, unit: string): number | null {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return null;
  const u = unit.toLowerCase();
  if (u === "mgdl" || u === "mg/dl") return mgDlToMmol(n);
  return n;
}

export async function importMetabolicCsv(text: string, userId?: string): Promise<ImportResult> {
  const rows = parseCsv(text);
  const byTimestamp = new Map<string, { glucose?: CsvRow; ketone?: CsvRow }>();

  for (const r of rows) {
    const ts = r.reading_timestamp;
    const type = r.reading_type?.toLowerCase();
    if (!ts || (type !== "glucose" && type !== "ketone")) continue;
    const pair = byTimestamp.get(ts) ?? {};
    if (type === "glucose") pair.glucose = r;
    else pair.ketone = r;
    byTimestamp.set(ts, pair);
  }

  let added = 0;
  let skipped = 0;
  let failed = 0;
  const total = byTimestamp.size;

  for (const [tsString, pair] of byTimestamp) {
    try {
      const timestamp = new Date(tsString).getTime();
      if (!Number.isFinite(timestamp)) {
        failed++;
        continue;
      }

      const ids = [pair.glucose?.reading_id, pair.ketone?.reading_id]
        .filter((v): v is string => typeof v === "string" && v.length > 0)
        .sort();
      const sourceId = ids.length > 0 ? ids.join("|") : `ts:${timestamp}`;

      const existing = await db.metabolicLogs.where("sourceId").equals(sourceId).first();
      if (existing) {
        skipped++;
        continue;
      }

      const glucoseMmol = pair.glucose
        ? toMmol(pair.glucose.reading_value, pair.glucose.reading_unit)
        : null;
      const ketonesMmol = pair.ketone ? toMmol(pair.ketone.reading_value, "mmoll") : null;
      const gki =
        glucoseMmol !== null && ketonesMmol !== null
          ? calculateGki(glucoseMmol, ketonesMmol)
          : null;

      const uuid = crypto.randomUUID();
      const log: Omit<MetabolicLog, "id"> = {
        uuid,
        timestamp,
        glucoseMmol,
        ketonesMmol,
        gki,
        notes: buildNotes(pair.glucose, pair.ketone),
        tags: buildTags(pair.glucose, pair.ketone),
        sourceId,
      };

      await db.metabolicLogs.add(log);
      if (userId) syncMetabolicLog(userId, { ...log, uuid }).catch(console.error);
      added++;
    } catch {
      failed++;
    }
  }

  return { added, skipped, failed, total };
}
