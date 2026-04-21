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
import { ChartCard } from "./ChartCard";

interface Props {
  data: GlucoseKetonePoint[];
  unit: GlucoseUnit;
}

export function GlucoseKetoneChart({ data, unit }: Props) {
  if (data.length === 0) {
    return <ChartCard title="Glucose + ketones" empty="No readings in range." />;
  }

  const rendered = data.map((d) => ({
    timestamp: d.timestamp,
    glucose: d.glucoseMmol !== null ? (unit === "mg/dL" ? mmolToMgDl(d.glucoseMmol) : d.glucoseMmol) : null,
    ketones: d.ketonesMmol,
  }));

  return (
    <ChartCard title="Glucose + ketones" hint={`Dual axis · glucose ${unit} · ketones mmol/L`}>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={rendered} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
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
            yAxisId="glucose"
            stroke="#60a5fa"
            fontSize={10}
            width={32}
          />
          <YAxis
            yAxisId="ketones"
            orientation="right"
            stroke="hsl(var(--ember))"
            fontSize={10}
            width={28}
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
            formatter={(value, name) => {
              const n = typeof value === "number" ? value : null;
              if (n === null) return ["—", String(name)];
              if (name === "glucose") return [`${n.toFixed(1)} ${unit}`, "Glucose"];
              return [`${n.toFixed(2)} mmol/L`, "Ketones"];
            }}
          />
          <Line
            yAxisId="glucose"
            type="monotone"
            dataKey="glucose"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={{ r: 2, fill: "#60a5fa" }}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            yAxisId="ketones"
            type="monotone"
            dataKey="ketones"
            stroke="hsl(var(--ember))"
            strokeWidth={2}
            dot={{ r: 2, fill: "hsl(var(--ember))" }}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
