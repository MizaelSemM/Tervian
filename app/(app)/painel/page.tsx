import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CalendarClockIcon,
  CircleCheckIcon,
  ClockIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DASHBOARD_PERIODS,
  DASHBOARD_PERIOD_LABELS,
  STALLED_DAY_OPTIONS,
  type DashboardPeriod,
} from "@/lib/dashboard";
import { withAdmin, type AuthedSession } from "@/lib/session";
import { cn, formatCurrencyBR, formatDateBR } from "@/lib/utils";
import {
  getDashboard,
  type DashboardData,
  type DashboardDealItem,
} from "@/server/services/dashboard";
import type { ActingUser } from "@/server/services/owners";

import { DashboardCharts } from "./dashboard-charts";

export const metadata = { title: "Painel — Tervian" };

type PainelSearchParams = {
  periodo?: string;
  dias?: string;
  vendedor?: string;
};

function actingUserFrom(session: AuthedSession): ActingUser {
  return {
    id: session.user.id,
    role: session.user.role === "ADMIN" ? "ADMIN" : "SELLER",
  };
}

function dashboardHref(
  current: { period: DashboardPeriod; days: number; sellerId: string | null },
  overrides: { period?: DashboardPeriod; days?: number; sellerId?: string | null } = {},
): string {
  const params = new URLSearchParams();
  const period = overrides.period ?? current.period;
  const days = overrides.days ?? current.days;
  const sellerId = overrides.sellerId === undefined ? current.sellerId : overrides.sellerId;

  params.set("periodo", period);
  params.set("dias", String(days));
  if (sellerId) params.set("vendedor", sellerId);
  return `/painel?${params.toString()}`;
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  tone = "default",
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint: string;
  tone?: "default" | "warning" | "danger" | "success";
  href?: string;
}) {
  const content = (
    <Card size="sm" className="h-full">
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </p>
          <span
            className={cn(
              "text-muted-foreground",
              tone === "warning" && "text-amber-600 dark:text-amber-400",
              tone === "danger" && "text-destructive",
              tone === "success" && "text-emerald-600 dark:text-emerald-400",
            )}
          >
            {icon}
          </span>
        </div>
        <p
          className={cn(
            "text-2xl font-semibold tracking-tight",
            tone === "danger" && "text-destructive",
            tone === "warning" && "text-amber-700 dark:text-amber-400",
          )}
        >
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );

  if (!href) return content;
  return (
    <Link
      href={href}
      className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {content}
    </Link>
  );
}

function DealMiniList({
  deals,
  total,
  emptyMessage,
  mode = "stalled",
}: {
  deals: DashboardDealItem[];
  total: number;
  emptyMessage: string;
  mode?: "stalled" | "no-next-action";
}) {
  if (deals.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-lg bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
        <CircleCheckIcon className="size-4 shrink-0" />
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {deals.map((deal) => (
          <li
            key={deal.id}
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-border px-3 py-2"
          >
            <div className="min-w-0">
              <Link href={`/negocios/${deal.id}`} className="text-sm font-medium hover:underline">
                {deal.title}
              </Link>
              <p className="text-xs text-muted-foreground">
                {deal.contact.name} · {deal.stageName} · {deal.owner.name}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium">{formatCurrencyBR(deal.value)}</p>
              {mode === "no-next-action" ? (
                <Badge variant="destructive">Sem próxima ação</Badge>
              ) : (
                <Badge variant="secondary">
                  {deal.idleDays} {deal.idleDays === 1 ? "dia parado" : "dias parado"}
                </Badge>
              )}
            </div>
          </li>
        ))}
      </ul>
      {total > deals.length && (
        <p className="text-xs text-muted-foreground">
          Mostrando os {deals.length} mais críticos de {total}.
        </p>
      )}
    </div>
  );
}

function SellerTable({
  data,
  current,
}: {
  data: DashboardData;
  current: { period: DashboardPeriod; days: number; sellerId: string | null };
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="pb-2 font-medium">Vendedor(a)</th>
            <th className="pb-2 text-right font-medium">Concluídas (7 dias)</th>
            <th className="pb-2 text-right font-medium">Atrasadas agora</th>
            <th className="pb-2 text-right font-medium">Abertas</th>
          </tr>
        </thead>
        <tbody>
          {data.sellers.map((seller) => {
            const selected = data.selectedSeller?.id === seller.id;
            return (
              <tr
                key={seller.id}
                className={cn("border-b border-border/60 last:border-0", selected && "bg-muted/50")}
              >
                <td className="py-2.5">
                  <Link
                    href={dashboardHref(current, { sellerId: seller.id })}
                    className="font-medium hover:underline"
                    aria-current={selected ? "true" : undefined}
                  >
                    {seller.name}
                  </Link>
                </td>
                <td className="py-2.5 text-right tabular-nums">{seller.completedInWeek}</td>
                <td className="py-2.5 text-right">
                  {seller.overdue > 0 ? (
                    <Badge variant="destructive">{seller.overdue}</Badge>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </td>
                <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                  {seller.openTasks}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<PainelSearchParams>;
}) {
  const params = await searchParams;

  return withAdmin(async (session) => {
    const data = await getDashboard({
      actingUser: actingUserFrom(session),
      period: params.periodo,
      stalledDays: params.dias,
      sellerId: params.vendedor,
    });

    const current = {
      period: data.period.period,
      days: data.stalledDays,
      sellerId: data.selectedSeller?.id ?? null,
    };

    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Visão do gestor
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">Painel</h1>
            <p className="text-sm text-muted-foreground">
              Em 30 segundos: quanto há no funil, o que está parado e quem precisa de atenção.
            </p>
          </div>
          <Link href="/painel/carteira" className={buttonVariants({ size: "lg" })}>
            Gerenciar carteira
            <ArrowRightIcon className="size-4" />
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-border p-1">
            {DASHBOARD_PERIODS.map((period) => (
              <Link
                key={period}
                href={dashboardHref(current, { period })}
                aria-current={current.period === period ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors",
                  current.period === period
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {DASHBOARD_PERIOD_LABELS[period]}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-border p-1">
            <span className="px-2 text-xs text-muted-foreground">Parados há</span>
            {STALLED_DAY_OPTIONS.map((days) => (
              <Link
                key={days}
                href={dashboardHref(current, { days })}
                aria-current={current.days === days ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center justify-center rounded-md px-2.5 text-sm font-medium transition-colors",
                  current.days === days
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {days}+
              </Link>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            {data.period.label}: {data.period.start} a {data.period.end}
          </p>
        </div>

        {data.isEmpty && (
          <Card className="border border-dashed border-border bg-muted/30">
            <CardContent className="flex flex-col items-start gap-2 py-5">
              <p className="font-medium">Seu funil está vazio.</p>
              <p className="text-sm text-muted-foreground">
                Cadastre um lead para criar o primeiro negócio e a primeira ação de follow-up.
                {!data.hasTeam && " Se houver mais gente no time, convide os vendedores."}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link href="/contatos/novo" className={buttonVariants({ size: "sm" })}>
                  Cadastrar lead
                </Link>
                {!data.hasTeam && (
                  <Link
                    href="/equipe"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Convidar equipe
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            icon={<WalletIcon className="size-4" />}
            label="No funil"
            value={data.totals.openDeals}
            hint={`${formatCurrencyBR(data.totals.pipelineValue)} em negócios abertos`}
          />
          <KpiCard
            icon={<TrendingUpIcon className="size-4" />}
            label="Previsão de receita"
            value={formatCurrencyBR(data.totals.forecast)}
            hint="Σ valor × probabilidade da etapa"
          />
          <KpiCard
            icon={<ClockIcon className="size-4" />}
            label="Parados"
            value={data.totals.stalled}
            hint={`Sem atividade há ${data.stalledDays}+ dias`}
            tone={data.totals.stalled > 0 ? "warning" : "success"}
            href="#parados"
          />
          <KpiCard
            icon={<AlertTriangleIcon className="size-4" />}
            label="Sem próxima ação"
            value={data.totals.withoutNextAction}
            hint="Deveria ser zero — exige correção"
            tone={data.totals.withoutNextAction > 0 ? "danger" : "success"}
            href="#sem-proxima-acao"
          />
          <KpiCard
            icon={<CalendarClockIcon className="size-4" />}
            label="Tarefas atrasadas"
            value={data.totals.overdueTasks}
            hint="Vencidas e ainda abertas"
            tone={data.totals.overdueTasks > 0 ? "warning" : "success"}
          />
        </div>

        <Card size="sm">
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Novos negócios no período</p>
              <p className="text-lg font-semibold">{data.period.newDeals}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ganhos no período</p>
              <p className="text-lg font-semibold">
                {data.period.wonDeals}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  ({formatCurrencyBR(data.period.wonValue)})
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tarefas concluídas no período</p>
              <p className="text-lg font-semibold">{data.period.completedTasks}</p>
            </div>
          </CardContent>
        </Card>

        {data.totals.withoutNextAction > 0 && (
          <Card id="sem-proxima-acao" className="ring-destructive/40" role="alert">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangleIcon className="size-5" />
                {data.totals.withoutNextAction}{" "}
                {data.totals.withoutNextAction === 1
                  ? "negócio aberto sem próxima ação"
                  : "negócios abertos sem próxima ação"}
              </CardTitle>
              <CardDescription>
                Alerta operacional: todo negócio aberto deve ter uma tarefa de follow-up agendada.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DealMiniList
                deals={data.withoutNextActionDeals}
                total={data.totals.withoutNextAction}
                emptyMessage="Nenhum negócio sem próxima ação."
                mode="no-next-action"
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Funil por etapa</CardTitle>
            <CardDescription>
              Valor e quantidade de negócios abertos. A previsão usa a probabilidade de cada etapa.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <DashboardCharts
              stages={data.stages.map((stage) => ({
                id: stage.id,
                name: stage.name,
                count: stage.count,
                totalValue: stage.totalValue,
                probability: stage.probability,
              }))}
            />

            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Etapa</th>
                    <th className="pb-2 text-right font-medium">Negócios</th>
                    <th className="pb-2 text-right font-medium">Valor</th>
                    <th className="pb-2 text-right font-medium">Probabilidade</th>
                    <th className="pb-2 text-right font-medium">Previsto</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stages.map((stage) => (
                    <tr key={stage.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5 font-medium">{stage.name}</td>
                      <td className="py-2.5 text-right tabular-nums">{stage.count}</td>
                      <td className="py-2.5 text-right tabular-nums">
                        {formatCurrencyBR(stage.totalValue)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{stage.probability}%</td>
                      <td className="py-2.5 text-right tabular-nums">
                        {formatCurrencyBR(stage.weightedValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card id="parados">
            <CardHeader>
              <CardTitle>Negócios parados</CardTitle>
              <CardDescription>
                Sem atividade há {data.stalledDays}+ dias. Abra o negócio para reagendar ou fechar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DealMiniList
                deals={data.stalledDeals}
                total={data.totals.stalled}
                emptyMessage={`Nenhum negócio parado há ${data.stalledDays}+ dias.`}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UsersIcon className="size-4" />
                Atividade por vendedor
              </CardTitle>
              <CardDescription>
                Clique no nome para ver as tarefas atrasadas. Concluídas contam os últimos 7 dias.
              </CardDescription>
              {data.selectedSeller && (
                <CardAction>
                  <Link
                    href={dashboardHref(current, { sellerId: null })}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Limpar seleção
                  </Link>
                </CardAction>
              )}
            </CardHeader>
            <CardContent>
              {data.sellers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum vendedor ativo. Convide a equipe para acompanhar a atividade.
                </p>
              ) : (
                <SellerTable data={data} current={current} />
              )}
            </CardContent>
          </Card>
        </div>

        {data.selectedSeller && (
          <Card>
            <CardHeader>
              <CardTitle>Tarefas atrasadas de {data.selectedSeller.name}</CardTitle>
              <CardDescription>
                Vencidas e ainda abertas. A tela Hoje mostra o mesmo recorte para o vendedor.
              </CardDescription>
              <CardAction>
                <Link
                  href={`/hoje?vendedor=${data.selectedSeller.id}`}
                  className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
                >
                  Abrir Hoje
                  <ArrowRightIcon className="size-3" />
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent>
              {data.selectedSeller.overdueTasks.length === 0 ? (
                <p className="flex items-center gap-2 rounded-lg bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
                  <CircleCheckIcon className="size-4 shrink-0" />
                  Nenhuma tarefa atrasada para {data.selectedSeller.name}.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {data.selectedSeller.overdueTasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          <Link href={`/negocios/${task.dealId}`} className="hover:underline">
                            {task.dealTitle}
                          </Link>{" "}
                          · {task.contactName} · venceu em {formatDateBR(task.dueAt)}
                        </p>
                      </div>
                      <Badge variant="destructive">
                        {task.overdueDays} {task.overdueDays === 1 ? "dia" : "dias"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              {data.selectedSeller.overdueTasks.length === 50 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Mostrando as 50 tarefas mais antigas.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  });
}
