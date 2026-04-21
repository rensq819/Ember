import { FASTING_STAGES, getFastingStage } from "@/lib/fasting-stages";

interface Props {
  elapsedHours: number;
}

export function StageIndicator({ elapsedHours }: Props) {
  const stage = getFastingStage(elapsedHours);
  const next = FASTING_STAGES.find((s) => s.minHours > elapsedHours);
  const hoursToNext = next ? Math.max(0, next.minHours - elapsedHours) : null;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">Current stage</div>
      <div className="mt-1 text-lg font-semibold text-ember">{stage.label}</div>
      <p className="mt-1 text-sm text-muted-foreground">{stage.description}</p>
      {next && hoursToNext !== null && (
        <div className="mt-3 text-xs text-muted-foreground">
          Next: <span className="text-foreground">{next.label}</span> in {hoursToNext.toFixed(1)}h
        </div>
      )}
    </div>
  );
}
