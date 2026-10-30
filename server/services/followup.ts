import { ownerScope } from "@/lib/access";
import { trackEvent } from "@/lib/analytics";
import type { TodayData, TodayTask } from "@/lib/followup-types";
import { Prisma } from "@/lib/generated/prisma/client";
import type { TaskResultValue } from "@/lib/schemas/followup";
import { requireTenantContext } from "@/lib/tenant-context";
import { tenantDb, type TenantTransactionClient } from "@/lib/tenant-prisma";
import {
  addDaysToDateKey,
  calendarDaysBetweenKeys,
  dateKeyInTimeZone,
  formatDayLabelInTimeZone,
  formatTimeInTimeZone,
  parseDateKeyInTimeZone,
  resolveTimeZone,
  startOfDayInTimeZone,
  startOfNextDayInTimeZone,
  todayKeyInTimeZone,
} from "@/lib/timezone";
import { AppError } from "@/server/errors";
import { applyDealCloseInTransaction } from "@/server/services/deals";
import { ensureDefaultLostReasons, listLostReasons } from "@/server/services/lost-reasons";
import { listOwnerOptions, type ActingUser } from "@/server/services/owners";

/**
 * Motor de follow-up e tela "Hoje" (tarefa 007).
 *
 * Invariantes:
 * - negócio aberto sempre tem UMA próxima ação (data + tarefa aberta);
 * - concluir tarefa exige resultado + próxima ação, salvo ganho/perdido;
 * - ganho/perdido preservam a tarefa concluída e cancelam as demais;
 * - `deals.next_action_at` e `deals.last_activity_at` são sempre atualizados;
 * - vendedor só enxerga/conclui as próprias tarefas (recorte no `where`).
 */

export type { TodayData, TodayTask } from "@/lib/followup-types";

async function getAccountTimeZone(): Promise<string> {
  const account = await tenantDb().account.findFirst({ select: { timezone: true } });
  return resolveTimeZone(account?.timezone);
}

function sellerScope(actingUser: ActingUser): Prisma.TaskWhereInput {
  return actingUser.role === "ADMIN" ? {} : { ownerId: actingUser.id };
}

/**
 * Tarefas vencidas + de hoje, já priorizadas (atrasadas primeiro).
 * Uma query só; os contadores saem do resultado e de um `count` à parte.
 */
export async function getToday(input: {
  actingUser: ActingUser;
  ownerId?: string | null;
  now?: Date;
}): Promise<TodayData> {
  const db = tenantDb();
  const now = input.now ?? new Date();
  const timezone = await getAccountTimeZone();
  const todayKey = todayKeyInTimeZone(timezone, now);
  const start = startOfDayInTimeZone(now, timezone);
  const end = startOfNextDayInTimeZone(now, timezone);

  const sellers = await listOwnerOptions(input.actingUser);
  const requestedOwnerId =
    input.actingUser.role === "ADMIN" &&
    input.ownerId &&
    sellers.some((seller) => seller.id === input.ownerId)
      ? input.ownerId
      : null;

  const scope: Prisma.TaskWhereInput =
    input.actingUser.role === "ADMIN"
      ? requestedOwnerId
        ? { ownerId: requestedOwnerId }
        : {}
      : sellerScope(input.actingUser);

  const [rows, completedToday, lostReasons] = await Promise.all([
    db.task.findMany({
      where: {
        ...scope,
        completedAt: null,
        dueAt: { lt: end },
        deal: { status: "OPEN", deletedAt: null, contact: { deletedAt: null } },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        type: true,
        dueAt: true,
        owner: { select: { id: true, name: true } },
        deal: {
          select: {
            id: true,
            title: true,
            value: true,
            stage: { select: { name: true } },
            contact: { select: { id: true, name: true, phone: true } },
          },
        },
      },
    }),
    db.task.count({
      where: {
        ...scope,
        completedAt: { gte: start, lt: end },
        deal: { deletedAt: null },
      },
    }),
    listLostReasons(),
  ]);

  const mapped: TodayTask[] = rows.map((row) => {
    const overdueDays = Math.max(
      0,
      calendarDaysBetweenKeys(dateKeyInTimeZone(row.dueAt, timezone), todayKey),
    );

    return {
      id: row.id,
      title: row.title,
      type: row.type,
      dueAt: row.dueAt.toISOString(),
      dueTimeLabel: formatTimeInTimeZone(row.dueAt, timezone),
      overdueDays,
      dealId: row.deal.id,
      dealTitle: row.deal.title,
      dealValue: row.deal.value === null ? null : Number(row.deal.value),
      stageName: row.deal.stage.name,
      contactId: row.deal.contact.id,
      contactName: row.deal.contact.name,
      contactPhone: row.deal.contact.phone,
      ownerId: row.owner.id,
      ownerName: row.owner.name,
    };
  });

  const overdue = mapped.filter((task) => task.overdueDays > 0);
  const today = mapped.filter((task) => task.overdueDays === 0);

  return {
    todayKey,
    todayLabel: formatDayLabelInTimeZone(now, timezone),
    timezone,
    overdue,
    today,
    counts: {
      overdue: overdue.length,
      today: today.length,
      completedToday,
    },
    sellers,
    ownerFilter: requestedOwnerId,
    lostReasons,
  };
}

export type CompleteTaskInput = {
  taskId: string;
  actingUser: ActingUser;
  result: TaskResultValue;
  resultNote?: string | null;
  nextActionDate?: string | null;
  nextActionTitle?: string | null;
  wonValue?: number | null;
  lostReasonId?: string | null;
  lostNote?: string | null;
  now?: Date;
};

function defaultNextActionTitle(result: TaskResultValue): string {
  if (result === "CALLBACK") return "Retorno combinado";
  if (result === "NO_ANSWER") return "Tentar novamente";
  return "Follow-up";
}

async function recomputeDealActivityInTransaction(
  tx: TenantTransactionClient,
  accountId: string,
  dealId: string,
  fallback: Date,
): Promise<void> {
  const latest = await tx.timelineEvent.findFirst({
    where: { accountId, dealId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  await tx.deal.update({
    where: { id: dealId },
    data: { lastActivityAt: latest?.createdAt ?? fallback },
  });
}

/**
 * Recalcula `last_activity_at` a partir do evento mais recente.
 * Exportado para manutenção/011; a conclusão usa a versão transacional.
 */
export async function recomputeDealActivity(dealId: string): Promise<void> {
  const db = tenantDb();
  const accountId = requireTenantContext().accountId;
  const now = new Date();
  await db.$transaction((tx) => recomputeDealActivityInTransaction(tx, accountId, dealId, now));
}

/**
 * Conclui a tarefa e já agenda a próxima — ou fecha o negócio.
 *
 * Tudo roda na mesma transação: se o fechamento falhar (motivo/valor), a
 * tarefa não fica concluída pela metade.
 */
export async function completeTask(input: CompleteTaskInput): Promise<{
  taskId: string;
  dealId: string;
  contactId: string;
  closed: boolean;
}> {
  const db = tenantDb();
  const accountId = requireTenantContext().accountId;
  const timezone = await getAccountTimeZone();
  const now = input.now ?? new Date();
  const resultNote = input.resultNote?.trim() || null;

  const task = await db.task.findFirst({
    where: {
      id: input.taskId,
      deal: { deletedAt: null },
    },
    select: {
      id: true,
      title: true,
      type: true,
      ownerId: true,
      dueAt: true,
      completedAt: true,
      deal: {
        select: {
          id: true,
          status: true,
          ownerId: true,
          value: true,
          contactId: true,
          nextActionAt: true,
        },
      },
    },
  });

  if (!task || (input.actingUser.role !== "ADMIN" && task.ownerId !== input.actingUser.id)) {
    throw new AppError("TASK_NOT_FOUND", "Tarefa não encontrada para este usuário.");
  }
  if (task.completedAt) {
    throw new AppError("TASK_ALREADY_COMPLETED", "Esta tarefa já foi concluída.");
  }
  if (task.deal.status !== "OPEN") {
    throw new AppError("DEAL_CLOSED", "Negócio fechado não recebe nova ação.");
  }

  const closeStatus = input.result === "WON" || input.result === "LOST" ? input.result : null;

  let nextActionAt: Date | null = null;
  if (!closeStatus) {
    if (!input.nextActionDate) {
      throw new AppError(
        "TASK_NEXT_ACTION_REQUIRED",
        "Defina a próxima ação antes de concluir a tarefa.",
      );
    }
    nextActionAt = parseDateKeyInTimeZone(input.nextActionDate, timezone, 9);
    if (!nextActionAt) {
      throw new AppError(
        "TASK_NEXT_ACTION_INVALID",
        "Informe uma data válida para a próxima ação.",
      );
    }
  } else if (closeStatus === "LOST") {
    await ensureDefaultLostReasons();
  }

  const outcome = await db.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: task.id },
      data: {
        completedAt: now,
        result: input.result,
        resultNote,
      },
    });

    await tx.timelineEvent.create({
      data: {
        accountId,
        type: "task.completed",
        payload: {
          taskId: task.id,
          title: task.title,
          result: input.result,
          note: resultNote,
        },
        dealId: task.deal.id,
        contactId: task.deal.contactId,
        actorId: input.actingUser.id,
      },
    });

    if (closeStatus) {
      const close = await applyDealCloseInTransaction(tx, {
        accountId,
        actorId: input.actingUser.id,
        deal: task.deal,
        status: closeStatus,
        value: closeStatus === "WON" ? (input.wonValue ?? null) : undefined,
        lostReasonId: input.lostReasonId,
        lostNote: input.lostNote,
        now,
        keepTaskId: task.id,
      });
      return { contactId: close.contactId, closed: true };
    }

    const title = input.nextActionTitle?.trim() || defaultNextActionTitle(input.result);
    const existingOpenTask = await tx.task.findFirst({
      where: {
        accountId,
        dealId: task.deal.id,
        completedAt: null,
        id: { not: task.id },
      },
      orderBy: { dueAt: "asc" },
      select: { id: true },
    });

    if (existingOpenTask) {
      await tx.task.update({
        where: { id: existingOpenTask.id },
        data: { dueAt: nextActionAt!, title, ownerId: task.deal.ownerId, type: task.type },
      });
    } else {
      await tx.task.create({
        data: {
          accountId,
          dealId: task.deal.id,
          ownerId: task.deal.ownerId,
          type: task.type,
          title,
          dueAt: nextActionAt!,
        },
      });
    }

    await tx.deal.update({
      where: { id: task.deal.id },
      data: { nextActionAt },
    });

    await tx.timelineEvent.create({
      data: {
        accountId,
        type: "deal.next_action_changed",
        payload: {
          from: task.deal.nextActionAt?.toISOString() ?? null,
          to: nextActionAt!.toISOString(),
        },
        dealId: task.deal.id,
        contactId: task.deal.contactId,
        actorId: input.actingUser.id,
      },
    });

    await recomputeDealActivityInTransaction(tx, accountId, task.deal.id, now);
    return { contactId: task.deal.contactId, closed: false };
  });

  trackEvent("task_completed", {
    result: input.result,
    closed: outcome.closed,
    has_note: resultNote !== null,
  });
  if (closeStatus) {
    trackEvent("deal_closed", { status: closeStatus });
  }

  return {
    taskId: task.id,
    dealId: task.deal.id,
    contactId: outcome.contactId,
    closed: outcome.closed,
  };
}

export type ScheduleNextActionInput = {
  id: string;
  actingUser: ActingUser;
  dueAt: Date;
  title?: string;
};

/** Cria/atualiza a próxima ação e mantém `deals.next_action_at` sincronizado. */
export async function scheduleNextAction(
  input: ScheduleNextActionInput,
): Promise<{ taskId: string; contactId: string }> {
  const db = tenantDb();
  const accountId = requireTenantContext().accountId;

  const deal = await db.deal.findFirst({
    where: { id: input.id, deletedAt: null, ...ownerScope(input.actingUser) },
    select: {
      id: true,
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
    where: { accountId, dealId: deal.id, completedAt: null },
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
      data: { nextActionAt: input.dueAt },
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

    await recomputeDealActivityInTransaction(tx, accountId, deal.id, now);
    return id;
  });

  return { taskId, contactId: deal.contactId };
}

/** Adia a próxima ação em 1 dia (atalho da tela do negócio). */
export async function deferDealNextAction(input: {
  id: string;
  actingUser: ActingUser;
}): Promise<{ oldDate: string | null; newDate: string; contactId: string }> {
  const db = tenantDb();
  const timezone = await getAccountTimeZone();

  const deal = await db.deal.findFirst({
    where: { id: input.id, deletedAt: null, ...ownerScope(input.actingUser) },
    select: { nextActionAt: true, contactId: true },
  });
  if (!deal) {
    throw new AppError("DEAL_NOT_FOUND", "Negócio não encontrado nesta conta.");
  }

  const oldDate = deal.nextActionAt ? dateKeyInTimeZone(deal.nextActionAt, timezone) : null;
  const newDate = addDaysToDateKey(oldDate ?? todayKeyInTimeZone(timezone), 1);
  const dueAt = parseDateKeyInTimeZone(newDate, timezone, 18);
  if (!dueAt) {
    throw new AppError("DEAL_DATE_INVALID", "Data inválida para adiar a ação.");
  }

  const result = await scheduleNextAction({ id: input.id, actingUser: input.actingUser, dueAt });
  return { oldDate, newDate, contactId: result.contactId };
}
