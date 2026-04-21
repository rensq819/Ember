import { useMemo } from "react";
import { getStageColor, hexA, STAGE_ORDER } from "@/lib/stage-palette";

interface EmberFlameProps {
  stageKey: string;
  progress: number; // 0–1
  size?: number;
  isDark?: boolean;
}

export function EmberFlame({ stageKey, progress, size = 260, isDark = true }: EmberFlameProps) {
  const stage = getStageColor(stageKey);
  const stroke = 3;
  const r = (size - stroke) / 2 - 14;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.max(0, Math.min(1, progress));

  const stageIndex = STAGE_ORDER.indexOf(stageKey as typeof STAGE_ORDER[number]);
  const breathDur = 3 + stageIndex * 0.4;

  const hairline = isDark ? 'rgba(237,232,222,0.08)' : 'rgba(32,28,22,0.10)';

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {/* ambient halo */}
      <div style={{
        position: 'absolute',
        inset: -size * 0.15,
        background: `radial-gradient(circle at 50% 50%, ${hexA(stage.glow, 0.35)} 0%, ${hexA(stage.glow, 0.08)} 35%, transparent 65%)`,
        filter: 'blur(20px)',
        animation: `ember-breath ${breathDur}s ease-in-out infinite`,
        pointerEvents: 'none',
      }} />

      <svg
        width={size} height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ position: 'relative' }}
      >
        <defs>
          <radialGradient id={`ember-core-${stageKey}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={stage.glow} stopOpacity="0.9" />
            <stop offset="45%"  stopColor={stage.base} stopOpacity="0.55" />
            <stop offset="100%" stopColor={stage.deep} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`ember-arc-${stageKey}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor={stage.glow} />
            <stop offset="100%" stopColor={stage.base} />
          </linearGradient>
          <filter id={`ember-blur-${stageKey}`}>
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
        </defs>

        {/* track */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={hairline} strokeWidth={stroke} fill="none"
        />

        {/* progress arc — blurred for glow */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={`url(#ember-arc-${stageKey})`}
          strokeWidth={stroke} strokeLinecap="round" fill="none"
          strokeDasharray={`${dash} ${circ}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)' }}
          filter={`url(#ember-blur-${stageKey})`}
        />
        {/* crisp overlay */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={`url(#ember-arc-${stageKey})`}
          strokeWidth={stroke} strokeLinecap="round" fill="none"
          strokeDasharray={`${dash} ${circ}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)' }}
        />

        {/* glowing core */}
        <circle
          cx={size / 2} cy={size / 2} r={r - 10}
          fill={`url(#ember-core-${stageKey})`}
          style={{
            transformOrigin: 'center',
            animation: `ember-pulse ${breathDur * 1.3}s ease-in-out infinite`,
          }}
        />
      </svg>

      {stageKey !== 'fed' && <EmberSparks color={stage.glow} size={size} breathDur={breathDur} />}
    </div>
  );
}

function EmberSparks({ color, size, breathDur }: { color: string; size: number; breathDur: number }) {
  const sparks = useMemo(() =>
    Array.from({ length: 6 }).map((_, i) => {
      const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.8;
      const dist = 40 + Math.random() * 60;
      return {
        id: i,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist - 30,
        delay: Math.random() * 4,
        dur: 3 + Math.random() * 2,
        s: 2 + Math.random() * 2,
      };
    }),
  []);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {sparks.map((s) => (
        <span
          key={s.id}
          style={{
            position: 'absolute',
            left: '50%', top: '50%',
            width: s.s, height: s.s,
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 ${s.s * 3}px ${color}`,
            animation: `ember-spark ${s.dur}s ease-out ${s.delay}s infinite`,
            '--spark-dx': `${s.dx}px`,
            '--spark-dy': `${s.dy}px`,
          } as React.CSSProperties}
        />
      ))}
      {/* suppress unused var warning */}
      <style>{`/* breathDur=${breathDur} */`}</style>
    </div>
  );
}
