import { ArrowDownRight, ArrowRight, ArrowUpRight, Clock, Flame, Gauge, TrendingUp } from "lucide-react";
import type { Digest } from "@/lib/insights";
import { cn } from "@/lib/utils";

interface Props {
  digest: Digest;
  days: number;
}

export function DigestCard({ digest, days }: Props) {
  const trendIcon =
    digest.gkiTrend === "improving" ? (
      <ArrowDownRight className="h-4 w-4 text-emerald-400" />
    ) : digest.gkiTrend === "worsening" ? (
      <ArrowUpRight className="h-4 w-4 text-rose-400" />
    ) : digest.gkiTrend === "flat" ? (
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    ) : null;

  const trendLabel =
    digest.gkiTrend === "improving"
      ? "improving"
      : digest.gkiTrend === "worsening"
      ? "rising"
      : digest.gkiTrend === "flat"
      ? "stable"
      : null;

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Last {days} days</h2>
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stat
          icon={<Gauge className="h-4 w-4" />}
          label="Avg GKI"
          value={digest.avgGki !== null ? digest.avgGki.toFixed(2) : "—"}
          hint={trendLabel ? <span className="flex items-center gap-0.5">{trendIcon}{trendLabel}</span> : `${digest.readingCount} readings`}
        />
        <Stat
          icon={<Clock className="h-4 w-4" />}
          label="Fasting hours"
          value={digest.fastingHours.toFixed(1)}
          hint={`${digest.fastCount} fast${digest.fastCount === 1 ? "" : "s"}`}
        />
        <Stat
          icon={<Flame className="h-4 w-4" />}
          label="Longest fast"
          value={`${digest.longestFastHours.toFixed(1)}h`}
          hint={digest.longestFastHours >= 48 ? "autophagy zone" : digest.longestFastHours >= 24 ? "deep ketosis" : "—"}
        />
        <Stat
          icon={<Gauge className="h-4 w-4" />}
          label="Readings"
          value={String(digest.readingCount)}
          hint={digest.readingCount > 0 ? `${(digest.readingCount / days).toFixed(1)}/day avg` : "none yet"}
        />
      </div>
    </section>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-background p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className={cn("mt-1 font-mono text-xl font-semibold tabular-nums")}>{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}
