const PROXY = "/api/loseit";
const CREDS_KEY = "loseit-credentials";
const SESSION_KEY = "loseit-session";
const SESSION_TTL_MS = 55 * 60 * 1000; // 55 min — shorter than LoseIt's ~1h cookie lifetime

export interface StoredCreds { email: string; password: string; username?: string }

interface CachedSession {
  cookies: Record<string, string>;
  userId: number;
  username: string;
  cachedAt: number;
}

export function storeCreds(email: string, password: string, username?: string) {
  localStorage.setItem(CREDS_KEY, JSON.stringify({ email, password, username }));
}

export function clearCreds() {
  localStorage.removeItem(CREDS_KEY);
  localStorage.removeItem(SESSION_KEY);
}

export function getStoredCreds(): StoredCreds | null {
  try {
    const raw = localStorage.getItem(CREDS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function storeSession(data: { cookies: Record<string, string>; userId: number; username: string }) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...data, cachedAt: Date.now() }));
}

function getFreshSession(): CachedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data: CachedSession = JSON.parse(raw);
    if (Date.now() - data.cachedAt > SESSION_TTL_MS) return null;
    return data;
  } catch { return null; }
}

export interface ProxyHealth {
  ok: boolean;
  authenticated: boolean;
  username: string | null;
}

export interface FoodLogResult {
  date: string;
  entries: Array<{ name: string; brand: string | null }>;
}

export interface DailySummaryResult {
  date: string;
  caloriesBudget: number;
  caloriesEaten: number;
  caloriesRemaining: number;
  exerciseCalories: number;
}

async function call<T>(path: string, options?: RequestInit): Promise<T> {
  const creds = getStoredCreds();
  const session = getFreshSession();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-LoseIt-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  if (creds) {
    headers["X-LoseIt-Email"] = creds.email;
    headers["X-LoseIt-Password"] = creds.password;
  }
  if (session) {
    const { cookies, userId, username } = session;
    headers["X-LoseIt-Session"] = btoa(JSON.stringify({ cookies, userId, username }));
  }

  const res = await fetch(`${PROXY}${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export function loseItHealth(): Promise<ProxyHealth> {
  return call<ProxyHealth>("/health");
}

export async function loseItAuth(
  email: string,
  password: string,
  timezone: string
): Promise<{ ok: boolean; username: string }> {
  const result = await call<{ ok: boolean; username: string; session?: Omit<CachedSession, 'cachedAt'> }>("/auth", {
    method: "POST",
    body: JSON.stringify({ email, password, timezone }),
  });
  if (result.session) storeSession(result.session);
  return { ok: result.ok, username: result.username };
}

export interface SyncResult {
  foodLog: FoodLogResult;
  dailySummary: DailySummaryResult | null;
  dailySummaries: DailySummaryResult[];
}

export function loseItSync(date?: string): Promise<SyncResult> {
  return call<SyncResult>(`/sync${date ? `?date=${date}` : ""}`);
}
