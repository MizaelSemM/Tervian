import { Prisma } from "@/lib/generated/prisma/client";
import {
  buildStageSummaries,
  calendarRangeInTimeZone,
  dashboardPeriodRange,
  parseDashboardPeriod,
  parseStalledDays,
  stalledCutoff,
  weightedForecast,
  DASHBOARD_PERIOD_LABELS,
  type DashboardPeriod,
  type StageSummary,
} from "@/lib/dashboard";
import { calendarDaysBetweenKeys, dateKeyInTimeZone } from "@/lib/timezone";
import { formatDateBR } from "@/lib/utils";
import { tenantDb } from "@/lib/tenant-prisma";
import { AppError } from "@/server/errors";
import { getAccountTimeZone } from "@/server/services/followup";
import { listOwnerOptions, resolveOwnerId, type ActingUser } from "@/server/services/owners";
import { getPipelineStages } from "@/server/services/pipeline";
import { logEvent } from "@/server/services/timeline";

/**
 * Painel do gestor (tarefa 011).
 *
 * Tudo �� agregado no servidor: as consultas pesadas usam `groupBy`/`count` e o
 * client (Recharts) recebe apenas o resumo por etapa, nunca a lista crua de
 * neg��cios. As listas de apoio (parados, sem pr��xima a��o, atrasadas) s��o
 * curtas e j�� chegam prontas para leitura.
 */

const STALLED_LIST_LIMIT = 10;
const NO_NEXT_ACTION_LIST_LIMIT = 10;
const SELLER_OVERDUE_LIMIT = 50;

export type DashboardDealItem = {
  id: string;
  title: string;
  value: number | null;
  stageName: string;
  contact: { id: string; name: string };
  owner: { id: string; name: string };
  lastActivityAt: string;
  idleDays: number;
  nextActionAt: string | null;
};

export type SellerActivity = {
  id: string;
  name: string;
  /** Tarefas conclu��das nos ��ltimos 7 dias. */
  completedInWeek: number;
  /** Tarefas vencidas e ainda abertas agora. */
  overdue: number;
  /** Tarefas abertas de neg��cios abertos (carga atual). */
  openTasks: number;
};

export type OverdueTaskItem = {
  id: string;
  title: string;
  dueAt: string;
  overdueDays: number;
  dealId: string;
  dealTitle: string;
  contactName: string;
};

export type SelectedSeller = {
  id: string;
  name: string;
  overdueTasks: OverdueTaskItem[];
};

export type PeriodSummary = {
  period: DashboardPeriod;
  label: string;
  start: string;
  end: string;
  newDeals: number;
  wonDeals: number;
  wonValue: number;
  completedTasks: number;
};

export type DashboardData = {
  stalledDays: number;
  timeZone: string;
  stages: StageSummary[];
  totals: {
    openDeals: number;
    pipelineValue: number;
    forecast: number;
    stalled: number;
    withoutNextAction: number;
    overdueTasks: number;
  };
  period: PeriodSummary;
  stalledDeals: DashboardDealItem[];
  withoutNextActionDeals: DashboardDealItem[];
  sellers: SellerActivity[];
  selectedSeller: SelectedSeller | null;
  isEmpty: boolean;
  hasTeam: boolean;
};

export type GetDashboardInput = {
  actingUser: ActingUser;
  period?: string | null;
  stalledDays?: string | number | null;
  sellerId?: string | null;
  now?: Date;
};

const dealListSelect = {
  id: true,
  title: true,
  value: true,
  contactId: true,
  lastActivityAt: true,
  nextActionAt: true,
  createdAt: true,
  stage: { select: { name: true } },
  contact: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true } },
} satisfies Prisma.DealSelect;

type DealListRow = Prisma.DealGetPayload<{ select: typeof dealListSelect }>;

function assertAdmin(actingUser: ActingUser): void {
  if (actingUser.role !== "ADMIN") {
    throw new AppError("DASHBOARD_FORBIDDEN", "Apenas administradores acessam o painel.");
  }
}

function toDealItem(row: DealListRow, timeZone: string, todayKey: string): DashboardDealItem {
  const lastActivityAt = row.lastActivityAt ?? row.createdAt;
  return {
    id: row.id,
    title: row.title,
    value: row.value === null ? null : Number(row.value),
    stageName: row.stage.name,
    contact: row.contact,
    owner: row.owner,
    lastActivityAt: lastActivityAt.toISOString(),
    idleDays: Math.max(
      0,
      calendarDaysBetweenKeys(dateKeyInTimeZone(lastActivityAt, timeZone), todayKey),
    ),
    nextActionAt: row.nextActionAt?.toISOString() ?? null,
  };
}

function countByOwner(
  groups: Array<{ ownerId: string; _count: { _all: number } }>,
): Map<string, number> {
  return new Map(groups.map((group) => [group.ownerId, group._count._all]));
}

/** Dados completos da p��gina /painel. Exige ADMIN (defesa extra al��m da rota). */
export async function getDashboard(input: GetDashboardInput): Promise<DashboardData> {
  assertAdmin(input.actingUser);

  const db = tenantDb();
  const now = input.now ?? new Date();
  const period = parseDashboardPeriod(input.period);
  const stalledDays = parseStalledDays(input.stalledDays);
  const timeZone = await getAccountTimeZone();
  const todayKey = dateKeyInTimeZone(now, timeZone);
  const periodRange = dashboardPeriodRange(period, now, timeZone);
  const weekRange = calendarRangeInTimeZone(now, timeZone, 7);
  const cutoff = stalledCutoff(now, stalledDays, timeZone);

  const [stages, sellers] = await Promise.all([
    getPipelineStages(),
    listOwnerOptions(input.actingUser),
  ]);

  const openWhere: Prisma.DealWhereInput = {
    status: "OPEN",
    deletedAt: null,
  };
  const stalledWhere: Prisma.DealWhereInput = {
    OR: [{ lastActivityAt: { lt: cutoff } }, { lastActivityAt: null, createdAt: { lt: cutoff } }],
  };

  const selectedSellerId =
    input.sellerId && sellers.some((seller) => seller.id === input.sellerId)
      ? input.sellerId
      : null;

  const [
    stageGroups,
    stalledCount,
    withoutNextActionCount,
    stalledRows,
    withoutNextActionRows,
    completedBySeller,
    overdueBySeller,
    openTasksBySeller,
    newDeals,
    wonAggregate,
    completedTasks,
    selectedSellerOverdue,
  ] = await Promise.all([
    db.deal.groupBy({
      by: ["stageId"],
      where: openWhere,
      _count: { _all: true },
      _sum: { value: true },
    }),
    db.deal.count({ where: { ...openWhere, ...stalledWhere } }),
    db.deal.count({ where: { ...openWhere, nextActionAt: null } }),
    db.deal.findMany({
      where: { ...openWhere, ...stalledWhere },
      orderBy: [{ lastActivityAt: "asc" }, { createdAt: "asc" }],
      take: STALLED_LIST_LIMIT,
      select: dealListSelect,
    }),
    db.deal.findMany({
      where: { ...openWhere, nextActionAt: null },
      orderBy: [{ lastActivityAt: "asc" }, { createdAt: "asc" }],
      take: NO_NEXT_ACTION_LIST_LIMIT,
      select: dealListSelect,
    }),
    db.task.groupBy({
      by: ["ownerId"],
      where: {
        completedAt: { gte: weekRange.start, lte: weekRange.end },
        deal: { deletedAt: null },
      },
      _count: { _all: true },
    }),
    db.task.groupBy({
      by: ["ownerId"],
      where: {
        completedAt: null,
        dueAt: { lt: now },
        deal: { status: "OPEN", deletedAt: null, contact: { deletedAt: null } },
      },
      _count: { _all: true },
    }),
    db.task.groupBy({
      by: ["ownerId"],
      where: {
        completedAt: null,
        deal: { status: "OPEN", deletedAt: null, contact: { deletedAt: null } },
      },
      _count: { _all: true },
    }),
    db.deal.count({
      where: {
        createdAt: { gte: periodRange.start, lte: periodRange.end },
        deletedAt: null,
      },
    }),
    db.deal.aggregate({
      where: {
        status: "WON",
        closedAt: { gte: periodRange.start, lte: periodRange.end },
        deletedAt: null,
      },
      _count: { _all: true },
      _sum: { value: true },
    }),
    db.task.count({
      where: {
        completedAt: { gte: periodRange.start, lte: periodRange.end },
        deal: { deletedAt: null },
      },
    }),
    selectedSellerId
      ? db.task.findMany({
          where: {
            ownerId: selectedSellerId,
            completedAt: null,
            dueAt: { lt: now },
            deal: { status: "OPEN", deletedAt: null, contact: { deletedAt: null } },
          },
          orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
          take: SELLER_OVERDUE_LIMIT,
          select: {
            id: true,
            title: true,
            dueAt: true,
            deal: {
              select: {
                id: true,
                title: true,
                contact: { select: { name: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const stageTotals: Record<string, { count: number; totalValue: number }> = {};
  for (const group of stageGroups) {
    stageTotals[group.stageId] = {
      count: group._count._all,
      totalValue: Number(group._sum.value ?? 0),
    };
  }

  const stageSummaries = buildStageSummaries(stages, stageTotals);
  const openDeals = stageSummaries.reduce((sum, stage) => sum + stage.count, 0);
  const pipelineValue = stageSummaries.reduce((sum, stage) => sum + stage.totalValue, 0);
  const forecast = weightedForecast(stageSummaries);

  const completedMap = countByOwner(completedBySeller);
  const overdueMap = countByOwner(overdueBySeller);
  const openTasksMap = countByOwner(openTasksBySeller);

  const sellerActivity: SellerActivity[] = sellers.map((seller) => ({
    id: seller.id,
    name: seller.name,
    completedInWeek: completedMap.get(seller.id) ?? 0,
    overdue: overdueMap.get(seller.id) ?? 0,
    openTasks: openTasksMap.get(seller.id) ?? 0,
  }));

  const overdueTasks = sellerActivity.reduce((sum, seller) => sum + seller.overdue, 0);
  const selectedSeller = selectedSellerId
    ? {
        id: selectedSellerId,
        name: sellers.find((seller) => seller.id === selectedSellerId)?.name ?? "",
        overdueTasks: selectedSellerOverdue.map((task) => ({
          id: task.id,
          title: task.title,
          dueAt: task.dueAt.toISOString(),
          overdueDays: Math.max(
            0,
            calendarDaysBetweenKeys(dateKeyInTimeZone(task.dueAt, timeZone), todayKey),
          ),
          dealId: task.deal.id,
          dealTitle: task.deal.title,
          contactName: task.deal.contact.name,
        })),
      }
    : null;

  const wonDeals = wonAggregate._count._all;
  const wonValue = Number(wonAggregate._sum.value ?? 0);

  return {
    stalledDays,
    timeZone,
    stages: stageSummaries,
    totals: {
      openDeals,
      pipelineValue,
      forecast,
      stalled: stalledCount,
      withoutNextAction: withoutNextActionCount,
      overdueTasks,
    },
    period: {
      period,
      label: DASHBOARD_PERIOD_LABELS[period],
      start: formatDateBR(periodRange.start),
      end: formatDateBR(periodRange.end),
      newDeals,
      wonDeals,
      wonValue,
      completedTasks,
    },
    stalledDeals: stalledRows.map((row) => toDealItem(row, timeZone, todayKey)),
    withoutNextActionDeals: withoutNextActionRows.map((row) => toDealItem(row, timeZone, todayKey)),
    sellers: sellerActivity,
    selectedSeller,
    isEmpty: openDeals === 0,
    hasTeam: sellers.length > 1,
  };
}

export type PortfolioDealItem = {
  id: string;
  title: string;
  value: number | null;
  stageName: string;
  contact: { id: string; name: string };
  owner: { id: string; name: string };
  lastActivityLabel: string;
  lastActivityAt: string;
};

export type PortfolioData = {
  items: PortfolioDealItem[];
  owners: Array<{ id: string; name: string }>;
  total: number;
  page: number;
  totalPages: number;
  ownerFilter: string | null;
};

const PORTFOLIO_PAGE_SIZE = 25;

/** Carteira para reatribui����o em lote (US-05). Exige ADMIN. */
export async function listPortfolio(input: {
  actingUser: ActingUser;
  ownerId?: string | null;
  page?: number;
}): Promise<PortfolioData> {
  assertAdmin(input.actingUser);

  const db = tenantDb();
  const owners = await listOwnerOptions(input.actingUser);
  const ownerFilter =
    input.ownerId && owners.some((owner) => owner.id === input.ownerId) ? input.ownerId : null;
  const where: Prisma.DealWhereInput = {
    status: "OPEN",
    deletedAt: null,
    ...(ownerFilter ? { ownerId: ownerFilter } : {}),
  };

  const total = await db.deal.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PORTFOLIO_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(input.page ?? 1)), totalPages);

  const rows = await db.deal.findMany({
    where,
    orderBy: [{ lastActivityAt: "asc" }, { createdAt: "asc" }],
    skip: (page - 1) * PORTFOLIO_PAGE_SIZE,
    take: PORTFOLIO_PAGE_SIZE,
    select: {
      id: true,
      title: true,
      value: true,
      lastActivityAt: true,
      createdAt: true,
      stage: { select: { name: true } },
      contact: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
    },
  });

  return {
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      value: row.value === null ? null : Number(row.value),
      stageName: row.stage.name,
      contact: row.contact,
      owner: row.owner,
      lastActivityAt: (row.lastActivityAt ?? row.createdAt).toISOString(),
      lastActivityLabel: formatDateBR(row.lastActivityAt ?? row.createdAt),
    })),
    owners,
    total,
    page,
    totalPages,
    ownerFilter,
  };
}

export type ReassignDealsInput = {
  actingUser: ActingUser;
  dealIds: string[];
  ownerId: string;
};

export type ReassignDealsResult = {
  updated: number;
  unchanged: number;
  skipped: number;
  ownerName: string;
};

const MAX_BATCH_SIZE = 200;

/**
 * Reatribui neg��cios abertos em lote.
 *
 * Hist��rico preservado: a troca n��o apaga eventos antigos e gera um novo
 * `deal.owner_changed` em cada neg��cio. As tarefas abertas acompanham o novo
 * respons��vel para o follow-up n��o ficar com a pessoa antiga. A reatribui����o
 * N��O atualiza `last_activity_at` �� para o gestor, ela n��o esconder um neg��cio
 * que est�� parado na opera����o.
 */
export async function reassignDeals(input: ReassignDealsInput): Promise<ReassignDealsResult> {
  assertAdmin(input.actingUser);

  const dealIds = [...new Set(input.dealIds.map((id) => id.trim()).filter(Boolean))];
  if (dealIds.length === 0) {
    throw new AppError("DEALS_REQUIRED", "Selecione ao menos um neg��cio.");
  }
  if (dealIds.length > MAX_BATCH_SIZE) {
    throw new AppError(
      "DEALS_BATCH_TOO_LARGE",
      `Selecione no m��ximo ${MAX_BATCH_SIZE} neg��cios por vez.`,
    );
  }

  const db = tenantDb();
  const ownerId = await resolveOwnerId(db, input.actingUser, input.ownerId);
  const owner = await db.user.findFirst({
    where: { id: ownerId, active: true },
    select: { id: true, name: true },
  });
  if (!owner) {
    throw new AppError("OWNER_NOT_FOUND", "Respons��vel n��o encontrado ou inativo nesta equipe.");
  }

  const deals = await db.deal.findMany({
    where: { id: { in: dealIds }, status: "OPEN", deletedAt: null },
    select: {
      id: true,
      contactId: true,
      ownerId: true,
      owner: { select: { id: true, name: true } },
    },
  });

  const changing = deals.filter((deal) => deal.ownerId !== ownerId);
  if (changing.length === 0) {
    return {
      updated: 0,
      unchanged: deals.length,
      skipped: dealIds.length - deals.length,
      ownerName: owner.name,
    };
  }

  const changingIds = changing.map((deal) => deal.id);

  await db.$transaction(async (tx) => {
    await tx.deal.updateMany({
      where: { id: { in: changingIds }, status: "OPEN", deletedAt: null },
      data: { ownerId },
    });

    await tx.task.updateMany({
      where: { dealId: { in: changingIds }, completedAt: null },
      data: { ownerId },
    });

    for (const deal of changing) {
      await logEvent({
        type: "deal.owner_changed",
        payload: {
          fromId: deal.ownerId,
          fromName: deal.owner.name,
          toId: owner.id,
          toName: owner.name,
          batch: true,
        },
        dealId: deal.id,
        contactId: deal.contactId,
        actorId: input.actingUser.id,
        client: tx,
      });
    }
  });

  return {
    updated: changing.length,
    unchanged: deals.length - changing.length,
    skipped: dealIds.length - deals.length,
    ownerName: owner.name,
  };
}
