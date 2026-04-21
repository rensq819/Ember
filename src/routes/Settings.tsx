import { useEffect, useState } from "react";
import { Sparkles, Plug, CheckCircle2, XCircle } from "lucide-react";
import { DEFAULT_SETTINGS, db, getSettings } from "@/db";
import type { GlucoseUnit, UserSettings } from "@/db/types";
import { extractHashtagsFromNotes, type CleanupResult } from "@/lib/data-maintenance";
import { loseItAuth, loseItHealth } from "@/lib/loseit";

export function SettingsRoute() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [cleanup, setCleanup] = useState<CleanupResult | null>(null);
  const [cleaning, setCleaning] = useState(false);

  // LoseIt state
  const [liEmail, setLiEmail] = useState("");
  const [liPassword, setLiPassword] = useState("");
  const [liTimezone, setLiTimezone] = useState("America/Chicago");
  const [liConnecting, setLiConnecting] = useState(false);
  const [liStatus, setLiStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [liAuthenticated, setLiAuthenticated] = useState<boolean | null>(null);
  const [liUsername, setLiUsername] = useState<string | null>(null);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      if (s.loseIt) {
        setLiEmail(s.loseIt.email);
        setLiTimezone(s.loseIt.timezone);
      }
    });
    loseItHealth()
      .then((h) => {
        setLiAuthenticated(h.authenticated);
        setLiUsername(h.username);
      })
      .catch(() => setLiAuthenticated(false));
  }, []);

  async function updateUnit(unit: GlucoseUnit) {
    const next = { ...settings, glucoseUnit: unit };
    setSettings(next);
    await db.userSettings.put(next);
  }

  async function connectLoseIt() {
    setLiConnecting(true);
    setLiStatus(null);
    try {
      const result = await loseItAuth(liEmail, liPassword, liTimezone);
      setLiAuthenticated(true);
      setLiUsername(result.username);
      setLiStatus({ ok: true, message: `Connected as ${result.username}` });
      const next = { ...settings, loseIt: { email: liEmail, timezone: liTimezone } };
      setSettings(next);
      await db.userSettings.put(next);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Connection failed";
      setLiStatus({
        ok: false,
        message: msg.includes("Failed to fetch")
          ? "Proxy not running — start it with: node scripts/loseit-proxy.js"
          : msg,
      });
    } finally {
      setLiConnecting(false);
    }
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
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">LoseIt food log</h2>

        {liAuthenticated === true && (
          <div className="flex items-center gap-2 text-sm text-green-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Connected{liUsername ? ` as ${liUsername}` : ""}</span>
          </div>
        )}
        {liAuthenticated === false && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <XCircle className="h-4 w-4 shrink-0" />
            <span>Not connected — enter credentials below</span>
          </div>
        )}

        <div className="space-y-2">
          <input
            type="email"
            placeholder="LoseIt email"
            value={liEmail}
            onChange={(e) => setLiEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ember"
          />
          <input
            type="password"
            placeholder="LoseIt password"
            value={liPassword}
            onChange={(e) => setLiPassword(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ember"
          />
          <input
            type="text"
            placeholder="Timezone (e.g. America/New_York)"
            value={liTimezone}
            onChange={(e) => setLiTimezone(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ember"
          />
        </div>

        <button
          onClick={connectLoseIt}
          disabled={liConnecting || !liEmail || !liPassword}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card py-2.5 text-sm text-foreground hover:border-ember/50 disabled:opacity-60"
        >
          <Plug className="h-4 w-4" />
          {liConnecting ? "Connecting…" : "Connect LoseIt"}
        </button>

        {liStatus && (
          <div
            className={`rounded-md border px-3 py-2 text-xs ${
              liStatus.ok
                ? "border-green-500/30 bg-green-500/5 text-green-400"
                : "border-red-500/30 bg-red-500/5 text-red-400"
            }`}
          >
            {liStatus.message}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Credentials are sent to the local proxy only — never stored in the app.
          Start the proxy first: <span className="font-mono">node scripts/loseit-proxy.js</span>
        </p>
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
