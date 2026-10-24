import { ownerScope } from "@/lib/access";
import { trackEvent } from "@/lib/analytics";
import { Prisma } from "@/lib/generated/prisma/client";
import { dateKeyBR, parseDateKeyBR, todayDateKeyBR } from "@/lib/utils";
import { requireTenantContext } from "@/lib/tenant-context";
import { tenantDb } from "@/lib/tenant-prisma";
import { AppError } from "@/server/errors";
import { ensureDefaultLostReasons } from "@/server/services/lost-reasons";
import { resolveOwnerId, type ActingUser } from "@/server/services/owners";
import {
  ensureDefaultPipeline,
  getPipelineStages,
  type StageRef,
} from "@/server/services/pipeline";

/**
 * Negócios — tarefa 006.
 *
 * Regras centrais:
 * - todo negócio aberto nasce com próxima ação (data + tarefa);
 * - vendedor só enxerga/move os próprios negócios (recorte no `where`);
 * - mover etapa e fechar registram evento na timeline;
 * - fechar como perdido exige motivo ativo da conta;
 * - fechar limpa a próxima ação e remove tarefas abertas (não sujam a tela "Hoje").
 *
 * O `accountId` nunca vem do client — o client de tenant o injeta em toda query.
 */

export const BOARD_STAGE_LIMIT = 50;
export const DEALS_PAGE_SIZE = 20;

export type DealCardData = {
  id: string;
  title: string;
  value: number | null;
  stageId: string;
  contact: { id: string; name: string; phone: string };
  owner: { id: string; name: string };
  expectedCloseAt: Date | null;
  nextActionAt: Date | null;
  lastActivityAt: Date | null;
  createdAt: Date;
};

export type DealBoardStage = StageRef & {
  count: number;
  totalValue: number;
  deals: DealCardData[];
  hasMore: boolean;
};

export type DealBoard = {
  stages: DealBoardStage[];
  totalOpen: number;
  totalValue: number;
};

export type DealListItem = DealCardData & {
  status: "OPEN" | "WON" | "LOST";
  stageName: string;
  closedAt: Date | null;
  lostReasonName: string | null;
};

export type DealTask = {
  id: string;
  title: string;
  type: "WHATSAPP" | "CALL" | "MEETING" | "OTHER";
  dueAt: Date;
  completedAt: Date | null;
  result: "ANSWERED" | "NO_ANSWER" | "CALLBACK" | "WON" | "LOST" | null;
  resultNote: string | null;
  ownerName: string;
};

export type DealTimelineEvent = {
  id: string;
  type: string;
  payload: Prisma.JsonValue;
  createdAt: Date;
  actorName: string | null;
};

export type DealNote = {
  id: string;
  text: string;
  createdAt: Date;
  authorName: string;
};

export type DealDetail = DealCardData & {
  status: "OPEN" | "WON" | "LOST";
  stageName: string;
  pipelineId: string;
  contactEmail: string | null;
  contactCompany: string | null;
  closedAt: Date | null;
  lostReason: { id: string; name: string } | null;
  lostNote: string | null;
  tasks: DealTask[];
  timeline: DealTimelineEvent[];
  notes: DealNote[];
};

const cardSelect = {
  id: true,
  title: true,
  value: true,
  stageId: true,
  expectedCloseAt: true,
  nextActionAt: true,
  lastActivityAt: true,
  createdAt: true,
  contact: { select: { id: true, name: true, phone: true } },
  owner: { select: { id: true, name: true } },
} satisfies Prisma.DealSelect;

function toNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value);
}

function toCard(row: Prisma.DealGetPayload<{ select: typeof cardSelect }>): DealCardData {
  return {
    id: row.id,
    title: row.title,
    value: toNumber(row.value),
    stageId: row.stageId,
    contact: row.contact,
    owner: row.owner,
    expectedCloseAt: row.expectedCloseAt,
    nextActionAt: row.nextActionAt,
    lastActivityAt: row.lastActivityAt,
    createdAt: row.createdAt,
  };
}

function ownerFilter(actingUser: ActingUser, requestedOwnerId?: string): { ownerId?: string } {
  if (actingUser.role !== "ADMIN" || !requestedOwnerId) return {};
  return { ownerId: requestedOwnerId };
}

function addDaysToDateKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Board do kanban: etapas do funil com contagem/soma e as primeiras N cards.
 * As consultas das etapas rodam em paralelo; os totais vêm de um `groupBy`
 * (não dependem das cards exibidas).
 */
export async function listDealBoard(input: {
  actingUser: ActingUser;
  ownerId?: string;
}): Promise<DealBoard> {
  const db = tenantDb();
  const stages = await getPipelineStages();
  const where: Prisma.DealWhereInput = {
    status: "OPEN",
    deletedAt: null,
    ...ownerScope(input.actingUser),
    ...ownerFilter(input.actingUser, input.ownerId),
  };

  const groupsPromise = db.deal.groupBy({
    by: ["stageId"],
    where,
    _count: { _all: true },
    _sum: { value: true },
  });

  const rowsPromise = Promise.all(
    stages.map((stage) =>
      db.deal.findMany({
        where: { ...where, stageId: stage.id },
        orderBy: [{ nextActionAt: "asc" }, { lastActivityAt: "asc" }, { createdAt: "asc" }],
        take: BOARD_STAGE_LIMIT + 1,
        select: cardSelect,
      }),
    ),
  );

  const [groups, rowsByStage] = await Promise.all([groupsPromise, rowsPromise]);

  const totals = new Map(
    groups.map((group) => [
      group.stageId,
      {
        count: group._count._all,
        totalValue: Number(group._sum.value ?? 0),
      },
    ]),
  );

  let totalOpen = 0;
  let totalValue = 0;

  const boardStages = stages.map((stage, index) => {
    const rows = rowsByStage[index] ?? [];
    const stats = totals.get(stage.id) ?? { count: 0, totalValue: 0 };
    totalOpen += stats.count;
    totalValue += stats.totalValue;

    return {
      ...stage,
      ...stats,
      deals: rows.slice(0, BOARD_STAGE_LIMIT).map(toCard),
      hasMore: rows.length > BOARD_STAGE_LIMIT,
    };
  });

  return { stages: boardStages, totalOpen, totalValue };
}

export type ListDealsInput = {
  actingUser: ActingUser;
  query?: string;
  status?: "OPEN" | "WON" | "LOST" | "ALL";
  stageId?: string;
  ownerId?: string;
  page?: number;
  pageSize?: number;
};

export type ListDealsResult = {
  items: DealListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/** Lista paginada — usada na visão em lista (celular) e nos filtros. */
export async function listDeals(input: ListDealsInput): Promise<ListDealsResult> {
  const db = tenantDb();
  const pageSize = Math.min(50, Math.max(1, input.pageSize ?? DEALS_PAGE_SIZE));
  const requestedPage = Math.max(1, Math.floor(input.page ?? 1));
  const status = input.status ?? "OPEN";
  const query = input.query?.trim() ?? "";

  const where: Prisma.DealWhereInput = {
    deletedAt: null,
    ...ownerScope(input.actingUser),
    ...ownerFilter(input.actingUser, input.ownerId),
  };
  if (status !== "ALL") where.status = status;
  if (input.stageId) where.stageId = input.stageId;

  if (query) {
    const digits = query.replace(/\D/g, "");
    const looksLikePhone = !/[a-z]/i.test(query) && digits.length >= 3;
    where.OR = [
      { title: { contains: query, mode: "insensitive" } },
      { contact: { name: { contains: query, mode: "insensitive" } } },
      ...(looksLikePhone ? [{ contact: { phone: { contains: digits } } }] : []),
    ];
  }

  const total = await db.deal.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);

  const rows = await db.deal.findMany({
    where,
    orderBy:
      status === "OPEN"
        ? [{ nextActionAt: "asc" }, { createdAt: "desc" }]
        : [{ closedAt: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      ...cardSelect,
      status: true,
      closedAt: true,
      stage: { select: { name: true } },
      lostReason: { select: { name: true } },
    },
  });

  return {
    items: rows.map((row) => ({
      ...toCard(row),
      status: row.status,
      stageName: row.stage.name,
      closedAt: row.closedAt,
      lostReasonName: row.lostReason?.name ?? null,
    })),
    total,
    page,
    pageSize,
    totalPages,
  };
}

/** Detalhe com o que a 006 precisa; timeline/notas completas chegam na 008. */
export async function getDeal(input: {
  id: string;
  actingUser: ActingUser;
}): Promise<DealDetail | null> {
  const row = await tenantDb().deal.findFirst({
    where: { id: input.id, deletedAt: null, ...ownerScope(input.actingUser) },
    select: {
      ...cardSelect,
      status: true,
      closedAt: true,
      lostNote: true,
      contact: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          companyText: true,
        },
      },
      stage: { select: { id: true, name: true, pipelineId: true } },
      lostReason: { select: { id: true, name: true } },
      tasks: {
        orderBy: { dueAt: "asc" },
        select: {
          id: true,
          title: true,
          type: true,
          dueAt: true,
          completedAt: true,
          result: true,
          resultNote: true,
          owner: { select: { name: true } },
        },
      },
      timelineEvents: {
        orderBy: { createdAt: "desc" },
        take: 25,
        select: {
          id: true,
          type: true,
          payload: true,
          createdAt: true,
          actor: { select: { name: true } },
        },
      },
      notes: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          text: true,
          createdAt: true,
          author: { select: { name: true } },
        },
      },
    },
  });

  if (!row) return null;

  const tasks = [...row.tasks].sort((a, b) => {
    if ((a.completedAt === null) !== (b.completedAt === null)) {
      return a.completedAt === null ? -1 : 1;
    }
    if (a.completedAt === null) return a.dueAt.getTime() - b.dueAt.getTime();
    return (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0);
  });

  return {
    ...toCard(row),
    status: row.status,
    stageName: row.stage.name,
    pipelineId: row.stage.pipelineId,
    contactEmail: row.contact.email,
    contactCompany: row.contact.companyText,
    closedAt: row.closedAt,
    lostReason: row.lostReason,
    lostNote: row.lostNote,
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      type: task.type,
      dueAt: task.dueAt,
      completedAt: task.completedAt,
      result: task.result,
      resultNote: task.resultNote,
      ownerName: task.owner.name,
    })),
    timeline: row.timelineEvents.map((event) => ({
      id: event.id,
      type: event.type,
      payload: event.payload,
      createdAt: event.createdAt,
      actorName: event.actor?.name ?? null,
    })),
    notes: row.notes.map((note) => ({
      id: note.id,
      text: note.text,
      createdAt: note.createdAt,
      authorName: note.author.name,
    })),
  };
}

export type CreateDealInput = {
  actingUser: ActingUser;
  contactId: string;
  title: string;
  value?: number | null;
  stageId?: string | null;
  ownerId?: string | null;
  expectedCloseAt?: Date | null;
  nextActionAt: Date;
};

/** Cria o negócio + a tarefa da próxima ação + evento, na mesma transação. */
export async function createDeal(
  input: CreateDealInput,
): Promise<{ dealId: string; contactId: string }> {
  const title = input.title.trim();
  if (title.length < 2) {
    throw new AppError("DEAL_TITLE_INVALID", "Informe o título do negócio (mín. 2 caracteres).");
  }

  const db = tenantDb();
  const accountId = requireTenantContext().accountId;
  const { pipelineId, newStage } = await ensureDefaultPipeline();

  const contact = await db.contact.findFirst({
    where: { id: input.contactId, deletedAt: null, ...ownerScope(input.actingUser) },
    select: { id: true, name: true, ownerId: true },
  });
  if (!contact) {
    throw new AppError("DEAL_CONTACT_NOT_FOUND", "Contato não encontrado nesta conta.");
  }

  let stage = newStage;
  if (input.stageId) {
    const selected = await db.stage.findFirst({
      where: { id: input.stageId, pipelineId },
      select: { id: true, name: true, position: true, probability: true },
    });
    if (!selected) {
      throw new AppError("DEAL_STAGE_INVALID", "Etapa inválida para este funil.");
    }
    stage = selected;
  }

  const ownerId = await resolveOwnerId(
    db,
    input.actingUser,
    input.ownerId ?? contact.ownerId ?? input.actingUser.id,
  );

  const now = new Date();
  const value = input.value ?? null;

  const created = await db.$transaction(async (tx) => {
    const deal = await tx.deal.create({
      data: {
        accountId,
        title,
        value,
        stageId: stage.id,
        contactId: contact.id,
        ownerId,
        expectedCloseAt: input.expectedCloseAt ?? null,
        lastActivityAt: now,
        nextActionAt: input.nextActionAt,
      },
      select: { id: true },
    });

    await tx.task.create({
      data: {
        accountId,
        dealId: deal.id,
        ownerId,
        type: "OTHER",
        title: "Follow-up",
        dueAt: input.nextActionAt,
      },
    });

    await tx.timelineEvent.create({
      data: {
        accountId,
        type: "deal.created",
        payload: { title, stage: stage.name, contact: contact.name },
        dealId: deal.id,
        contactId: contact.id,
        actorId: input.actingUser.id,
      },
    });

    return deal;
  });

  trackEvent("deal_created", {
    source: "manual",
    has_value: value !== null,
    has_expected_close: Boolean(input.expectedCloseAt),
  });

  return { dealId: created.id, contactId: contact.id };
}

export type UpdateDealInput = {
  id: string;
  actingUser: ActingUser;
  title: string;
  value?: number | null;
  ownerId?: string | null;
  expectedCloseAt?: Date | null;
};

export async function updateDeal(input: UpdateDealInput): Promise<{ contactId: string }> {
  const title = input.title.trim();
  if (title.length < 2) {
    throw new AppError("DEAL_TITLE_INVALID", "Informe o título do negócio (mín. 2 caracteres).");
  }

  const db = tenantDb();
  const accountId = requireTenantContext().accountId;

  const existing = await db.deal.findFirst({
    where: { id: input.id, deletedAt: null, ...ownerScope(input.actingUser) },
    select: {
      id: true,
      title: true,
      value: true,
      ownerId: true,
      expectedCloseAt: true,
      contactId: true,
      status: true,
    },
  });
  if (!existing) {
    throw new AppError("DEAL_NOT_FOUND", "Negócio não encontrado nesta conta.");
  }
  if (existing.status !== "OPEN") {
    throw new AppError("DEAL_CLOSED", "Negócio fechado não pode ser editado.");
  }

  const ownerId =
    input.ownerId === undefined
      ? existing.ownerId
      : await resolveOwnerId(db, input.actingUser, input.ownerId);
  const value = input.value ?? null;
  const expectedCloseAt = input.expectedCloseAt ?? null;

  const changedFields = (
    [
      ["title", existing.title, title],
      ["value", toNumber(existing.value), value],
      ["ownerId", existing.ownerId, ownerId],
      [
        "expectedCloseAt",
        existing.expectedCloseAt?.getTime() ?? null,
        expectedCloseAt?.getTime() ?? null,
      ],
    ] as const
  )
    .filter(([, before, after]) => before !== after)
    .map(([field]) => field);

  if (changedFields.length === 0) return { contactId: existing.contactId };

  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.deal.update({
      where: { id: existing.id },
      data: { title, value, ownerId, expectedCloseAt, lastActivityAt: now },
    });

    if (ownerId !== existing.ownerId) {
      await tx.task.updateMany({
        where: { dealId: existing.id, completedAt: null },
        data: { ownerId },
      });
    }

    await tx.timelineEvent.create({
      data: {
        accountId,
        type: "deal.updated",
        payload: { fields: changedFields },
        dealId: existing.id,
        contactId: existing.contactId,
        actorId: input.actingUser.id,
      },
    });
  });

  return { contactId: existing.contactId };
}

export type MoveDealInput = {
  id: string;
  actingUser: ActingUser;
  toStageId: string;
};

/**
 * Move o negócio de etapa (drag ou select).
 *
 * A regra do 007 é validada aqui: negócio aberto sem próxima ação não anda —
 * o vendedor precisa reagendar antes. Assim nenhum caminho de escrita cria
 * negócio aberto "esquecido".
 */
export async function moveDeal(
  input: MoveDealInput,
): Promise<{ contactId: string; stageId: string; changed: boolean }> {
  const db = tenantDb();
  const accountId = requireTenantContext().accountId;

  const deal = await db.deal.findFirst({
    where: { id: input.id, deletedAt: null, ...ownerScope(input.actingUser) },
    select: {
      id: true,
      title: true,
      stageId: true,
      status: true,
      nextActionAt: true,
      contactId: true,
      stage: { select: { name: true, pipelineId: true } },
    },
  });
  if (!deal) {
    throw new AppError("DEAL_NOT_FOUND", "Negócio não encontrado nesta conta.");
  }
  if (deal.status !== "OPEN") {
    throw new AppError("DEAL_CLOSED", "Negócio fechado não pode ser movido.");
  }
  if (deal.stageId === input.toStageId) {
    return { contactId: deal.contactId, stageId: deal.stageId, changed: false };
  }
  if (!deal.nextActionAt) {
    throw new AppError(
      "DEAL_NEXT_ACTION_REQUIRED",
      "Defina a próxima ação do negócio antes de mover de etapa.",
    );
  }

  const target = await db.stage.findFirst({
    where: { id: input.toStageId, pipelineId: deal.stage.pipelineId },
    select: { id: true, name: true },
  });
  if (!target) {
    throw new AppError("DEAL_STAGE_INVALID", "Etapa inválida para este funil.");
  }

  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.deal.update({
      where: { id: deal.id },
      data: { stageId: target.id, lastActivityAt: now },
    });

    await tx.timelineEvent.create({
      data: {
        accountId,
        type: "deal.stage_changed",
        payload: { from: deal.stage.name, to: target.name },
        dealId: deal.id,
        contactId: deal.contactId,
        actorId: input.actingUser.id,
      },
    });
  });

  return { contactId: deal.contactId, stageId: target.id, changed: true };
}

export type ScheduleNextActionInput = {
  id: string;
  actingUser: ActingUser;
  dueAt: Date;
  title?: string;
};

/**
 * Cria/atualiza a próxima ação e mantém `deals.next_action_at` sincronizado.
 * É o embrião do `scheduleNextAction()` que a 007 vai completar.
 */
export async function scheduleNextAction(
  input: ScheduleNextActionInput,
): Promise<{ taskId: string; contactId: string }> {
  const db = tenantDb();
  const accountId = requireTenantContext().accountId;

  const deal = await db.deal.findFirst({
    where: { id: input.id, deletedAt: null, ...ownerScope(input.actingUser) },
    select: {
      id: true,
      title: true,
      ownerId: true,
      status: true,
      nextActionAt: true,
      contactId: true,
    },
  });
  if (!deal) {
    throw new AppError("DEAL_NOT_FOUND", "Negócio não encontrado nesta conta.");
  }
  if (deal.status !== "OPEN") {
    throw new AppError("DEAL_CLOSED", "Negócio fechado não recebe nova ação.");
  }

  const openTask = await db.task.findFirst({
    where: { dealId: deal.id, completedAt: null },
    orderBy: { dueAt: "asc" },
    select: { id: true },
  });

  const now = new Date();
  const title = input.title?.trim() || "Follow-up";

  const taskId = await db.$transaction(async (tx) => {
    let id = openTask?.id;
    if (id) {
      await tx.task.update({
        where: { id },
        data: { dueAt: input.dueAt, title },
      });
    } else {
      const task = await tx.task.create({
        data: {
          accountId,
          dealId: deal.id,
          ownerId: deal.ownerId,
          type: "OTHER",
          title,
          dueAt: input.dueAt,
        },
        select: { id: true },
      });
      id = task.id;
    }

    await tx.deal.update({
      where: { id: deal.id },
      data: { nextActionAt: input.dueAt, lastActivityAt: now },
    });

    await tx.timelineEvent.create({
      data: {
        accountId,
        type: "deal.next_action_changed",
        payload: {
          from: deal.nextActionAt?.toISOString() ?? null,
          to: input.dueAt.toISOString(),
        },
        dealId: deal.id,
        contactId: deal.contactId,
        actorId: input.actingUser.id,
      },
    });

    return id;
  });

  return { taskId, contactId: deal.contactId };
}

/** Adia a próxima ação em 1 dia (atalho da tela do negócio). */
export async function deferDealNextAction(input: {
  id: string;
  actingUser: ActingUser;
}): Promise<{ oldDate: string | null; newDate: string; contactId: string }> {
  const deal = await tenantDb().deal.findFirst({
    where: { id: input.id, deletedAt: null, ...ownerScope(input.actingUser) },
    select: { nextActionAt: true, contactId: true },
  });
  if (!deal) {
    throw new AppError("DEAL_NOT_FOUND", "Negócio não encontrado nesta conta.");
  }

  const oldDate = dateKeyBR(deal.nextActionAt) || null;
  const newDate = addDaysToDateKey(oldDate ?? todayDateKeyBR(), 1);
  const dueAt = parseDateKeyBR(newDate);
  if (!dueAt) {
    throw new AppError("DEAL_DATE_INVALID", "Data inválida para adiar a ação.");
  }

  const result = await scheduleNextAction({ id: input.id, actingUser: input.actingUser, dueAt });
  return { oldDate, newDate, contactId: result.contactId };
}

export type CloseDealInput = {
  id: string;
  actingUser: ActingUser;
  status: "WON" | "LOST";
  value?: number | null;
  lostReasonId?: string | null;
  lostNote?: string | null;
};

/** Fecha como ganho (valor final) ou perdido (motivo obrigatório). */
export async function closeDeal(input: CloseDealInput): Promise<{ contactId: string }> {
  const db = tenantDb();
  const accountId = requireTenantContext().accountId;

  const deal = await db.deal.findFirst({
    where: { id: input.id, deletedAt: null, ...ownerScope(input.actingUser) },
    select: {
      id: true,
      title: true,
      value: true,
      status: true,
      contactId: true,
    },
  });
  if (!deal) {
    throw new AppError("DEAL_NOT_FOUND", "Negócio não encontrado nesta conta.");
  }
  if (deal.status !== "OPEN") {
    throw new AppError("DEAL_ALREADY_CLOSED", "Este negócio já está fechado.");
  }

  const now = new Date();
  const lostNote = input.lostNote?.trim() || null;

  if (input.status === "WON") {
    const previousValue = toNumber(deal.value);
    const finalValue = input.value ?? previousValue;
    if (finalValue === null) {
      throw new AppError(
        "DEAL_VALUE_REQUIRED",
        "Confirme o valor final para marcar o negócio como ganho.",
      );
    }

    await db.$transaction(async (tx) => {
      await tx.deal.update({
        where: { id: deal.id },
        data: {
          status: "WON",
          value: finalValue,
          closedAt: now,
          nextActionAt: null,
          lostReasonId: null,
          lostNote: null,
          lastActivityAt: now,
        },
      });

      await tx.task.deleteMany({
        where: { dealId: deal.id, completedAt: null },
      });

      await tx.timelineEvent.create({
        data: {
          accountId,
          type: "deal.closed",
          payload: { status: "WON", value: finalValue },
          dealId: deal.id,
          contactId: deal.contactId,
          actorId: input.actingUser.id,
        },
      });
    });

    trackEvent("deal_closed", { status: "WON", value: finalValue });
    return { contactId: deal.contactId };
  }

  if (!input.lostReasonId) {
    throw new AppError("DEAL_LOST_REASON_REQUIRED", "Escolha o motivo da perda.");
  }

  await ensureDefaultLostReasons();
  const lostReason = await db.lostReason.findFirst({
    where: { id: input.lostReasonId, active: true },
    select: { id: true, name: true },
  });
  if (!lostReason) {
    throw new AppError("DEAL_LOST_REASON_INVALID", "Motivo de perda inválido para esta conta.");
  }

  await db.$transaction(async (tx) => {
    await tx.deal.update({
      where: { id: deal.id },
      data: {
        status: "LOST",
        closedAt: now,
        nextActionAt: null,
        lostReasonId: lostReason.id,
        lostNote,
        lastActivityAt: now,
      },
    });

    await tx.task.deleteMany({
      where: { dealId: deal.id, completedAt: null },
    });

    await tx.timelineEvent.create({
      data: {
        accountId,
        type: "deal.closed",
        payload: { status: "LOST", reason: lostReason.name, note: lostNote },
        dealId: deal.id,
        contactId: deal.contactId,
        actorId: input.actingUser.id,
      },
    });
  });

  trackEvent("deal_closed", { status: "LOST", has_note: lostNote !== null });
  return { contactId: deal.contactId };
}
