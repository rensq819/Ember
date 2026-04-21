import type { ReactNode } from "react";

interface Props {
  title: string;
  hint?: string;
  empty?: string;
  children?: ReactNode;
}

export function ChartCard({ title, hint, empty, children }: Props) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <header className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{hint}</span>}
      </header>
      {empty ? (
        <div className="py-10 text-center text-xs text-muted-foreground">{empty}</div>
      ) : (
        children
      )}
    </section>
  );
}
