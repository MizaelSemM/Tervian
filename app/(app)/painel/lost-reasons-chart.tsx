"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatCurrencyBR } from "@/lib/utils";

export type LostReasonChartDatum = {
  name: string;
  count: number;
  totalValue: number;
};

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--foreground)",
  fontSize: 12,
};

/**
 * Ranking de motivos de perda no período (RF-53).
 *
 * O servidor manda só o agregado (motivo, quantidade e valor); o Recharts não
 * recebe nome de contato nem negócio individual.
 */
export function LostReasonsChart({ reasons }: { reasons: LostReasonChartDatum[] }) {
  const height = Math.max(160, reasons.length * 36 + 24);

  return (
    <div style={{ height }} aria-label="Gráfico de motivos de perda no período">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={reasons}
          layout="vertical"
          margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
          accessibilityLayer
        >
          <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            type="number"
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={132}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
            contentStyle={tooltipStyle}
            formatter={(value, _name, item) => [
              `${Number(value)} ${Number(value) === 1 ? "negócio" : "negócios"}, ${formatCurrencyBR(
                item?.payload?.totalValue ?? 0,
              )}`,
              "Perdidos",
            ]}
          />
          <Bar
            dataKey="count"
            name="Perdidos"
            fill="var(--chart-4)"
            radius={[0, 4, 4, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
