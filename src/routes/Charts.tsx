import { useMemo, useState } from "react";
import { useMetabolicLogs, useSettings } from "@/hooks/useLogs";
import { useFastHistory } from "@/hooks/useFasts";
import {
  computeDigest,
  filterByRange,
  filterByTags,
  toFastBars,
  toGkiSeries,
  toGlucoseKetoneSeries,
} from "@/lib/insights";
import { TagFilter } from "@/components/charts/TagFilter";
import { GkiChart } from "@/components/charts/GkiChart";
import { GlucoseKetoneChart } from "@/components/charts/GlucoseKetoneChart";
import { FastDurationChart } from "@/components/charts/FastDurationChart";

function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function ChartsRoute() {
  const [days, setDays] = useState(30);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const metabolic = useMetabolicLogs(5000);
  const fasts = useFastHistory(500);
  const settings = useSettings();

  const metabolicInRange = useMemo(() => filterByRange(metabolic ?? [], days, (m) => m.timestamp), [metabolic, days]);
  const metabolicFiltered = useMemo(() => filterByTags(metabolicInRange, activeTags), [metabolicInRange, activeTags]);
  const fastsInRange = useMemo(() => filterByRange(fasts ?? [], days, (f) => f.startedAt), [fasts, days]);

  const digest = useMemo(() => computeDigest(metabolicFiltered, fastsInRange), [metabolicFiltered, fastsInRange]);
  const gkiSeries = useMemo(() => toGkiSeries(metabolicFiltered), [metabolicFiltered]);
  const gkSeries = useMemo(() => toGlucoseKetoneSeries(metabolicFiltered), [metabolicFiltered]);
  const fastBars = useMemo(() => toFastBars(fastsInRange), [fastsInRange]);

  const trendColor = digest.gkiTrend === 'improving' ? '#A5B77A' : digest.gkiTrend === 'worsening' ? '#B97A63' : 'hsl(var(--muted-foreground))';
  const trendArrow = digest.gkiTrend === 'improving' ? '↘' : digest.gkiTrend === 'worsening' ? '↗' : '→';

  return (
    <div className="mx-auto max-w-md">
      {/* Editorial header */}
      <div className="px-6" style={{ paddingTop: 64 }}>
        <div className="text-xs font-semibold tracking-[2.4px] uppercase" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Phase 03 · See
        </div>
        <h1 className="font-display" style={{ fontWeight: 400, fontSize: 44, letterSpacing: -1.2, margin: '8px 0 0', lineHeight: 1 }}>
          Patterns in <em style={{ fontStyle: 'italic', color: '#A5B77A' }}>motion.</em>
        </h1>

        {/* Range toggle */}
        <div style={{ marginTop: 22, display: 'flex', gap: 4, padding: 4, borderRadius: 999, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', width: 'fit-content' }}>
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)} style={{
              padding: '7px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
              background: days === d ? 'hsl(var(--foreground))' : 'transparent',
              color: days === d ? 'hsl(var(--background))' : 'hsl(var(--muted-foreground))',
              fontFamily: '"Geist Mono", monospace', fontSize: 12, fontFeatureSettings: '"tnum"',
            }}>{d}d</button>
          ))}
        </div>
      </div>

      {/* Tag filter */}
      <div className="px-6" style={{ paddingTop: 14 }}>
        <TagFilter value={activeTags} onChange={setActiveTags} />
      </div>

      {/* Digest hero card */}
      <div className="px-6" style={{ paddingTop: 18 }}>
        <div style={{
          borderRadius: 24, padding: '20px 22px',
          background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* glow corner */}
          <div style={{
            position: 'absolute', top: -40, right: -40, width: 180, height: 180,
            borderRadius: '50%', background: `radial-gradient(circle, ${hexA('#F5A64A', 0.12)} 0%, transparent 70%)`,
            pointerEvents: 'none',
          }} />
          <div className="text-xs font-semibold tracking-[1.6px] uppercase" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Last {days} days · digest
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span className="font-display" style={{ fontSize: 64, letterSpacing: -2, lineHeight: 0.9 }}>
              {digest.avgGki != null ? digest.avgGki.toFixed(1) : '—'}
            </span>
            <span className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>avg GKI</span>
            {digest.gkiTrend && (
              <span style={{ marginLeft: 6, padding: '3px 10px', borderRadius: 999, fontSize: 11, color: trendColor, background: hexA(trendColor, 0.12), letterSpacing: 0.5 }}>
                {trendArrow} {digest.gkiTrend}
              </span>
            )}
          </div>
          <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, paddingTop: 16, borderTop: '1px solid hsl(var(--border))' }}>
            {[
              { label: 'Total fasting', value: `${Math.round(digest.fastingHours)}h` },
              { label: 'Longest fast',  value: `${Math.round(digest.longestFastHours)}h` },
              { label: 'Readings',      value: String(digest.readingCount) },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-xs tracking-[1.2px] uppercase" style={{ color: 'hsl(var(--muted-foreground))' }}>{label}</div>
                <div className="font-mono mt-0.5" style={{ fontSize: 20, letterSpacing: -0.5, fontFeatureSettings: '"tnum"' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* GKI chart card */}
      <ChartCard eyebrow="GKI" title="Glucose · Ketone index" subtitle="Shaded band: 3–6 optimal zone." accent="#C89079">
        <GkiChart data={gkiSeries} />
      </ChartCard>

      {/* Glucose / Ketone chart */}
      <ChartCard eyebrow="Metabolic" title="Glucose & ketones" subtitle="Two rhythms, one canvas." accent="#D076B7">
        <GlucoseKetoneChart data={gkSeries} unit={settings.glucoseUnit} />
      </ChartCard>

      {activeTags.length > 0 && (
        <p className="px-6 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Tag filter applies to metabolic readings only. Fasting chart shows all fasts in range.
        </p>
      )}

      {/* Fast duration chart */}
      <ChartCard eyebrow="Duration" title="Fasts" subtitle="Amber = hit target · muted = short." accent="#D1B894">
        <FastDurationChart data={fastBars} />
      </ChartCard>
    </div>
  );
}

function ChartCard({ eyebrow, title, subtitle, accent, children }: {
  eyebrow: string; title: string; subtitle?: string; accent: string; children: React.ReactNode;
}) {
  return (
    <div className="px-6" style={{ paddingTop: 18 }}>
      <div style={{
        borderRadius: 22, padding: '18px 18px 12px',
        background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
      }}>
        <div style={{ marginBottom: 12 }}>
          <div className="text-xs font-semibold tracking-[1.6px] uppercase" style={{ color: accent }}>{eyebrow}</div>
          <div className="font-display mt-0.5" style={{ fontSize: 22, letterSpacing: -0.4, lineHeight: 1 }}>{title}</div>
          {subtitle && <div className="text-xs mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>{subtitle}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}
