import { motion } from "framer-motion";
import { formatElapsed } from "@/lib/format";

interface Props {
  elapsedMs: number;
  targetHours: number | null;
}

export function TimerDisplay({ elapsedMs, targetHours }: Props) {
  const targetMs = targetHours !== null ? targetHours * 3_600_000 : null;
  const progress = targetMs !== null ? Math.min(elapsedMs / targetMs, 1) : null;

  const size = 260;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
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
      </svg>
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
