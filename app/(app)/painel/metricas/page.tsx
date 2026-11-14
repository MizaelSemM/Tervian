import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { withAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";
import { getProductMetrics, type ProductMetrics } from "@/server/services/metrics";

export const metadata = { title: "Métricas de produto — Tervian" };

type Metric = {
  label: string;
  value: string;
  detail: string;
  target: string;
  ok: boolean | null;
};

function buildMetrics(metrics: ProductMetrics): Metric[] {
  return [
    {
      label: "Vendedores ativos",
      value: `${metrics.activeSellers.percent}%`,
      detail: `${metrics.activeSellers.active} de ${metrics.activeSellers.total} usuários ativos nos últimos 7 dias`,
      target: "meta ≥ 70% em dias úteis",
      ok: metrics.activeSellers.percent >= 70,
    },
    {
      label: "Negócios com próxima ação",
      value: `${metrics.dealsWithNextAction.percent}%`,
      detail: `${metrics.dealsWithNextAction.withNextAction} de ${metrics.dealsWithNextAction.open} negócios abertos`,
      target: "meta ≥ 90%",
      ok: metrics.dealsWithNextAction.percent >= 90,
    },
    {
      label: "Tarefas do dia concluídas",
      value: `${metrics.todayTasks.percent}%`,
      detail: `${metrics.todayTasks.completed} de ${metrics.todayTasks.due} tarefas de hoje`,
      target: "meta ≥ 60%",
      ok: metrics.todayTasks.percent >= 60,
    },
    {
      label: "Tempo de cadastro de lead",
      value: metrics.leadMedianSeconds === null ? "—" : `${metrics.leadMedianSeconds}s`,
      detail:
        metrics.leadMedianSeconds === null
          ? "Nenhum lead com tempo medido nos últimos 30 dias"
          : "mediana dos leads capturados nos últimos 30 dias",
      target: "meta < 20s",
      ok: metrics.leadMedianSeconds === null ? null : metrics.leadMedianSeconds < 20,
    },
    {
      label: "Negócios parados (7+ dias)",
      value: String(metrics.stalledDeals),
      detail: "negócios abertos sem atividade na última semana",
      target: "meta: reduzir 50% vs. baseline",
      ok: null,
    },
    {
      label: "Conversão (90 dias)",
      value: `${metrics.conversion.percent}%`,
      detail: `${metrics.conversion.won} ganhos de ${metrics.conversion.closed} negócios fechados`,
      target: "comparar com o baseline do piloto",
      ok: null,
    },
  ];
}

/** Métricas de produto do PRD — leitura rápida no dia 1 do piloto (013). */
export default async function ProductMetricsPage() {
  return withAdmin(async () => {
    const metrics = await getProductMetrics();
    const cards = buildMetrics(metrics);

    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div>
          <Link
            href="/painel"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4" />
            Voltar ao painel
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Métricas de produto</h1>
          <p className="text-sm text-muted-foreground">
            As 6 métricas internas do PRD, calculadas a partir dos dados desta conta (não dependem
            de ferramenta externa).
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((metric) => (
            <Card key={metric.label}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardDescription>{metric.label}</CardDescription>
                  {metric.ok !== null && (
                    <Badge
                      variant={metric.ok ? "secondary" : "destructive"}
                      className={cn(
                        metric.ok &&
                          "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                      )}
                    >
                      {metric.ok ? "na meta" : "atenção"}
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-3xl tabular-nums">{metric.value}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">{metric.detail}</p>
                <p className="text-xs font-medium text-muted-foreground">{metric.target}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Janela de atividade: 7 dias · conversão: 90 dias · leads: 30 dias. Os eventos brutos
          também são enviados ao PostHog quando configurado.
        </p>
      </div>
    );
  });
}
