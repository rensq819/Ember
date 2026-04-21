import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GkiPoint } from "@/lib/insights";

const GKI_COLOR = '#F08A3B';

interface Props {
  data: GkiPoint[];
}

export function GkiChart({ data }: Props) {
  if (data.length === 0) {
    return <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>No paired glucose + ketone readings yet.</div>;
  }

  const maxY = Math.max(9, ...data.map((d) => d.gki)) * 1.1;

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <ReferenceArea y1={1} y2={6} fill={GKI_COLOR} fillOpacity={0.08} />
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
          domain={[0, maxY]}
          stroke="hsl(var(--muted-foreground))"
          fontSize={9}
          fontFamily='"Geist Mono", monospace'
          width={28}
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
          formatter={(v: number) => [v.toFixed(2), "GKI"]}
        />
        <Line
          type="monotone"
          dataKey="gki"
          stroke={GKI_COLOR}
          strokeWidth={1.8}
          dot={{ r: 2.5, fill: GKI_COLOR, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
