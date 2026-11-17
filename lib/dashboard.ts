import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  parseDateKeyInTimeZone,
  zonedDateTimeToUtc,
} from "@/lib/timezone";

/**
 * Regras puras do painel do gestor (tarefa 011).
 *
 * Ficam fora do serviço Prisma para serem testadas sem banco: filtro de
 * período no fuso da conta, corte de "negócio parado", previsão ponderada e
 * montagem do resumo por etapa.
 */

export const DASHBOARD_PERIODS = ["month", "30d"] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export const DASHBOARD_PERIOD_LABELS: Record<DashboardPeriod, string> = {
  month: "Mês atual",
  "30d": "Últimos 30 dias",
};

export const STALLED_DAY_OPTIONS = [7, 14, 30] as const;
export const DEFAULT_STALLED_DAYS = 7;

export type DateRange = { start: Date; end: Date };

export type StageLike = {
  id: string;
  name: string;
  position: number;
  probability: number;
};

export type StageTotals = {
  count: number;
  totalValue: number;
};

export type StageSummary = StageLike &
  StageTotals & {
    /** Valor ponderado pela probabilidade da etapa (previsão). */
    weightedValue: number;
  };

/** Normaliza o parâmetro `?periodo=`; desconhecido cai no mês atual. */
export function parseDashboardPeriod(value: string | null | undefined): DashboardPeriod {
  return value === "30d" ? "30d" : "month";
}

/** Normaliza `?dias=`: aceita apenas 7, 14 ou 30 (padrão 7). */
export function parseStalledDays(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return (STALLED_DAY_OPTIONS as readonly number[]).includes(parsed)
    ? parsed
    : DEFAULT_STALLED_DAYS;
}

/**
 * Intervalo de N dias de calendário no fuso da conta, incluindo hoje.
 * Ex.: 30 dias em 08/11 => início em 10/10 às 00:00 locais.
 */
export function calendarRangeInTimeZone(now: Date, timeZone: string, days: number): DateRange {
  const safeDays = Math.max(1, Math.floor(days));
  const todayKey = dateKeyInTimeZone(now, timeZone);
  const startKey = addDaysToDateKey(todayKey, -(safeDays - 1));
  const start = parseDateKeyInTimeZone(startKey, timeZone, 0);

  return {
    start: start ?? new Date(now.getTime() - safeDays * 86_400_000),
    end: now,
  };
}

/** Intervalo do filtro de período do painel. */
export function dashboardPeriodRange(
  period: DashboardPeriod,
  now: Date,
  timeZone: string,
): DateRange {
  if (period === "30d") return calendarRangeInTimeZone(now, timeZone, 30);

  const todayKey = dateKeyInTimeZone(now, timeZone);
  const [year, month] = todayKey.split("-").map(Number);
  return {
    start: zonedDateTimeToUtc(year, month, 1, 0, 0, timeZone),
    end: now,
  };
}

/**
 * Instante de corte de "negócio parado": início do dia X dias atrás.
 * Atividade anterior a esse instante conta como X+ dias sem atividade.
 */
export function stalledCutoff(now: Date, days: number, timeZone: string): Date {
  const todayKey = dateKeyInTimeZone(now, timeZone);
  const cutoffKey = addDaysToDateKey(todayKey, -Math.max(1, Math.floor(days)));
  return (
    parseDateKeyInTimeZone(cutoffKey, timeZone, 0) ??
    new Date(now.getTime() - Math.max(1, days) * 86_400_000)
  );
}

/** Um negócio está parado quando a última atividade (ou criação) passou do corte. */
export function isDealStalled(
  deal: { lastActivityAt: Date | null; createdAt: Date },
  cutoff: Date,
): boolean {
  return (deal.lastActivityAt ?? deal.createdAt).getTime() < cutoff.getTime();
}

function clampProbability(probability: number): number {
  return Math.min(100, Math.max(0, probability));
}

/** Previsão = soma de valor × probabilidade da etapa (RF-50). */
export function weightedForecast(
  stages: Array<{ totalValue: number; probability: number }>,
): number {
  const total = stages.reduce(
    (sum, stage) => sum + stage.totalValue * (clampProbability(stage.probability) / 100),
    0,
  );
  return Math.round(total * 100) / 100;
}

/**
 * Taxa de ganho do período: ganhos ÷ (ganhos + perdidos), em %.
 * Sem nenhum fechamento, não há taxa (não confundir com 0%).
 */
export function conversionRate(won: number, lost: number): number | null {
  const decided = won + lost;
  if (decided <= 0) return null;
  return Math.round((won / decided) * 1000) / 10;
}

/** Junta as etapas do funil com as somas agregadas de negócios abertos. */
export function buildStageSummaries(
  stages: StageLike[],
  totals: Record<string, StageTotals>,
): StageSummary[] {
  return stages.map((stage) => {
    const stats = totals[stage.id] ?? { count: 0, totalValue: 0 };
    return {
      ...stage,
      count: stats.count,
      totalValue: stats.totalValue,
      weightedValue:
        Math.round(stats.totalValue * (clampProbability(stage.probability) / 100) * 100) / 100,
    };
  });
}
