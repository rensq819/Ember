import { db } from "@/db";
import { syncMetabolicLog } from "@/lib/sync";
import type { MetabolicLog } from "@/db/types";

const PROXY = "/api/keto-mojo";
const RT_KEY = "keto-mojo-refresh-token";
const MERGE_WINDOW_MS = 5 * 60 * 1000;

export type ReadingType = "glucose" | "ketone" | "hemoglobin" | "hematocrit";

export interface Reading {
  reading_id: string;
  reading_type: string;
  reading_value: string;
  reading_unit: string;
  reading_timestamp: string;
  notes?: string;
  meter_type?: string;
  serial_number?: string;
  [key: string]: unknown;
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem(RT_KEY);
}

export function storeRefreshToken(token: string) {
  localStorage.setItem(RT_KEY, token);
}

export function clearRefreshToken() {
  localStorage.removeItem(RT_KEY);
}

export function isKetoMojoConnected(): boolean {
  return !!getStoredRefreshToken();
}

export async function startKetoMojoConnect() {
  const res = await fetch(`${PROXY}/auth`, { credentials: "same-origin" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Auth init failed (${res.status})`);
  }
  const { authorize_url } = await res.json();
  if (!authorize_url) throw new Error("No authorize_url returned.");
  window.location.href = authorize_url;
}

// Reads the OAuth callback fragment (set by /api/keto-mojo/callback) and persists the
// refresh token. Call once on app startup or on Settings mount. Returns true if a
// token was just captured.
export function captureCallbackHash(): boolean {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return false;
  const params = new URLSearchParams(hash);
  if (params.get("keto_mojo_connected") !== "1") return false;
  const rt = params.get("refresh_token");
  if (!rt) return false;
  storeRefreshToken(rt);
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return true;
}

interface ReadingsResponse {
  readings: Reading[];
  refreshToken: string;
}

export async function fetchKetoMojoReadings(opts: {
  from?: string;
  to?: string;
  types?: ReadingType[];
} = {}): Promise<Reading[]> {
  const rt = getStoredRefreshToken();
  if (!rt) throw new Error("Not connected. Click 'Connect Keto-Mojo' in Settings.");

  const qs = new URLSearchParams();
  if (opts.from) qs.set("from", opts.from);
  if (opts.to) qs.set("to", opts.to);
  if (opts.types?.length) qs.set("type", opts.types.join(","));

  const res = await fetch(`${PROXY}/readings${qs.toString() ? `?${qs}` : ""}`, {
    headers: { "X-KetoMojo-Refresh-Token": rt },
  });
  const data = await res.json() as ReadingsResponse | { error: string };
  if (!res.ok) throw new Error("error" in data ? data.error : `Failed (${res.status})`);

  const ok = data as ReadingsResponse;
  if (ok.refreshToken && ok.refreshToken !== rt) storeRefreshToken(ok.refreshToken);
  return ok.readings;
}

const READING_ID_RE = /(?:^|\+)keto-mojo:([^+]+)/g;

function importedReadingIds(sourceId?: string | null): string[] {
  if (!sourceId) return [];
  return Array.from(sourceId.matchAll(READING_ID_RE), (m) => m[1]);
}

function toMmolGlucose(value: number, unit: string): number | null {
  if (unit === "mmoll") return value;
  if (unit === "mgdl") return value / 18.0156;
  return null;
}

interface MergedGroup {
  timestamp: number;
  glucoseMmol: number | null;
  ketonesMmol: number | null;
  readingIds: string[];
  notes: string[];
}

function mergeWithinWindow(readings: Reading[]): MergedGroup[] {
  const sorted = [...readings].sort(
    (a, b) => new Date(a.reading_timestamp).getTime() - new Date(b.reading_timestamp).getTime()
  );
  const groups: MergedGroup[] = [];
  for (const r of sorted) {
    const ts = new Date(r.reading_timestamp).getTime();
    if (Number.isNaN(ts)) continue;
    let g = groups[groups.length - 1];
    if (!g || ts - g.timestamp > MERGE_WINDOW_MS) {
      g = { timestamp: ts, glucoseMmol: null, ketonesMmol: null, readingIds: [], notes: [] };
      groups.push(g);
    }
    g.readingIds.push(r.reading_id);
    if (r.notes && !g.notes.includes(r.notes)) g.notes.push(r.notes);
    const value = parseFloat(r.reading_value);
    if (Number.isNaN(value)) continue;
    if (r.reading_type === "glucose") {
      g.glucoseMmol = toMmolGlucose(value, r.reading_unit);
    } else if (r.reading_type === "ketone" && r.reading_unit === "mmoll") {
      g.ketonesMmol = value;
    }
  }
  return groups;
}

export interface SyncResult {
  fetched: number;
  alreadyImported: number;
  created: number;
}

export async function syncKetoMojoReadings(
  opts: { userId?: string; days?: number } = {}
): Promise<SyncResult> {
  const days = opts.days ?? 30;
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  const readings = await fetchKetoMojoReadings({
    from: from.toISOString(),
    to: to.toISOString(),
    types: ["glucose", "ketone"],
  });

  const existingIds = new Set<string>();
  for (const log of await db.metabolicLogs.toArray()) {
    for (const id of importedReadingIds(log.sourceId)) existingIds.add(id);
  }

  const fresh = readings.filter((r) => !existingIds.has(r.reading_id));
  const groups = mergeWithinWindow(fresh);

  let created = 0;
  const supabaseOps: Promise<void>[] = [];
  for (const g of groups) {
    if (g.glucoseMmol == null && g.ketonesMmol == null) continue;
    const gki =
      g.glucoseMmol != null && g.ketonesMmol != null && g.ketonesMmol > 0
        ? Math.round((g.glucoseMmol / g.ketonesMmol) * 100) / 100
        : null;
    const row: MetabolicLog = {
      uuid: crypto.randomUUID(),
      timestamp: g.timestamp,
      glucoseMmol: g.glucoseMmol,
      ketonesMmol: g.ketonesMmol,
      gki,
      notes: g.notes.length ? g.notes.join(" · ") : undefined,
      sourceId: g.readingIds.map((id) => `keto-mojo:${id}`).join("+"),
    };
    await db.metabolicLogs.add(row);
    created++;
    if (opts.userId) {
      supabaseOps.push(
        syncMetabolicLog(opts.userId, {
          uuid: row.uuid!,
          timestamp: row.timestamp,
          glucoseMmol: row.glucoseMmol,
          ketonesMmol: row.ketonesMmol,
          gki: row.gki,
          notes: row.notes,
          tags: row.tags,
          sourceId: row.sourceId,
        })
      );
    }
  }
  await Promise.all(supabaseOps).catch(console.error);

  return {
    fetched: readings.length,
    alreadyImported: readings.length - fresh.length,
    created,
  };
}
