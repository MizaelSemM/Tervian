import { Prisma } from "@/lib/generated/prisma/client";
import { startOfDayInTimeZone, startOfNextDayInTimeZone } from "@/lib/timezone";
import { tenantDb } from "@/lib/tenant-prisma";
import { getAccountTimeZone } from "@/server/services/followup";

/**
 * Métricas de produto do PRD (tarefa 013).
 *
 * São as 6 métricas internas do piloto, calculadas no servidor a partir dos
 * dados da própria conta (sem depender de PostHog):
 *
 * 1. % de vendedores ativos nos últimos 7 dias;
 * 2. % de negócios abertos com próxima ação;
 * 3. % de tarefas do dia concluídas;
 * 4. mediana do tempo de cadastro de lead (< 20s);
 * 5. negócios parados há 7+ dias;
 * 6. conversão (ganhos ÷ fechados) nos últimos 90 dias.
 *
 * A tela é só para ADMIN (`/painel/metricas`).
 */

const ACTIVITY_DAYS = 7;
const CONVERSION_DAYS = 90;
const STALLED_DAYS = 7;
const LEAD_WINDOW_DAYS = 30;

export type ProductMetrics = {
  activeSellers: { active: number; total: number; percent: number };
  dealsWithNextAction: { withNextAction: number; open: number; percent: number };
  todayTasks: { completed: number; due: number; percent: number };
  leadMedianSeconds: number | null;
  stalledDeals: number;
  conversion: { won: number; closed: number; percent: number };
};

function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round(((sorted[middle - 1]! + sorted[middle]!) / 2) * 10) / 10
    : sorted[middle]!;
}

export async function getProductMetrics(now: Date = new Date()): Promise<ProductMetrics> {
  const db = tenantDb();
  const timeZone = await getAccountTimeZone();

  const activityCutoff = new Date(now.getTime() - ACTIVITY_DAYS * 24 * 60 * 60 * 1000);
  const conversionCutoff = new Date(now.getTime() - CONVERSION_DAYS * 24 * 60 * 60 * 1000);
  const stalledCutoff = new Date(now.getTime() - STALLED_DAYS * 24 * 60 * 60 * 1000);
  const leadCutoff = new Date(now.getTime() - LEAD_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const todayStart = startOfDayInTimeZone(now, timeZone);
  const tomorrowStart = startOfNextDayInTimeZone(now, timeZone);

  const [
    activeUsers,
    activityGroups,
    openDeals,
    dealsWithNextAction,
    todayTasks,
    todayCompleted,
    stalledDeals,
    closedGroups,
    leadEvents,
  ] = await Promise.all([
    db.user.count({ where: { active: true } }),
    db.timelineEvent.groupBy({
      by: ["actorId"],
      where: { actorId: { not: null }, createdAt: { gte: activityCutoff } },
    }),
    db.deal.count({ where: { deletedAt: null, status: "OPEN" } }),
    db.deal.count({
      where: { deletedAt: null, status: "OPEN", nextActionAt: { not: null } },
    }),
    db.task.count({
      where: {
        completedAt: null,
        dueAt: { gte: todayStart, lt: tomorrowStart },
        deal: { deletedAt: null, status: "OPEN" },
      },
    }),
    db.task.count({
      where: {
        completedAt: { not: null },
        dueAt: { gte: todayStart, lt: tomorrowStart },
        deal: { deletedAt: null },
      },
    }),
    db.deal.count({
      where: {
        deletedAt: null,
        status: "OPEN",
        OR: [{ lastActivityAt: { lt: stalledCutoff } }, { lastActivityAt: null }],
      },
    }),
    db.deal.groupBy({
      by: ["status"],
      where: {
        deletedAt: null,
        status: { in: ["WON", "LOST"] },
        closedAt: { gte: conversionCutoff },
      },
      _count: { _all: true },
    }),
    db.timelineEvent.findMany({
      where: { type: "deal.created", createdAt: { gte: leadCutoff } },
      select: { payload: true },
      orderBy: { createdAt: "desc" },
      take: 2000,
    }),
  ]);

  const won = closedGroups.find((group) => group.status === "WON")?._count._all ?? 0;
  const lost = closedGroups.find((group) => group.status === "LOST")?._count._all ?? 0;
  const dueToday = todayTasks + todayCompleted;

  const leadSeconds: number[] = [];
  for (const event of leadEvents) {
    const payload = event.payload as Prisma.JsonObject | null;
    const value = payload?.seconds;
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      leadSeconds.push(value);
    }
  }

  return {
    activeSellers: {
      active: activityGroups.filter((group) => group.actorId).length,
      total: activeUsers,
      percent: percent(activityGroups.filter((group) => group.actorId).length, activeUsers),
    },
    dealsWithNextAction: {
      withNextAction: dealsWithNextAction,
      open: openDeals,
      percent: percent(dealsWithNextAction, openDeals),
    },
    todayTasks: {
      completed: todayCompleted,
      due: dueToday,
      percent: percent(todayCompleted, dueToday),
    },
    leadMedianSeconds: median(leadSeconds),
    stalledDeals,
    conversion: {
      won,
      closed: won + lost,
      percent: percent(won, won + lost),
    },
  };
}
