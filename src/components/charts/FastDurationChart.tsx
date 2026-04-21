import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FastBar } from "@/lib/insights";

const HIT_COLOR = '#F5A64A';

interface Props {
  data: FastBar[];
}

export function FastDurationChart({ data }: Props) {
  if (data.length === 0) {
    return <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>No completed fasts in range.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="startedAt"
          type="number"
          domain={["dataMin", "dataMax"]}
          scale="time"
          tickFormatter={(ts) => new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          stroke="hsl(var(--muted-foreground))"
          fontSize={9}
          fontFamily='"Geist Mono", monospace'
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={9}
          fontFamily='"Geist Mono", monospace'
          width={28}
          unit="h"
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
            new Date(ts as number).toLocaleDateString(undefined, { month: "short", day: "numeric" })
          }
          formatter={(v: number) => [`${v.toFixed(1)} h`, "Duration"]}
        />
        <Bar dataKey="hours" radius={[3, 3, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.hitTarget ? HIT_COLOR : 'hsl(var(--muted-foreground) / 0.2)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
