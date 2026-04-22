const PROXY = "/api/loseit";
const CREDS_KEY = "loseit-credentials";

export interface StoredCreds { email: string; password: string; username?: string }

export function storeCreds(email: string, password: string, username?: string) {
  localStorage.setItem(CREDS_KEY, JSON.stringify({ email, password, username }));
}

export function clearCreds() {
  localStorage.removeItem(CREDS_KEY);
}

export function getStoredCreds(): StoredCreds | null {
  try {
    const raw = localStorage.getItem(CREDS_KEY);
    return raw ? JSON.parse(raw) : null;
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
  const credHeaders: Record<string, string> = creds
    ? { "X-LoseIt-Email": creds.email, "X-LoseIt-Password": creds.password }
    : {};

  const res = await fetch(`${PROXY}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...credHeaders, ...options?.headers },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as any;
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export function loseItHealth(): Promise<ProxyHealth> {
  return call<ProxyHealth>("/health");
}

export function loseItAuth(
  email: string,
  password: string,
  timezone: string
): Promise<{ ok: boolean; username: string }> {
  return call("/auth", {
    method: "POST",
    body: JSON.stringify({ email, password, timezone }),
  });
}

export function loseItFoodLog(date?: string): Promise<FoodLogResult> {
  return call<FoodLogResult>(`/food-log${date ? `?date=${date}` : ""}`);
}

export function loseItDailySummary(date?: string): Promise<DailySummaryResult> {
  return call<DailySummaryResult>(
    `/daily-summary${date ? `?date=${date}` : ""}`
  );
}
