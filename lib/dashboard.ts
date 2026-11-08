import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  parseDateKeyInTimeZone,
  zonedDateTimeToUtc,
} from "@/lib/timezone";

/**
 * Regras puras do painel do gestor (tarefa 011).
 *
 * Ficam fora do servi��o Prisma para serem testadas sem banco: filtro de
 * per��odo no fuso da conta, corte de "neg��cio parado", previs��o ponderada e
 * montagem do resumo por etapa.
 */

export const DASHBOARD_PERIODS = ["month", "30d"] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export const DASHBOARD_PERIOD_LABELS: Record<DashboardPeriod, string> = {
  month: "M��s atual",
  "30d": "��ltimos 30 dias",
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
    /** Valor ponderado pela probabilidade da etapa (previs��o). */
    weightedValue: number;
  };

/** Normaliza o par��metro `?periodo=`; desconhecido cai no m��s atual. */
export function parseDashboardPeriod(value: string | null | undefined): DashboardPeriod {
  return value === "30d" ? "30d" : "month";
}

/** Normaliza `?dias=`: aceita apenas 7, 14 ou 30 (padr��o 7). */
export function parseStalledDays(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return (STALLED_DAY_OPTIONS as readonly number[]).includes(parsed)
    ? parsed
    : DEFAULT_STALLED_DAYS;
}

/**
 * Intervalo de N dias de calend��rio no fuso da conta, incluindo hoje.
 * Ex.: 30 dias em 08/11 => in��cio em 10/10 ��s 00:00 locais.
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

/** Intervalo do filtro de per��odo do painel. */
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
 * Instante de corte de "neg��cio parado": in��cio do dia X dias atr��s.
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

/** Um neg��cio est�� parado quando a ��ltima atividade (ou cria����o) passou do corte. */
export function isDealStalled(
  deal: { lastActivityAt: Date | null; createdAt: Date },
  cutoff: Date,
): boolean {
  return (deal.lastActivityAt ?? deal.createdAt).getTime() < cutoff.getTime();
}

function clampProbability(probability: number): number {
  return Math.min(100, Math.max(0, probability));
}

/** Previs��o = soma de valor �� probabilidade da etapa (RF-50). */
export function weightedForecast(
  stages: Array<{ totalValue: number; probability: number }>,
): number {
  const total = stages.reduce(
    (sum, stage) => sum + stage.totalValue * (clampProbability(stage.probability) / 100),
    0,
  );
  return Math.round(total * 100) / 100;
}

/** Junta as etapas do funil com as somas agregadas de neg��cios abertos. */
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
