import { X } from "lucide-react";
import { formatTag } from "@/lib/tags";
import { useRecentTags } from "@/hooks/useTags";
import { cn } from "@/lib/utils";

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
}

export function TagFilter({ value, onChange }: Props) {
  const recent = useRecentTags(24);
  if (recent.length === 0 && value.length === 0) return null;

  const allOptions = Array.from(new Set([...recent, ...value]));

  function toggle(tag: string) {
    if (value.includes(tag)) onChange(value.filter((t) => t !== tag));
    else onChange([...value, tag]);
  }

  return (
    <section className="space-y-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Filter by tag
          {value.length > 0 && (
            <span className="ml-1 text-ember">· any of · {value.length}</span>
          )}
        </div>
        {value.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {allOptions.map((t) => {
          const active = value.includes(t);
          return (
            <button
              key={t}
              onClick={() => toggle(t)}
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
                active
                  ? "bg-ember text-ember-foreground"
                  : "border border-border bg-background text-muted-foreground hover:border-ember/50 hover:text-foreground"
              )}
            >
              {formatTag(t)}
            </button>
          );
        })}
      </div>
    </section>
  );
}
