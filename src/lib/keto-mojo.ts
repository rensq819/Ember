const PROXY = "/api/keto-mojo";
const RT_KEY = "keto-mojo-refresh-token";

export type ReadingType = "glucose" | "ketone" | "hemoglobin" | "hematocrit";

export interface Reading {
  id?: string;
  reading_type: ReadingType;
  value: number;
  unit?: string;
  taken_at: string;
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
