import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/db";
import type { FastingProtocol } from "@/db/types";
import { useActiveFast, useFastHistory } from "@/hooks/useFasts";
import { useMetabolicLogsInWindow } from "@/hooks/useLogs";
import { useNow } from "@/hooks/useNow";
import { ProtocolPicker } from "@/components/fast/ProtocolPicker";
import { EmberFlame } from "@/components/fast/EmberFlame";
import { getProtocol } from "@/lib/protocols";
import { formatDate, formatTime } from "@/lib/format";
import { getFastingStage, FASTING_STAGES } from "@/lib/fasting-stages";
import { calculateStreak } from "@/lib/streak";
import { getStageColor, nextStage, hexA, STAGE_ORDER, STAGE_COPY } from "@/lib/stage-palette";
import {
  cancelBreakFastReminder,
  ensureNotificationPermission,
  scheduleBreakFastReminder,
} from "@/lib/notifications";

const HOUR_MS = 3_600_000;

function toLocalDateTimeInputValue(timestamp: number): string {
  const date = new Date(timestamp);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  const local = new Date(date.getTime() - offsetMs);
  return local.toISOString().slice(0, 16);
}

function fmtElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function gkiLabel(v: number): string {
  if (v < 1) return 'Therapeutic';
  if (v < 3) return 'Deep ketosis';
  if (v < 6) return 'Optimal';
  if (v < 9) return 'Mild ketosis';
  return 'Out of ketosis';
}
function gkiColor(v: number): string {
  if (v < 1) return '#A5B77A';
  if (v < 3) return '#8A7FA8';
  if (v < 6) return '#C89079';
  if (v < 9) return '#D1B894';
  return '#B97A63';
}

export function FastRoute() {
  const active = useActiveFast();
  const history = useFastHistory(20);
  const [selected, setSelected] = useState<FastingProtocol>("18:6");
  const [editingStartTime, setEditingStartTime] = useState(false);
  const [startTimeDraft, setStartTimeDraft] = useState("");
  const [startTimeError, setStartTimeError] = useState<string | null>(null);
  const [learnOpen, setLearnOpen] = useState(false);
  const [showCelebration, setShowCelebration] = useState<string | null>(null);
  const now = useNow(1000);
  const metabolicInWindow = useMetabolicLogsInWindow(active?.startedAt, active?.endedAt);

  const isDark = document.documentElement.classList.contains('dark');

  const streak = history ? calculateStreak(history) : 0;
  const currentProtocol = active ? getProtocol(active.protocol) : getProtocol(selected);
  const elapsedMs = active ? now - active.startedAt : 0;
  const elapsedHours = elapsedMs / HOUR_MS;
  const targetHours = active ? active.targetHours : currentProtocol.targetHours;
  const progress = targetHours ? Math.min(elapsedHours / targetHours, 1) : 0;

  const stageKey = getFastingStage(elapsedHours).key;
  const nextKey = nextStage(stageKey);
  const nextMinHours = nextKey ? (FASTING_STAGES.find(s => s.key === nextKey)?.minHours ?? null) : null;
  const hoursToNext = nextMinHours !== null ? Math.max(0, nextMinHours - elapsedHours) : 0;

  const stageColor = getStageColor(stageKey);

  const latestFastGki = useMemo(() => {
    for (let i = metabolicInWindow.length - 1; i >= 0; i--) {
      const gki = metabolicInWindow[i]?.gki;
      if (gki !== null && gki !== undefined) return gki;
    }
    return null;
  }, [metabolicInWindow]);

  const latestGluKet = useMemo(() => {
    for (let i = metabolicInWindow.length - 1; i >= 0; i--) {
      const log = metabolicInWindow[i];
      if (log.glucoseMmol !== null || log.ketonesMmol !== null) {
        return { glu: log.glucoseMmol, ket: log.ketonesMmol };
      }
    }
    return { glu: null, ket: null };
  }, [metabolicInWindow]);

  // Celebrate on stage transitions
  const prevStageRef = useRef({ key: stageKey });
  useEffect(() => {
    if (active && prevStageRef.current.key !== stageKey && stageKey !== 'fed') {
      setShowCelebration(stageKey);
    }
    prevStageRef.current.key = stageKey;
  }, [stageKey, active]);

  useEffect(() => {
    if (active && active.targetHours !== null && "Notification" in window && Notification.permission === "granted") {
      const targetTs = active.startedAt + active.targetHours * HOUR_MS;
      if (targetTs > Date.now()) {
        scheduleBreakFastReminder(targetTs, getProtocol(active.protocol).label);
      }
    }
    return () => cancelBreakFastReminder();
  }, [active?.id, active?.startedAt, active?.targetHours, active?.protocol]);

  useEffect(() => {
    if (!active) {
      setEditingStartTime(false);
      setStartTimeError(null);
      setStartTimeDraft("");
      return;
    }
    setStartTimeDraft(toLocalDateTimeInputValue(active.startedAt));
  }, [active?.id, active?.startedAt]);

  async function startFast() {
    const p = getProtocol(selected);
    const startedAt = Date.now();
    await db.fastingSessions.add({ startedAt, endedAt: null, targetHours: p.targetHours, protocol: selected });
    if (p.targetHours !== null) {
      const granted = await ensureNotificationPermission();
      if (granted) scheduleBreakFastReminder(startedAt + p.targetHours * HOUR_MS, p.label);
    }
  }

  async function endFast() {
    if (!active?.id) return;
    await db.fastingSessions.update(active.id, { endedAt: Date.now() });
    cancelBreakFastReminder();
  }

  async function cancelFast() {
    if (!active?.id) return;
    if (!window.confirm("Discard this fast? It won't count toward history.")) return;
    await db.fastingSessions.delete(active.id);
    cancelBreakFastReminder();
  }

  async function saveStartTime() {
    if (!active?.id) return;
    const nextStartedAt = Date.parse(startTimeDraft);
    if (Number.isNaN(nextStartedAt)) { setStartTimeError("Enter a valid date and time."); return; }
    if (nextStartedAt > Date.now()) { setStartTimeError("Start time can't be in the future."); return; }
    await db.fastingSessions.update(active.id, { startedAt: nextStartedAt });
    setStartTimeError(null);
    setEditingStartTime(false);
  }

  const stageHeadline: Record<string, React.ReactNode> = {
    fed:            <><span>The ember</span><br /><em style={{ color: stageColor.glow, fontStyle: 'italic' }}>rests.</em></>,
    early:          <><span>Insulin</span><br /><em style={{ color: stageColor.glow, fontStyle: 'italic' }}>retreating.</em></>,
    "fat-burning":  <><span>Lipolysis</span><br /><em style={{ color: stageColor.glow, fontStyle: 'italic' }}>accelerating.</em></>,
    ketosis:        <><span>You crossed</span><br /><em style={{ color: stageColor.glow, fontStyle: 'italic' }}>over.</em></>,
    "deep-ketosis": <><span>Ketones</span><br /><em style={{ color: stageColor.glow, fontStyle: 'italic' }}>ascendant.</em></>,
    autophagy:      <><span>Cellular</span><br /><em style={{ color: stageColor.glow, fontStyle: 'italic' }}>spring-clean.</em></>,
    "deep-autophagy": <><span>Stem cells</span><br /><em style={{ color: stageColor.glow, fontStyle: 'italic' }}>signalling.</em></>,
  };

  return (
    <div className="mx-auto max-w-md" style={{ color: 'hsl(var(--foreground))', position: 'relative' }}>
      {/* Stage tint strip */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, background: stageColor.glow, opacity: 0.7, zIndex: 10 }} />

      {/* Top bar */}
      <div className="flex items-center justify-between px-6" style={{ paddingTop: 64 }}>
        <div className="flex items-center gap-2">
          <div style={{
            width: 24, height: 24, borderRadius: 7,
            background: '#C89079', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#1F1C18', fontFamily: '"DM Serif Display", serif', fontSize: 14,
          }}>e</div>
          <span className="text-xs font-medium tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>ember</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono"
          style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: stageColor.glow, boxShadow: `0 0 8px ${stageColor.glow}`, display: 'inline-block' }} />
          {streak}d streak
        </div>
      </div>

      {/* Editorial headline */}
      <div className="px-6" style={{ paddingTop: 24 }}>
        <div className="text-xs font-semibold tracking-[2.4px] uppercase" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Hour {String(Math.floor(elapsedHours)).padStart(2, '0')} · {stageColor.label}
        </div>
        <h1 className="font-display" style={{ fontSize: 44, lineHeight: 1.02, letterSpacing: -1, fontWeight: 400, margin: '8px 0 0' }}>
          {active ? stageHeadline[stageKey] : <><span>The ember</span><br /><em style={{ color: '#DCC6A6', fontStyle: 'italic' }}>waits.</em></>}
        </h1>
      </div>

      {/* Flame + timer */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px 0 8px', position: 'relative' }}>
        <EmberFlame stageKey={stageKey} progress={progress} size={260} isDark={isDark} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="font-mono" style={{ fontSize: 40, fontWeight: 400, letterSpacing: -1, color: 'hsl(var(--foreground))', fontFeatureSettings: '"tnum"', lineHeight: 1 }}>
            {fmtElapsed(elapsedMs)}
          </div>
          <div className="text-xs tracking-[1.8px] uppercase mt-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
            {active
              ? (targetHours ? `${Math.round(progress * 100)}% of ${targetHours}h` : 'Open-ended fast')
              : 'Ready to ignite'
            }
          </div>
        </div>
      </div>

      {/* Stage ticker */}
      <div className="px-6 flex gap-1" style={{ paddingTop: 6 }}>
        {STAGE_ORDER.map((k, i) => {
          const idx = STAGE_ORDER.indexOf(stageKey as typeof STAGE_ORDER[number]);
          const active_ = i <= idx;
          const cur = i === idx;
          const sc = getStageColor(k);
          return (
            <div key={k} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: active_ ? sc.glow : 'hsl(var(--border))',
              opacity: active_ ? (cur ? 1 : 0.45) : 1,
              boxShadow: cur ? `0 0 10px ${sc.glow}` : 'none',
              transition: 'all 0.4s ease',
            }} />
          );
        })}
      </div>

      {active ? (
        <>
          {/* Next + GKI cards */}
          <div className="px-6 grid grid-cols-2 gap-2.5" style={{ paddingTop: 20 }}>
            <FactCard
              eyebrow="Next"
              title={nextKey ? getStageColor(nextKey).label : 'Beyond'}
              caption={nextKey ? `in ${hoursToNext.toFixed(1)}h` : 'Keep going'}
              accentColor={nextKey ? getStageColor(nextKey).glow : stageColor.glow}
              isDark={isDark}
            />
            <FactCard
              eyebrow="Latest GKI"
              title={latestFastGki != null ? latestFastGki.toFixed(2) : '—'}
              caption={latestFastGki != null ? gkiLabel(latestFastGki) : 'No reading yet'}
              accentColor={latestFastGki != null ? gkiColor(latestFastGki) : 'hsl(var(--muted-foreground))'}
              mono
              isDark={isDark}
            />
          </div>

          {/* Glucose / Ketone strip */}
          {(latestGluKet.glu !== null || latestGluKet.ket !== null) && (
            <div className="px-6" style={{ paddingTop: 10 }}>
              <MetabolicStrip glu={latestGluKet.glu} ket={latestGluKet.ket} isDark={isDark} />
            </div>
          )}

          {/* Stage learn card */}
          <div className="px-6" style={{ paddingTop: 18 }}>
            <StageLearnCard
              stageKey={stageKey}
              open={learnOpen}
              onToggle={() => setLearnOpen(o => !o)}
              isDark={isDark}
            />
          </div>

          {/* Controls */}
          <div className="px-6 grid gap-2" style={{ paddingTop: 18, gridTemplateColumns: '1fr auto auto' }}>
            <button
              onClick={endFast}
              style={{
                border: 'none', borderRadius: 16, padding: 16, cursor: 'pointer',
                background: stageColor.base, color: '#1F1C18',
                fontWeight: 600, fontSize: 15, letterSpacing: -0.2,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontFamily: '"Geist", system-ui, sans-serif',
              }}
            >
              <IconSquare /> End · {elapsedHours.toFixed(1)}h
            </button>
            <SmallIconBtn label="Edit" onClick={() => setEditingStartTime(true)} isDark={isDark}><IconPencil /></SmallIconBtn>
            <SmallIconBtn label="Discard" onClick={cancelFast} isDark={isDark}><IconX /></SmallIconBtn>
          </div>

          {/* Edit start time */}
          {editingStartTime && (
            <div className="mx-6 mt-4 rounded-2xl border p-4 space-y-3"
              style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--card))' }}>
              <label className="text-xs uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>
                Start time
              </label>
              <input
                type="datetime-local"
                value={startTimeDraft}
                onChange={(e) => { setStartTimeDraft(e.target.value); setStartTimeError(null); }}
                max={toLocalDateTimeInputValue(now)}
                className="w-full rounded-xl border px-3 py-2 text-sm bg-background"
                style={{ borderColor: 'hsl(var(--border))' }}
              />
              {startTimeError && <p className="text-xs" style={{ color: 'hsl(var(--destructive))' }}>{startTimeError}</p>}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={saveStartTime} className="rounded-xl py-2 text-sm font-semibold"
                  style={{ background: stageColor.base, color: '#1F1C18' }}>Save</button>
                <button onClick={() => setEditingStartTime(false)} className="rounded-xl border py-2 text-sm"
                  style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Started info */}
          <div className="px-6 mt-4 font-mono text-xs" style={{ color: 'hsl(var(--muted-foreground))', fontFeatureSettings: '"tnum"' }}>
            Started {formatDate(active.startedAt)} · {formatTime(active.startedAt)}
            {latestFastGki !== null && ` · GKI ${latestFastGki.toFixed(2)}`}
          </div>
        </>
      ) : (
        <>
          {/* Protocol picker */}
          <div className="px-6" style={{ paddingTop: 24 }}>
            <ProtocolPicker value={selected} onChange={setSelected} />
          </div>
          <div className="px-6" style={{ paddingTop: 12 }}>
            <button
              onClick={startFast}
              style={{
                width: '100%', border: 'none', borderRadius: 16, padding: '16px',
                background: `linear-gradient(180deg, #D4A48E 0%, #C89079 100%)`,
                color: '#1F1C18', fontWeight: 600, fontSize: 15,
                fontFamily: '"Geist", system-ui, sans-serif',
                cursor: 'pointer',
                boxShadow: '0 10px 24px -12px #C89079',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <IconFlameSmall /> Light the ember
            </button>
          </div>
        </>
      )}

      {/* Recent fasts */}
      {history && history.length > 0 && (
        <div className="px-6" style={{ paddingTop: 34 }}>
          <SectionHeader eyebrow="Archive" title="Recent fasts" />
          <div className="rounded-[18px] overflow-hidden border" style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}>
            {history.slice(0, 8).map((s, i, arr) => {
              const dur = (s.endedAt ?? Date.now()) - s.startedAt;
              const hours = dur / HOUR_MS;
              const target = s.targetHours ?? hours;
              const pct = Math.min(hours / target, 1);
              const hit = hours >= target;
              return (
                <div key={s.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center',
                  padding: '14px 16px', gap: 10,
                  borderBottom: i < arr.length - 1 ? '1px solid hsl(var(--border))' : 'none',
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span className="font-display" style={{ fontSize: 18, color: 'hsl(var(--foreground))' }}>
                        {getProtocol(s.protocol).label}
                      </span>
                      <span className="font-mono text-xs" style={{ color: 'hsl(var(--muted-foreground))', fontFeatureSettings: '"tnum"' }}>
                        {formatDate(s.startedAt)}
                      </span>
                    </div>
                    <div style={{ marginTop: 6, height: 3, background: 'hsl(var(--border))', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
                      <div style={{ position: 'absolute', inset: 0, width: `${pct * 100}%`, background: hit ? '#D4A48E' : 'hsl(var(--muted-foreground))', borderRadius: 2 }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="font-mono" style={{ fontSize: 18, color: 'hsl(var(--foreground))', fontFeatureSettings: '"tnum"' }}>
                      {hours.toFixed(1)}<span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>h</span>
                    </div>
                    <div className="text-xs tracking-wide" style={{ color: hit ? '#D4A48E' : 'hsl(var(--muted-foreground))' }}>
                      {hit ? 'HIT' : 'SHORT'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stage celebration overlay */}
      {showCelebration && (
        <StageCelebration stageKey={showCelebration} onDismiss={() => setShowCelebration(null)} />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FactCard({ eyebrow, title, caption, accentColor, mono = false, isDark: _isDark }: {
  eyebrow: string; title: string; caption: string; accentColor: string; mono?: boolean; isDark: boolean;
}) {
  return (
    <div style={{
      border: '1px solid hsl(var(--border))', borderRadius: 20, padding: '14px 16px',
      background: 'hsl(var(--card))', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 14, right: 14, width: 6, height: 6, borderRadius: 3, background: accentColor }} />
      <div className="text-xs font-semibold tracking-[1.6px] uppercase" style={{ color: 'hsl(var(--muted-foreground))' }}>{eyebrow}</div>
      <div className={mono ? 'font-mono' : 'font-display'} style={{ marginTop: 6, fontSize: mono ? 26 : 22, fontWeight: 400, color: 'hsl(var(--foreground))', letterSpacing: -0.5, lineHeight: 1.1, fontFeatureSettings: mono ? '"tnum"' : undefined }}>
        {title}
      </div>
      <div className="text-xs mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>{caption}</div>
    </div>
  );
}

function MetabolicStrip({ glu, ket, isDark: _isDark }: { glu: number | null; ket: number | null; isDark: boolean }) {
  return (
    <div style={{
      borderRadius: 20, border: '1px solid hsl(var(--border))',
      background: 'hsl(var(--card))',
      padding: '14px 18px', display: 'grid',
      gridTemplateColumns: '1fr 1px 1fr', alignItems: 'center', gap: 12,
    }}>
      <ReadingBit label="Glucose" value={glu?.toFixed(1) ?? '—'} unit="mmol/L" color="#9FD85A" align="left" />
      <div style={{ width: 1, height: 32, background: 'hsl(var(--border))' }} />
      <ReadingBit label="Ketones" value={ket?.toFixed(1) ?? '—'} unit="mmol/L" color="#D076B7" align="right" />
    </div>
  );
}

function ReadingBit({ label, value, unit, color, align }: { label: string; value: string; unit: string; color: string; align: 'left' | 'right' }) {
  return (
    <div style={{ textAlign: align }}>
      <div className="text-xs font-semibold tracking-[1.6px] uppercase flex items-center gap-1.5" style={{ color: 'hsl(var(--muted-foreground))', justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
        {label}
      </div>
      <div className="flex items-baseline gap-1 mt-0.5" style={{ justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
        <span className="font-mono" style={{ fontSize: 22, letterSpacing: -0.5, color: 'hsl(var(--foreground))', fontFeatureSettings: '"tnum"' }}>{value}</span>
        <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>{unit}</span>
      </div>
    </div>
  );
}

function StageLearnCard({ stageKey, open, onToggle, isDark: _isDark }: { stageKey: string; open: boolean; onToggle: () => void; isDark: boolean }) {
  const sc = getStageColor(stageKey);
  const copy = STAGE_COPY[stageKey];
  return (
    <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 20, background: 'hsl(var(--card))', overflow: 'hidden' }}>
      <button onClick={onToggle} style={{
        display: 'flex', width: '100%', alignItems: 'flex-start', justifyContent: 'space-between',
        padding: '16px 18px', gap: 12,
        background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer',
        color: 'hsl(var(--foreground))',
      }}>
        <div style={{ flex: 1 }}>
          <div className="text-xs font-semibold tracking-[1.6px] uppercase" style={{ color: 'hsl(var(--muted-foreground))' }}>What's happening</div>
          <div className="font-display mt-1" style={{ fontSize: 20, letterSpacing: -0.3, lineHeight: 1.15 }}>{copy.headline}</div>
        </div>
        <div style={{
          width: 28, height: 28, borderRadius: 14, flexShrink: 0,
          background: hexA(sc.glow, 0.15), color: sc.glow,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s',
        }}>
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1.5 3.5L5 7l3.5-3.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      </button>
      {open && (
        <div style={{ padding: '0 18px 18px', color: 'hsl(var(--muted-foreground))', fontSize: 13.5, lineHeight: 1.55 }}>
          <p style={{ margin: 0 }}>{copy.body}</p>
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {copy.bullets.map((b, i) => (
              <div key={i} style={{
                padding: '10px 12px', borderRadius: 12,
                background: hexA(sc.glow, 0.06), border: `1px solid ${hexA(sc.glow, 0.18)}`,
              }}>
                <div className="text-xs font-semibold tracking-[1.2px] uppercase" style={{ color: sc.glow }}>{b.tag}</div>
                <div className="text-xs mt-0.5" style={{ color: 'hsl(var(--foreground))' }}>{b.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="text-xs font-semibold tracking-[1.6px] uppercase" style={{ color: 'hsl(var(--muted-foreground))' }}>{eyebrow}</div>
      <div className="font-display" style={{ fontSize: 26, letterSpacing: -0.5, lineHeight: 1 }}>{title}</div>
    </div>
  );
}

function SmallIconBtn({ label, onClick, children, isDark: _isDark }: { label: string; onClick: () => void; children: React.ReactNode; isDark: boolean }) {
  return (
    <button aria-label={label} onClick={onClick} style={{
      width: 52, height: 52, borderRadius: 16,
      border: '1px solid hsl(var(--border))',
      background: 'hsl(var(--card))', color: 'hsl(var(--muted-foreground))',
      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    }}>{children}</button>
  );
}

function StageCelebration({ stageKey, onDismiss }: { stageKey: string; onDismiss: () => void }) {
  const sc = getStageColor(stageKey);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  useEffect(() => {
    const t = setTimeout(() => onDismissRef.current(), 3000);
    return () => clearTimeout(t);
  }, []);
  const confetti = useMemo(() => Array.from({ length: 18 }).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    d: 1.5 + Math.random() * 1.5,
    delay: Math.random() * 0.5,
    color: [sc.glow, sc.base, '#F5A64A'][i % 3],
    r: Math.random() * 360,
  })), [stageKey]);

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 50 }}>
      {confetti.map((c) => (
        <span key={c.id} style={{
          position: 'absolute', top: -20, left: `${c.x}%`,
          width: 6, height: 12, background: c.color, borderRadius: 1,
          animation: `ember-confetti ${c.d}s cubic-bezier(0.4,0,0.6,1) ${c.delay}s forwards`,
          transform: `rotate(${c.r}deg)`,
        }} />
      ))}
      <div style={{
        position: 'absolute', bottom: 120, left: 20, right: 20,
        padding: '16px 20px', borderRadius: 20, background: sc.base, color: '#1F1C18',
      }}>
        <div className="text-xs font-bold tracking-[2px] uppercase">Milestone</div>
        <div className="font-display mt-0.5" style={{ fontSize: 24, letterSpacing: -0.5 }}>
          Welcome to {sc.label.toLowerCase()}.
        </div>
      </div>
    </div>
  );
}

function IconSquare() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="2" width="10" height="10" rx="2"/></svg>;
}
function IconPencil() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M11 2l3 3-8 8H3v-3l8-8z"/></svg>;
}
function IconX() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13"/></svg>;
}
function IconFlameSmall() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 1.5c1 2 3 3 3 6a3 3 0 01-6 0c0-1 .5-2 1-3 0 1 .5 1.5 1 1.5C7 3 8 2.5 8 1.5z"/></svg>;
}
