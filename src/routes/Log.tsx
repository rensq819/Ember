import { useState } from "react";
import { GlucoseKetoneForm } from "@/components/log/GlucoseKetoneForm";
import { ElectrolyteForm } from "@/components/log/ElectrolyteForm";
import { LogHistory } from "@/components/log/LogHistory";
import { CsvImportButton } from "@/components/log/CsvImportButton";
import { useElectrolyteLogs, useMetabolicLogs } from "@/hooks/useLogs";
import { cn } from "@/lib/utils";

type Tab = "metabolic" | "electrolyte";

export function LogRoute() {
  const [tab, setTab] = useState<Tab>("metabolic");
  const metabolic = useMetabolicLogs(50);
  const electrolyte = useElectrolyteLogs(50);

  return (
    <div className="mx-auto max-w-md space-y-6 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Log</h1>
        <p className="text-xs text-muted-foreground">Tap a tab to record, scroll for history.</p>
      </header>

      <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-card p-1">
        {(["metabolic", "electrolyte"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-md py-2 text-sm font-medium transition-colors",
              tab === t ? "bg-ember text-ember-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "metabolic" ? "Glucose · Ketones" : "Electrolytes"}
          </button>
        ))}
      </div>

      {tab === "metabolic" ? (
        <div className="space-y-4">
          <GlucoseKetoneForm />
          <CsvImportButton />
        </div>
      ) : (
        <ElectrolyteForm />
      )}

      <section className="space-y-2 pt-2">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground">History</h2>
        <LogHistory metabolic={metabolic} electrolyte={electrolyte} />
      </section>
    </div>
  );
}
