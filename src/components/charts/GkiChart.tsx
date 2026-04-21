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
import { ChartCard } from "./ChartCard";

interface Props {
  data: GkiPoint[];
}

export function GkiChart({ data }: Props) {
  if (data.length === 0) {
    return <ChartCard title="GKI trend" empty="No paired glucose + ketone readings yet." />;
  }

  const maxY = Math.max(9, ...data.map((d) => d.gki)) * 1.1;

  return (
    <ChartCard title="GKI trend" hint="Lower is deeper ketosis. Band = optimal (1–6).">
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <ReferenceArea y1={1} y2={6} fill="hsl(var(--ember))" fillOpacity={0.08} />
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={["dataMin", "dataMax"]}
            scale="time"
            tickFormatter={(ts) => new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            stroke="hsl(var(--muted-foreground))"
            fontSize={10}
          />
          <YAxis
            domain={[0, maxY]}
            stroke="hsl(var(--muted-foreground))"
            fontSize={10}
            width={32}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.5rem",
              fontSize: "12px",
            }}
            labelFormatter={(ts) =>
              new Date(ts as number).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })
            }
            formatter={(v: number) => [v.toFixed(2), "GKI"]}
          />
          <Line
            type="monotone"
            dataKey="gki"
            stroke="hsl(var(--ember))"
            strokeWidth={2}
            dot={{ r: 3, fill: "hsl(var(--ember))" }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
