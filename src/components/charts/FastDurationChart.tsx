import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FastBar } from "@/lib/insights";
import { ChartCard } from "./ChartCard";

interface Props {
  data: FastBar[];
}

export function FastDurationChart({ data }: Props) {
  if (data.length === 0) {
    return <ChartCard title="Fasting duration" empty="No completed fasts in range." />;
  }

  return (
    <ChartCard title="Fasting duration" hint="Orange bars hit target; gray fell short.">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="startedAt"
            type="number"
            domain={["dataMin", "dataMax"]}
            scale="time"
            tickFormatter={(ts) => new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            stroke="hsl(var(--muted-foreground))"
            fontSize={10}
          />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} width={32} unit="h" />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.5rem",
              fontSize: "12px",
            }}
            labelFormatter={(ts) =>
              new Date(ts as number).toLocaleDateString(undefined, { month: "short", day: "numeric" })
            }
            formatter={(v: number) => [`${v.toFixed(1)} h`, "Duration"]}
          />
          <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.hitTarget ? "hsl(var(--ember))" : "hsl(var(--muted))"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
