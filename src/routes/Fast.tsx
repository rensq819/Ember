import { useEffect, useState } from "react";
import { Flame, Square, X } from "lucide-react";
import { db } from "@/db";
import type { FastingProtocol } from "@/db/types";
import { useActiveFast, useFastHistory } from "@/hooks/useFasts";
import { useNow } from "@/hooks/useNow";
import { TimerDisplay } from "@/components/fast/TimerDisplay";
import { StageIndicator } from "@/components/fast/StageIndicator";
import { ProtocolPicker } from "@/components/fast/ProtocolPicker";
import { getProtocol } from "@/lib/protocols";
import { formatDate, formatDuration, formatTime } from "@/lib/format";
import { calculateStreak } from "@/lib/streak";
import {
  cancelBreakFastReminder,
  ensureNotificationPermission,
  scheduleBreakFastReminder,
} from "@/lib/notifications";

const HOUR_MS = 3_600_000;

export function FastRoute() {
  const active = useActiveFast();
  const history = useFastHistory(20);
  const [selected, setSelected] = useState<FastingProtocol>("18:6");
  const now = useNow(1000);

  const streak = history ? calculateStreak(history) : 0;
  const currentProtocol = active ? getProtocol(active.protocol) : getProtocol(selected);
  const elapsedMs = active ? now - active.startedAt : 0;

  useEffect(() => {
    if (active && active.targetHours !== null && "Notification" in window && Notification.permission === "granted") {
      const targetTs = active.startedAt + active.targetHours * HOUR_MS;
      if (targetTs > Date.now()) {
        scheduleBreakFastReminder(targetTs, getProtocol(active.protocol).label);
      }
    }
    return () => cancelBreakFastReminder();
  }, [active?.id, active?.startedAt, active?.targetHours, active?.protocol]);

  async function startFast() {
    const p = getProtocol(selected);
    const startedAt = Date.now();
    await db.fastingSessions.add({
      startedAt,
      endedAt: null,
      targetHours: p.targetHours,
      protocol: selected,
    });
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

  return (
    <div className="mx-auto max-w-md space-y-6 px-6 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fast</h1>
          <p className="text-xs text-muted-foreground">
            {active ? `${currentProtocol.label} in progress` : "Pick a protocol to start"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2 text-right">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Streak</div>
          <div className="text-lg font-semibold tabular-nums">{streak}d</div>
        </div>
      </header>

      <div className="flex justify-center pt-2">
        <TimerDisplay
          elapsedMs={elapsedMs}
          targetHours={active ? active.targetHours : currentProtocol.targetHours}
        />
      </div>

      {active ? (
        <>
          <StageIndicator elapsedHours={elapsedMs / HOUR_MS} />
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={endFast}
              className="flex items-center justify-center gap-2 rounded-lg bg-ember py-3 text-sm font-semibold text-ember-foreground"
            >
              <Square className="h-4 w-4" /> End fast
            </button>
            <button
              onClick={cancelFast}
              className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card py-3 text-sm text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" /> Cancel
            </button>
          </div>
          <div className="text-xs text-muted-foreground">
            Started {formatDate(active.startedAt)} at {formatTime(active.startedAt)}
          </div>
        </>
      ) : (
        <>
          <ProtocolPicker value={selected} onChange={setSelected} />
          <button
            onClick={startFast}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-ember py-3.5 text-sm font-semibold text-ember-foreground"
          >
            <Flame className="h-4 w-4" /> Start fast
          </button>
        </>
      )}

      {history && history.length > 0 && (
        <section className="space-y-2 pt-2">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Recent fasts</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {history.slice(0, 10).map((s) => {
              const dur = (s.endedAt ?? Date.now()) - s.startedAt;
              return (
                <li key={s.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm font-medium">{getProtocol(s.protocol).label}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(s.startedAt)} · {formatTime(s.startedAt)}
                    </div>
                  </div>
                  <div className="font-mono text-sm tabular-nums">{formatDuration(dur)}</div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
