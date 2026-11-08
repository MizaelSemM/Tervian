"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { StageSummary } from "@/lib/dashboard";
import { formatCurrencyBR } from "@/lib/utils";

export type StageChartDatum = Pick<
  StageSummary,
  "id" | "name" | "count" | "totalValue" | "probability"
>;

const compactCurrency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--foreground)",
  fontSize: 12,
};

function chartHeight(count: number): number {
  return Math.max(180, count * 44 + 24);
}

/**
 * Gr��ficos do painel (tarefa 011).
 *
 * Recebem SOMENTE o resumo agregado por etapa. A lista crua de neg��cios fica no
 * servidor; Recharts n��o precisa dela para desenhar as barras.
 */
export function DashboardCharts({ stages }: { stages: StageChartDatum[] }) {
  const height = chartHeight(stages.length);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <p className="mb-3 text-sm font-medium">Valor por etapa</p>
        <div style={{ height }} aria-label="Gr��fico de valor por etapa do funil">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={stages}
              layout="vertical"
              margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
              accessibilityLayer
            >
              <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis
                type="number"
                tickFormatter={(value) => compactCurrency.format(Number(value))}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={108}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                contentStyle={tooltipStyle}
                formatter={(value) => [formatCurrencyBR(Number(value)), "Valor"]}
              />
              <Bar
                dataKey="totalValue"
                name="Valor"
                fill="var(--chart-2)"
                radius={[0, 4, 4, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium">Neg��cios por etapa</p>
        <div style={{ height }} aria-label="Gr��fico de quantidade de neg��cios por etapa do funil">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={stages}
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
                width={108}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                contentStyle={tooltipStyle}
                formatter={(value) => [Number(value), "Neg��cios"]}
              />
              <Bar
                dataKey="count"
                name="Neg��cios"
                fill="var(--chart-3)"
                radius={[0, 4, 4, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
