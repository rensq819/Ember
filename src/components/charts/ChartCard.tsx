import type { ReactNode } from "react";

interface Props {
  title: string;
  hint?: string;
  empty?: string;
  children?: ReactNode;
}

export function ChartCard({ title, hint, empty, children }: Props) {
  return (
    <section style={{ borderRadius: 18, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', padding: '14px 16px 10px' }}>
      <header style={{ marginBottom: 10, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h3 style={{ fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 18, fontWeight: 400, letterSpacing: -0.3, lineHeight: 1, margin: 0 }}>{title}</h3>
        {hint && <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'hsl(var(--muted-foreground))' }}>{hint}</span>}
      </header>
      {empty ? (
        <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>{empty}</div>
      ) : (
        children
      )}
    </section>
  );
}
