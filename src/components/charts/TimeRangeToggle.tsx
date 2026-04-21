import { cn } from "@/lib/utils";

const RANGES = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
];

interface Props {
  value: number;
  onChange: (days: number) => void;
}

export function TimeRangeToggle({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-card p-1">
      {RANGES.map((r) => (
        <button
          key={r.days}
          onClick={() => onChange(r.days)}
          className={cn(
            "rounded-md py-1.5 text-xs font-medium transition-colors",
            value === r.days
              ? "bg-ember text-ember-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
