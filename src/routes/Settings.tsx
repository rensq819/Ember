import { useEffect, useState } from "react";
import { LogOut, Plug } from "lucide-react";
import { DEFAULT_SETTINGS, db, getSettings } from "@/db";
import type { GlucoseUnit, UserSettings } from "@/db/types";
import { extractHashtagsFromNotes, type CleanupResult } from "@/lib/data-maintenance";
import { loseItAuth, getStoredCreds, storeCreds } from "@/lib/loseit";
import {
  captureCallbackHash as captureKetoMojoHash,
  clearRefreshToken as clearKetoMojoToken,
  isKetoMojoConnected,
  startKetoMojoConnect,
  syncKetoMojoReadings,
} from "@/lib/keto-mojo";
import { useAuth } from "@/contexts/AuthContext";
import { upsertSettings, syncAllData } from "@/lib/sync";

export function SettingsRoute() {
  const { user, signOut } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [cleanup, setCleanup] = useState<CleanupResult | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ uploaded: number; downloaded: number } | 'error' | null>(null);

  // Theme
  const [theme, setThemeState] = useState<'dark' | 'light'>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );

  // LoseIt
  const [liEmail, setLiEmail] = useState("");
  const [liPassword, setLiPassword] = useState("");
  const [liTimezone, setLiTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [liConnecting, setLiConnecting] = useState(false);
  const [liStatus, setLiStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [liAuthenticated, setLiAuthenticated] = useState<boolean | null>(null);
  const [liUsername, setLiUsername] = useState<string | null>(null);

  // Keto-Mojo
  const [kmConnected, setKmConnected] = useState<boolean | null>(null);
  const [kmSyncing, setKmSyncing] = useState(false);
  const [kmStatus, setKmStatus] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      if (s.loseIt) { setLiEmail(s.loseIt.email); setLiTimezone(s.loseIt.timezone); }
    });
    const creds = getStoredCreds();
    if (creds) {
      setLiAuthenticated(true);
      setLiUsername(creds.username ?? null);
      setLiEmail(creds.email);
      setLiPassword(creds.password);
    } else {
      setLiAuthenticated(false);
    }

    const captured = captureKetoMojoHash();
    setKmConnected(isKetoMojoConnected());
    if (captured) setKmStatus({ ok: true, message: "Connected to Keto-Mojo." });
  }, []);

  function applyTheme(t: 'dark' | 'light') {
    setThemeState(t);
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('ember-theme', t);
  }

  async function updateUnit(unit: GlucoseUnit) {
    const next = { ...settings, glucoseUnit: unit };
    setSettings(next);
    await db.userSettings.put(next);
    if (user) upsertSettings(user.id, next).catch(console.error);
  }

  async function updateDietMode(mode: "standard" | "keto") {
    const next = { ...settings, dietMode: mode };
    setSettings(next);
    await db.userSettings.put(next);
  }

  async function connectKetoMojo() {
    setKmStatus(null);
    try {
      await startKetoMojoConnect();
    } catch (e) {
      setKmStatus({ ok: false, message: e instanceof Error ? e.message : "Connect failed" });
    }
  }

  function disconnectKetoMojo() {
    clearKetoMojoToken();
    setKmConnected(false);
    setKmStatus(null);
  }

  async function syncKetoMojo() {
    setKmSyncing(true);
    setKmStatus(null);
    try {
      const result = await syncKetoMojoReadings({ userId: user?.id, days: 30 });
      const parts = [
        `${result.fetched} fetched`,
        `${result.created} new`,
        result.alreadyImported > 0 ? `${result.alreadyImported} already had` : null,
      ].filter(Boolean);
      setKmStatus({ ok: true, message: parts.join(" · ") + " (last 30 days)" });
    } catch (e) {
      setKmStatus({ ok: false, message: e instanceof Error ? e.message : "Sync failed" });
    } finally {
      setKmSyncing(false);
    }
  }

  async function connectLoseIt() {
    setLiConnecting(true);
    setLiStatus(null);
    try {
      const result = await loseItAuth(liEmail, liPassword, liTimezone);
      storeCreds(liEmail, liPassword, result.username);
      setLiAuthenticated(true);
      setLiUsername(result.username);
      setLiStatus({ ok: true, message: `Connected as ${result.username}` });
      const next = { ...settings, loseIt: { email: liEmail, timezone: liTimezone } };
      setSettings(next);
      await db.userSettings.put(next);
      if (user) upsertSettings(user.id, next).catch(console.error);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Connection failed";
      setLiStatus({ ok: false, message: msg });
    } finally {
      setLiConnecting(false);
    }
  }

  async function runSync() {
    if (!user) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncAllData(user.id);
      sessionStorage.removeItem('ember-cloud-synced');
      setSyncResult(result);
    } catch {
      setSyncResult('error');
    } finally {
      setSyncing(false);
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

  const inputStyle = {
    width: '100%', borderRadius: 12, border: '1px solid hsl(var(--border))',
    background: 'hsl(var(--background))', color: 'hsl(var(--foreground))',
    padding: '10px 14px', fontSize: 14,
    outline: 'none', fontFamily: '"Geist", system-ui, sans-serif',
  };

  return (
    <div className="mx-auto max-w-md">
      {/* Editorial header */}
      <div className="px-6" style={{ paddingTop: 64 }}>
        <div className="text-xs font-semibold tracking-[2.4px] uppercase" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Phase 04 · Tune
        </div>
        <h1 className="font-display" style={{ fontWeight: 400, fontSize: 44, letterSpacing: -1.2, margin: '8px 0 0', lineHeight: 1 }}>
          Your <em style={{ fontStyle: 'italic', color: '#8A7FA8' }}>ember,</em><br />your way.
        </h1>
        <p className="text-sm mt-3" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Your data lives in the cloud — private, backed up, yours.
        </p>
      </div>

      {/* Appearance — Dusk / Paper toggle */}
      <SettingsSection title="Appearance">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {(['dark', 'light'] as const).map((t) => {
            const active = theme === t;
            const isDarkCard = t === 'dark';
            return (
              <button key={t} onClick={() => applyTheme(t)} style={{
                padding: '16px 14px', borderRadius: 18, cursor: 'pointer', textAlign: 'left',
                border: `1.5px solid ${active ? (isDarkCard ? '#D4A48E' : '#B97A63') : 'hsl(var(--border))'}`,
                background: isDarkCard ? '#12100D' : '#F4EFE6',
                color: isDarkCard ? '#F5EDE0' : '#1C1610',
                position: 'relative', fontFamily: '"Geist", system-ui, sans-serif',
              }}>
                <div style={{
                  position: 'absolute', top: 10, right: 10,
                  width: 14, height: 14, borderRadius: 7,
                  border: `1.5px solid ${active ? (isDarkCard ? '#D4A48E' : '#B97A63') : 'rgba(128,128,128,0.4)'}`,
                  background: active ? (isDarkCard ? '#D4A48E' : '#B97A63') : 'transparent',
                }} />
                <div className="font-display" style={{ fontSize: 20, letterSpacing: -0.3 }}>
                  {isDarkCard ? 'Dusk' : 'Paper'}
                </div>
                <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>
                  {isDarkCard ? 'Warm off-black · embers glow' : 'Cream canvas · editorial calm'}
                </div>
                <div style={{ marginTop: 10, display: 'flex', gap: 3 }}>
                  {['#D4A48E', '#B97A63', '#8A7FA8', '#A5B77A'].map((c) => (
                    <div key={c} style={{ flex: 1, height: 4, background: c, borderRadius: 2 }} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </SettingsSection>

      {/* Diet mode */}
      <SettingsSection title="Diet mode">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {([
            { key: 'standard', label: 'Standard', sub: 'Intermittent fasting · general' },
            { key: 'keto',     label: 'Keto',     sub: 'Fat-adapted · low-carb baseline' },
          ] as const).map(({ key, label, sub }) => {
            const active = (settings.dietMode ?? 'standard') === key;
            return (
              <button key={key} onClick={() => updateDietMode(key)} style={{
                padding: '16px 14px', borderRadius: 18, cursor: 'pointer', textAlign: 'left',
                border: `1.5px solid ${active ? '#9D93B7' : 'hsl(var(--border))'}`,
                background: 'hsl(var(--card))', color: 'hsl(var(--foreground))',
                position: 'relative', fontFamily: '"Geist", system-ui, sans-serif',
              }}>
                <div style={{
                  position: 'absolute', top: 10, right: 10,
                  width: 14, height: 14, borderRadius: 7,
                  border: `1.5px solid ${active ? '#9D93B7' : 'rgba(128,128,128,0.4)'}`,
                  background: active ? '#9D93B7' : 'transparent',
                }} />
                <div className="font-display" style={{ fontSize: 20, letterSpacing: -0.3 }}>{label}</div>
                <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>{sub}</div>
              </button>
            );
          })}
        </div>
        <p className="text-xs mt-2.5" style={{ color: 'hsl(var(--muted-foreground))', lineHeight: 1.5 }}>
          Adjusts stage descriptions and headlines to reflect your metabolic baseline.
        </p>
      </SettingsSection>

      {/* Glucose unit */}
      <SettingsSection title="Glucose unit">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: 4, borderRadius: 999, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}>
          {(['mmol/L', 'mg/dL'] as const).map((u) => (
            <button key={u} onClick={() => updateUnit(u)} style={{
              padding: '10px', borderRadius: 999, border: 'none', cursor: 'pointer',
              background: settings.glucoseUnit === u ? 'hsl(var(--foreground))' : 'transparent',
              color: settings.glucoseUnit === u ? 'hsl(var(--background))' : 'hsl(var(--muted-foreground))',
              fontFamily: '"Geist", system-ui, sans-serif', fontSize: 13, fontWeight: 600,
            }}>{u}</button>
          ))}
        </div>
        <p className="text-xs mt-2.5" style={{ color: 'hsl(var(--muted-foreground))', lineHeight: 1.5 }}>
          Ketones always mmol/L — no widely used alternative.
        </p>
      </SettingsSection>

      {/* GKI zones reference */}
      <SettingsSection title="GKI zones">
        <div style={{ borderRadius: 20, padding: '16px 18px', background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
            {[
              { k: '<1',  label: 'Therapeutic', c: '#A5B77A' },
              { k: '1–3', label: 'Deep',        c: '#8A7FA8' },
              { k: '3–6', label: 'Optimal',     c: '#C89079' },
              { k: '6–9', label: 'Mild',        c: '#D1B894' },
              { k: '>9',  label: 'Out',         c: '#B97A63' },
            ].map((z) => (
              <div key={z.k} style={{ textAlign: 'center' }}>
                <div style={{ height: 4, background: z.c, borderRadius: 2 }} />
                <div className="font-mono mt-1.5" style={{ fontSize: 11 }}>{z.k}</div>
                <div className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))', fontSize: 9, letterSpacing: 0.5 }}>{z.label}</div>
              </div>
            ))}
          </div>
        </div>
      </SettingsSection>

      {/* LoseIt */}
      <SettingsSection title="LoseIt food log">
        {liAuthenticated === true && (
          <div className="flex items-center gap-2 text-sm mb-3" style={{ color: '#A5B77A' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#A5B77A', display: 'inline-block', boxShadow: '0 0 8px #A5B77A' }} />
            Connected{liUsername ? ` as ${liUsername}` : ""}
          </div>
        )}
        {liAuthenticated === false && (
          <div className="flex items-center gap-2 text-xs mb-3" style={{ color: 'hsl(var(--muted-foreground))' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px solid hsl(var(--muted-foreground))', display: 'inline-block' }} />
            Not connected — enter credentials below
          </div>
        )}
        <div className="space-y-2">
          <input type="email" placeholder="LoseIt email" value={liEmail} onChange={(e) => setLiEmail(e.target.value)} style={inputStyle} />
          <input type="password" placeholder="Password" value={liPassword} onChange={(e) => setLiPassword(e.target.value)} style={inputStyle} />
          <input type="text" placeholder="Timezone (e.g. America/New_York)" value={liTimezone} onChange={(e) => setLiTimezone(e.target.value)} style={inputStyle} />
        </div>
        <button
          onClick={connectLoseIt}
          disabled={liConnecting || !liEmail || !liPassword}
          style={{
            marginTop: 10, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            borderRadius: 14, border: '1px solid hsl(var(--border))', padding: '12px',
            background: 'hsl(var(--card))', color: 'hsl(var(--foreground))',
            fontSize: 14, fontWeight: 500, cursor: 'pointer', opacity: (liConnecting || !liEmail || !liPassword) ? 0.6 : 1,
            fontFamily: '"Geist", system-ui, sans-serif',
          }}
        >
          <Plug size={14} />
          {liConnecting ? "Connecting…" : "Connect LoseIt"}
        </button>
        {liStatus && (
          <div style={{
            marginTop: 8, borderRadius: 12, padding: '10px 14px', fontSize: 12,
            border: `1px solid ${liStatus.ok ? 'rgba(165,183,122,0.3)' : 'rgba(185,122,99,0.3)'}`,
            background: liStatus.ok ? 'rgba(165,183,122,0.06)' : 'rgba(185,122,99,0.06)',
            color: liStatus.ok ? '#A5B77A' : '#B97A63',
          }}>{liStatus.message}</div>
        )}
        <p className="text-xs mt-2.5" style={{ color: 'hsl(var(--muted-foreground))', lineHeight: 1.5 }}>
          Credentials are stored only in your browser and never sent to any server except LoseIt.
        </p>
      </SettingsSection>

      {/* Keto-Mojo */}
      <SettingsSection title="Keto-Mojo glucose & ketones">
        {kmConnected === true && (
          <div className="flex items-center gap-2 text-sm mb-3" style={{ color: '#A5B77A' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#A5B77A', display: 'inline-block', boxShadow: '0 0 8px #A5B77A' }} />
            Connected
          </div>
        )}
        {kmConnected === false && (
          <div className="flex items-center gap-2 text-xs mb-3" style={{ color: 'hsl(var(--muted-foreground))' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px solid hsl(var(--muted-foreground))', display: 'inline-block' }} />
            Not connected — authorize via MyMojoHealth
          </div>
        )}
        {kmConnected === false ? (
          <button
            onClick={connectKetoMojo}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              borderRadius: 14, border: '1px solid hsl(var(--border))', padding: '12px',
              background: 'hsl(var(--card))', color: 'hsl(var(--foreground))',
              fontSize: 14, fontWeight: 500, cursor: 'pointer',
              fontFamily: '"Geist", system-ui, sans-serif',
            }}
          >
            <Plug size={14} />
            Connect Keto-Mojo
          </button>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              onClick={syncKetoMojo}
              disabled={kmSyncing}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                borderRadius: 14, border: '1px solid hsl(var(--border))', padding: '12px',
                background: 'hsl(var(--card))', color: 'hsl(var(--foreground))',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: kmSyncing ? 0.6 : 1,
                fontFamily: '"Geist", system-ui, sans-serif',
              }}
            >
              {kmSyncing ? "Syncing…" : "Sync readings (30d)"}
            </button>
            <button
              onClick={disconnectKetoMojo}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                borderRadius: 14, border: '1px solid hsl(var(--border))', padding: '12px',
                background: 'transparent', color: '#B97A63',
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
                fontFamily: '"Geist", system-ui, sans-serif',
              }}
            >
              Disconnect
            </button>
          </div>
        )}
        {kmStatus && (
          <div style={{
            marginTop: 8, borderRadius: 12, padding: '10px 14px', fontSize: 12,
            border: `1px solid ${kmStatus.ok ? 'rgba(165,183,122,0.3)' : 'rgba(185,122,99,0.3)'}`,
            background: kmStatus.ok ? 'rgba(165,183,122,0.06)' : 'rgba(185,122,99,0.06)',
            color: kmStatus.ok ? '#A5B77A' : '#B97A63',
          }}>{kmStatus.message}</div>
        )}
        <p className="text-xs mt-2.5" style={{ color: 'hsl(var(--muted-foreground))', lineHeight: 1.5 }}>
          Authorizes once via MyMojoHealth. Refresh token is stored only in your browser.
        </p>
      </SettingsSection>

      {/* Data */}
      <SettingsSection title="Data">
        <div style={{ borderRadius: 20, background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', overflow: 'hidden' }}>
          {user && (
            <button
              onClick={runSync}
              disabled={syncing}
              style={{
                width: '100%', padding: '15px 18px', border: 'none', background: 'transparent',
                borderBottom: '1px solid hsl(var(--border))',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                textAlign: 'left', cursor: 'pointer', color: 'hsl(var(--foreground))',
                fontFamily: '"Geist", system-ui, sans-serif', opacity: syncing ? 0.6 : 1,
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{syncing ? 'Syncing…' : 'Sync data now'}</div>
                <div className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>Merge this device with cloud.</div>
              </div>
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1.6" strokeLinecap="round"><path d="M1 1l6 6-6 6"/></svg>
            </button>
          )}
          <button
            onClick={runCleanup}
            disabled={cleaning}
            style={{
              width: '100%', padding: '15px 18px', border: 'none', background: 'transparent',
              borderBottom: '1px solid hsl(var(--border))',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              textAlign: 'left', cursor: 'pointer', color: 'hsl(var(--foreground))',
              fontFamily: '"Geist", system-ui, sans-serif', opacity: cleaning ? 0.6 : 1,
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{cleaning ? "Scanning…" : "Extract #hashtags from notes"}</div>
              <div className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>Sweep notes, promote tags properly.</div>
            </div>
            <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1.6" strokeLinecap="round"><path d="M1 1l6 6-6 6"/></svg>
          </button>
          <button
            style={{
              width: '100%', padding: '15px 18px', border: 'none', background: 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              textAlign: 'left', cursor: 'pointer', fontFamily: '"Geist", system-ui, sans-serif',
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#B97A63' }}>Clear local database</div>
              <div className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>Permanent. Can't be undone.</div>
            </div>
            <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1.6" strokeLinecap="round"><path d="M1 1l6 6-6 6"/></svg>
          </button>
        </div>
        {syncResult && (
          <div style={{
            marginTop: 8, borderRadius: 12, padding: '10px 14px', fontSize: 12,
            border: `1px solid ${syncResult === 'error' ? 'rgba(185,122,99,0.3)' : 'rgba(165,183,122,0.3)'}`,
            background: syncResult === 'error' ? 'rgba(185,122,99,0.06)' : 'rgba(165,183,122,0.06)',
            color: syncResult === 'error' ? '#B97A63' : '#A5B77A',
          }}>
            {syncResult === 'error'
              ? 'Sync failed — check your connection and try again.'
              : syncResult.uploaded === 0 && syncResult.downloaded === 0
                ? 'Already up to date.'
                : [
                    syncResult.uploaded > 0 && `↑ ${syncResult.uploaded} uploaded`,
                    syncResult.downloaded > 0 && `↓ ${syncResult.downloaded} downloaded`,
                  ].filter(Boolean).join(' · ')
            }
          </div>
        )}
        {cleanup && (
          <div style={{ marginTop: 8, borderRadius: 12, padding: '10px 14px', fontSize: 12, border: '1px solid rgba(200,144,121,0.3)', background: 'rgba(200,144,121,0.06)', color: 'hsl(var(--muted-foreground))' }}>
            <span style={{ color: 'hsl(var(--foreground))' }}>
              {cleanup.updated === 0 ? "Already clean" : `Updated ${cleanup.updated} row${cleanup.updated === 1 ? "" : "s"}`}
            </span>
            {cleanup.updated > 0 && <> · extracted {cleanup.tagsExtracted} tag{cleanup.tagsExtracted === 1 ? "" : "s"}</>}
            {" "}({cleanup.scanned} scanned)
          </div>
        )}
      </SettingsSection>

      {/* Footer */}
      <div style={{ padding: '36px 24px 32px', textAlign: 'center' }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, background: '#C89079',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: '#1F1C18', fontFamily: '"DM Serif Display", serif', fontSize: 16,
        }}>e</div>
        <div className="font-display mt-2.5" style={{ fontSize: 18, letterSpacing: -0.3 }}>Ember</div>
        <div className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>Fast well. Measure quietly.</div>
        {user && (
          <>
            <div className="text-xs mt-3" style={{ color: 'hsl(var(--muted-foreground))', opacity: 0.6 }}>
              {user.email}
            </div>
            <button
              onClick={signOut}
              style={{
                marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 999,
                border: '1px solid hsl(var(--border))',
                background: 'transparent', color: 'hsl(var(--muted-foreground))',
                fontSize: 12, cursor: 'pointer',
                fontFamily: '"Geist", system-ui, sans-serif',
              }}
            >
              <LogOut size={12} /> Sign out
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-6" style={{ paddingTop: 26 }}>
      <div className="text-xs font-semibold tracking-[1.6px] uppercase mb-2.5" style={{ color: 'hsl(var(--muted-foreground))' }}>
        {title}
      </div>
      {children}
    </div>
  );
}
