import { ownerScope } from "@/lib/access";
import { Prisma } from "@/lib/generated/prisma/client";
import { normalizePhoneBR } from "@/lib/phone";
import type { ContactOrigin } from "@/lib/schemas/contact";

import { tenantDb } from "@/lib/tenant-prisma";
import { AppError } from "@/server/errors";
import { resolveOwnerId, type ActingUser } from "@/server/services/owners";
import { logEvent } from "@/server/services/timeline";

/**
 * Contatos — leitura, edição e exclusão lógica (tarefa 005).
 *
 * Visibilidade por papel (`ownerScope`):
 * - ADMIN vê/edita todos os contatos da conta;
 * - SELLER vê/edita apenas os próprios (o recorte é aplicado no `where`).
 *
 * O `accountId` nunca vem do client: o client de tenant o injeta em toda query.
 */

export const CONTACTS_PAGE_SIZE = 20;

export type ContactListItem = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  companyText: string | null;
  origin: ContactOrigin | null;
  owner: { id: string; name: string } | null;
  dealsCount: number;
  createdAt: Date;
};

export type ListContactsInput = {
  actingUser: ActingUser;
  query?: string;
  page?: number;
  pageSize?: number;
};

export type ListContactsResult = {
  items: ContactListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function listContacts(input: ListContactsInput): Promise<ListContactsResult> {
  const db = tenantDb();
  const pageSize = Math.min(50, Math.max(1, input.pageSize ?? CONTACTS_PAGE_SIZE));
  const requestedPage = Math.max(1, Math.floor(input.page ?? 1));
  const query = input.query?.trim() ?? "";

  const where: Prisma.ContactWhereInput = {
    deletedAt: null,
    ...ownerScope(input.actingUser),
  };

  if (query) {
    const digits = query.replace(/\D/g, "");
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      ...(digits ? [{ phone: { contains: digits } }] : []),
    ];
  }

  // Conta antes de paginar para clampar `page` (ex.: ?page=999 não mostra uma
  // lista vazia enganosa) e para a UI exibir "Página X de Y" correto.
  const total = await db.contact.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);

  const rows = await db.contact.findMany({
    where,
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      companyText: true,
      origin: true,
      createdAt: true,
      owner: { select: { id: true, name: true } },
      _count: { select: { deals: { where: { deletedAt: null } } } },
    },
  });

  return {
    items: rows.map(({ _count, ...row }) => ({
      ...row,
      origin: row.origin as ContactOrigin | null,
      dealsCount: _count.deals,
    })),
    total,
    page,
    pageSize,
    totalPages,
  };
}

export type ContactDealSummary = {
  id: string;
  title: string;
  status: "OPEN" | "WON" | "LOST";
  value: number | null;
  stageName: string;
  nextActionAt: Date | null;
  createdAt: Date;
};

export type ContactNoteSummary = {
  id: string;
  text: string;
  authorName: string;
  createdAt: Date;
};

export type ContactTimelineEvent = {
  id: string;
  type: string;
  payload: unknown;
  createdAt: Date;
  actorName: string | null;
};

export type ContactDetail = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  companyText: string | null;
  origin: ContactOrigin | null;
  owner: { id: string; name: string } | null;
  deals: ContactDealSummary[];
  notes: ContactNoteSummary[];
  timeline: ContactTimelineEvent[];
  createdAt: Date;
  updatedAt: Date;
};

export async function getContact(input: {
  id: string;
  actingUser: ActingUser;
}): Promise<ContactDetail | null> {
  const contact = await tenantDb().contact.findFirst({
    where: {
      id: input.id,
      deletedAt: null,
      ...ownerScope(input.actingUser),
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      companyText: true,
      origin: true,
      createdAt: true,
      updatedAt: true,
      owner: { select: { id: true, name: true } },
      deals: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          value: true,
          nextActionAt: true,
          createdAt: true,
          stage: { select: { name: true } },
        },
      },
      notes: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          text: true,
          createdAt: true,
          author: { select: { name: true } },
        },
      },
      timelineEvents: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          type: true,
          payload: true,
          createdAt: true,
          actor: { select: { name: true } },
        },
      },
    },
  });

  if (!contact) return null;

  return {
    id: contact.id,
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    companyText: contact.companyText,
    origin: contact.origin as ContactOrigin | null,
    owner: contact.owner,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
    deals: contact.deals.map((deal) => ({
      id: deal.id,
      title: deal.title,
      status: deal.status,
      value: deal.value === null ? null : Number(deal.value),
      stageName: deal.stage.name,
      nextActionAt: deal.nextActionAt,
      createdAt: deal.createdAt,
    })),
    notes: contact.notes.map((note) => ({
      id: note.id,
      text: note.text,
      authorName: note.author.name,
      createdAt: note.createdAt,
    })),
    timeline: contact.timelineEvents.map((event) => ({
      id: event.id,
      type: event.type,
      payload: event.payload,
      createdAt: event.createdAt,
      actorName: event.actor?.name ?? null,
    })),
  };
}

export type UpdateContactInput = {
  id: string;
  actingUser: ActingUser;
  name: string;
  phone: string;
  email?: string | null;
  companyText?: string | null;
  origin?: ContactOrigin | null;
  ownerId?: string | null;
};

function optionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function updateContact(input: UpdateContactInput): Promise<void> {
  const name = input.name.trim();
  if (name.length < 2) {
    throw new AppError("CONTACT_NAME_INVALID", "Informe o nome do contato (mín. 2 caracteres).");
  }

  const phone = normalizePhoneBR(input.phone);
  if (!phone) {
    throw new AppError(
      "CONTACT_PHONE_INVALID",
      "Telefone inválido. Use DDD + número (ex.: (11) 98765-4321).",
    );
  }

  const db = tenantDb();

  const existing = await db.contact.findFirst({
    where: { id: input.id, deletedAt: null, ...ownerScope(input.actingUser) },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      companyText: true,
      origin: true,
      ownerId: true,
    },
  });
  if (!existing) {
    throw new AppError("CONTACT_NOT_FOUND", "Contato não encontrado nesta conta.");
  }

  const duplicate = await db.contact.findFirst({
    where: { phone, NOT: { id: existing.id } },
    select: { id: true },
  });
  if (duplicate) {
    throw new AppError("CONTACT_PHONE_TAKEN", "Já existe outro contato com este telefone.");
  }

  const ownerId =
    input.ownerId === undefined
      ? existing.ownerId
      : await resolveOwnerId(db, input.actingUser, input.ownerId);
  const email =
    input.email === undefined ? existing.email : (optionalText(input.email)?.toLowerCase() ?? null);
  const companyText =
    input.companyText === undefined ? existing.companyText : optionalText(input.companyText);
  const origin = input.origin === undefined ? existing.origin : input.origin;

  const changedFields = (
    [
      ["name", existing.name, name],
      ["phone", existing.phone, phone],
      ["email", existing.email, email],
      ["companyText", existing.companyText, companyText],
      ["origin", existing.origin, origin],
      ["ownerId", existing.ownerId, ownerId],
    ] as const
  )
    .filter(([, before, after]) => before !== after)
    .map(([field]) => field);

  if (changedFields.length === 0) return;

  await db.$transaction(async (tx) => {
    await tx.contact.update({
      where: { id: existing.id },
      data: { name, phone, email, companyText, origin, ownerId },
    });

    await logEvent({
      type: "contact.updated",
      payload: { fields: changedFields },
      contactId: existing.id,
      actorId: input.actingUser.id,
      client: tx,
    });
  });
}

/**
 * Exclusão lógica do contato (RF-10/008).
 *
 * Para não deixar "fantasmas" no funil nem na tela "Hoje":
 * - negócios ABERTOS do contato são marcados como excluídos (`deals.deleted_at`);
 * - tarefas abertas desses negócios são removidas (eram ações futuras);
 * - negócios GANHOS/PERDIDOS e tarefas concluídas permanecem como histórico.
 *
 * Tudo em uma transação + eventos na timeline.
 */
export async function softDeleteContact(input: {
  id: string;
  actingUser: ActingUser;
}): Promise<void> {
  const db = tenantDb();

  const contact = await db.contact.findFirst({
    where: { id: input.id, deletedAt: null, ...ownerScope(input.actingUser) },
    select: { id: true, name: true },
  });
  if (!contact) {
    throw new AppError("CONTACT_NOT_FOUND", "Contato não encontrado nesta conta.");
  }

  const now = new Date();

  await db.$transaction(async (tx) => {
    const openDeals = await tx.deal.findMany({
      where: { contactId: contact.id, status: "OPEN", deletedAt: null },
      select: { id: true },
    });

    if (openDeals.length > 0) {
      const dealIds = openDeals.map((deal) => deal.id);

      await tx.task.deleteMany({
        where: { dealId: { in: dealIds }, completedAt: null },
      });

      await tx.deal.updateMany({
        where: { id: { in: dealIds } },
        data: { deletedAt: now, nextActionAt: null },
      });

      for (const deal of openDeals) {
        await logEvent({
          type: "deal.deleted",
          payload: { reason: "contact.deleted" },
          dealId: deal.id,
          contactId: contact.id,
          actorId: input.actingUser.id,
          client: tx,
        });
      }
    }

    await tx.contact.update({
      where: { id: contact.id },
      data: { deletedAt: now },
    });

    await logEvent({
      type: "contact.deleted",
      payload: { name: contact.name },
      contactId: contact.id,
      actorId: input.actingUser.id,
      client: tx,
    });
  });
}
