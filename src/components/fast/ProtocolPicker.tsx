import type { FastingProtocol } from "@/db/types";
import { PROTOCOLS } from "@/lib/protocols";
import { cn } from "@/lib/utils";

interface Props {
  value: FastingProtocol;
  onChange: (key: FastingProtocol) => void;
}

export function ProtocolPicker({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">Protocol</div>
      <div className="grid grid-cols-2 gap-2">
        {PROTOCOLS.map((p) => (
          <button
            key={p.key}
            onClick={() => onChange(p.key)}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors",
              value === p.key
                ? "border-ember bg-ember/10"
                : "border-border bg-card hover:border-muted-foreground/40"
            )}
          >
            <div className="text-sm font-semibold">{p.label}</div>
            <div className="mt-1 text-xs text-muted-foreground">{p.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
