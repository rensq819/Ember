import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { formatElapsed } from "@/lib/format";
export interface TimerMarker {
  elapsedMs: number;
  color: string;
  label: string;
}

interface Props {
  elapsedMs: number;
  targetHours: number | null;
  markers?: TimerMarker[];
}

export function TimerDisplay({ elapsedMs, targetHours, markers = [] }: Props) {
  const targetMs = targetHours !== null ? targetHours * 3_600_000 : null;
  const progress = targetMs !== null ? Math.min(elapsedMs / targetMs, 1) : null;
  const safeElapsedMs = Math.max(elapsedMs, 1);

  const size = 260;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const center = size / 2;
  const markerRadius = 4;
  const visibleMarkers = markers.filter((m) => m.elapsedMs >= 0 && m.elapsedMs <= elapsedMs);
  const positionedMarkers = useMemo(
    () =>
      visibleMarkers.map((marker, idx) => {
        const markerProgress = Math.min(Math.max(marker.elapsedMs / safeElapsedMs, 0), 1);
        const angle = markerProgress * Math.PI * 2;
        return {
          ...marker,
          id: `${marker.elapsedMs}-${idx}`,
          x: center + Math.cos(angle) * r,
          y: center + Math.sin(angle) * r,
        };
      }),
    [center, r, safeElapsedMs, visibleMarkers]
  );
  const [activeMarkerIndex, setActiveMarkerIndex] = useState<number | null>(null);
  const activeMarker = activeMarkerIndex !== null ? positionedMarkers[activeMarkerIndex] ?? null : null;
  const popupLeft = activeMarker ? Math.min(size - 40, Math.max(40, activeMarker.x)) : center;
  const popupTop = activeMarker ? Math.max(26, activeMarker.y - 12) : 26;

  useEffect(() => {
    if (activeMarkerIndex === null) return;
    if (activeMarkerIndex >= positionedMarkers.length) {
      setActiveMarkerIndex(null);
    }
  }, [activeMarkerIndex, positionedMarkers.length]);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      onMouseLeave={() => setActiveMarkerIndex(null)}
    >
      <svg width={size} height={size} className="-rotate-90" onClick={() => setActiveMarkerIndex(null)}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="hsl(var(--muted))"
          strokeWidth={stroke}
          fill="none"
        />
        {progress !== null && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="hsl(var(--ember))"
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circ}
            initial={false}
            animate={{ strokeDashoffset: circ * (1 - progress) }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        )}
        {positionedMarkers.map((marker, idx) => {
          return (
            <circle
              key={marker.id}
              cx={marker.x}
              cy={marker.y}
              r={markerRadius}
              fill={marker.color}
              stroke="hsl(var(--background))"
              strokeWidth={1.5}
              className="cursor-pointer"
              tabIndex={0}
              onMouseEnter={() => setActiveMarkerIndex(idx)}
              onFocus={() => setActiveMarkerIndex(idx)}
              onBlur={() => setActiveMarkerIndex(null)}
              onClick={(e) => {
                e.stopPropagation();
                setActiveMarkerIndex((current) => (current === idx ? null : idx));
              }}
            >
              <title>{marker.label}</title>
            </circle>
          );
        })}
      </svg>
      {activeMarker && (
        <div
          className="pointer-events-none absolute z-20 max-w-[220px] rounded-md border border-border bg-card px-2 py-1 text-[11px] leading-snug text-foreground shadow-lg"
          style={{ left: popupLeft, top: popupTop, transform: "translate(-50%, -100%)" }}
        >
          {activeMarker.label}
        </div>
      )}
      <div className="absolute flex flex-col items-center">
        <div className="font-mono text-5xl font-semibold tabular-nums">{formatElapsed(elapsedMs)}</div>
        {targetMs !== null && progress !== null && (
          <div className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">
            {Math.round(progress * 100)}% of {targetHours}h
          </div>
        )}
      </div>
    </div>
  );
}
