import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GlucoseKetonePoint } from "@/lib/insights";
import type { GlucoseUnit } from "@/db/types";
import { mmolToMgDl } from "@/lib/gki";

const GLU_COLOR = '#9FD85A';
const KET_COLOR = '#D076B7';

interface Props {
  data: GlucoseKetonePoint[];
  unit: GlucoseUnit;
}

export function GlucoseKetoneChart({ data, unit }: Props) {
  if (data.length === 0) {
    return <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>No readings in range.</div>;
  }

  const rendered = data.map((d) => ({
    timestamp: d.timestamp,
    glucose: d.glucoseMmol !== null ? (unit === "mg/dL" ? mmolToMgDl(d.glucoseMmol) : d.glucoseMmol) : null,
    ketones: d.ketonesMmol,
  }));

  return (
    <>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={rendered} margin={{ top: 8, right: 28, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={["dataMin", "dataMax"]}
            scale="time"
            tickFormatter={(ts) => new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            stroke="hsl(var(--muted-foreground))"
            fontSize={9}
            fontFamily='"Geist Mono", monospace'
          />
          <YAxis
            yAxisId="glucose"
            stroke={GLU_COLOR}
            fontSize={9}
            fontFamily='"Geist Mono", monospace'
            width={28}
            opacity={0.8}
          />
          <YAxis
            yAxisId="ketones"
            orientation="right"
            stroke={KET_COLOR}
            fontSize={9}
            fontFamily='"Geist Mono", monospace'
            width={24}
            opacity={0.8}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 12,
              fontSize: 12,
              fontFamily: '"Geist", system-ui, sans-serif',
            }}
            labelFormatter={(ts) =>
              new Date(ts as number).toLocaleString(undefined, {
                month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
              })
            }
            formatter={(value, name) => {
              const n = typeof value === "number" ? value : null;
              if (n === null) return ["—", String(name)];
              if (name === "glucose") return [`${n.toFixed(1)} ${unit}`, "Glucose"];
              return [`${n.toFixed(2)} mmol/L`, "Ketones"];
            }}
          />
          <Line yAxisId="glucose" type="monotone" dataKey="glucose" stroke={GLU_COLOR} strokeWidth={1.8} dot={{ r: 2, fill: GLU_COLOR, strokeWidth: 0 }} connectNulls isAnimationActive={false} />
          <Line yAxisId="ketones" type="monotone" dataKey="ketones" stroke={KET_COLOR} strokeWidth={1.8} dot={{ r: 2, fill: KET_COLOR, strokeWidth: 0 }} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', gap: 14, marginTop: 6, paddingLeft: 12 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: GLU_COLOR, fontFamily: '"Geist", system-ui, sans-serif' }}>
          <svg width="6" height="6"><circle cx="3" cy="3" r="3" fill={GLU_COLOR}/></svg>Glucose
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: KET_COLOR, fontFamily: '"Geist", system-ui, sans-serif' }}>
          <svg width="6" height="6"><circle cx="3" cy="3" r="3" fill={KET_COLOR}/></svg>Ketones
        </span>
      </div>
    </>
  );
}
