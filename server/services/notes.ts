import { ownerScope } from "@/lib/access";
import { requireTenantContext } from "@/lib/tenant-context";
import { tenantDb } from "@/lib/tenant-prisma";
import { AppError } from "@/server/errors";
import { logEvent } from "@/server/services/timeline";
import type { ActingUser } from "@/server/services/owners";

export type NoteDetail = {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  dealId: string | null;
  contactId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateNoteInput = {
  actingUser: ActingUser;
  text: string;
  dealId?: string | null;
  contactId?: string | null;
};

export type UpdateNoteInput = {
  id: string;
  actingUser: ActingUser;
  text: string;
};

export type DeleteNoteInput = {
  id: string;
  actingUser: ActingUser;
};

function normalizeText(value: string): string {
  const text = value.trim();
  if (text.length < 1) {
    throw new AppError("NOTE_TEXT_INVALID", "A nota não pode ser vazia.");
  }
  if (text.length > 2000) {
    throw new AppError("NOTE_TEXT_TOO_LONG", "A nota pode ter no máximo 2000 caracteres.");
  }
  return text;
}

async function ensureDealAccess(
  db: ReturnType<typeof tenantDb>,
  dealId: string,
  actingUser: ActingUser,
) {
  const deal = await db.deal.findFirst({
    where: { id: dealId, deletedAt: null, ...ownerScope(actingUser) },
    select: { id: true },
  });
  if (!deal) throw new AppError("DEAL_NOT_FOUND", "Negócio não encontrado nesta conta.");
}

async function ensureContactAccess(
  db: ReturnType<typeof tenantDb>,
  contactId: string,
  actingUser: ActingUser,
) {
  const contact = await db.contact.findFirst({
    where: { id: contactId, deletedAt: null, ...ownerScope(actingUser) },
    select: { id: true },
  });
  if (!contact) throw new AppError("CONTACT_NOT_FOUND", "Contato não encontrado nesta conta.");
}

export async function createNote(input: CreateNoteInput): Promise<NoteDetail> {
  const db = tenantDb();
  const accountId = requireTenantContext().accountId;
  const text = normalizeText(input.text);
  const dealId = input.dealId?.trim() || null;
  const contactId = input.contactId?.trim() || null;

  if (!dealId && !contactId) {
    throw new AppError(
      "NOTE_TARGET_REQUIRED",
      "A nota precisa estar vinculada a um negócio ou contato.",
    );
  }

  if (dealId) await ensureDealAccess(db, dealId, input.actingUser);
  if (contactId) await ensureContactAccess(db, contactId, input.actingUser);

  const note = await db.note.create({
    data: {
      accountId,
      authorId: input.actingUser.id,
      dealId,
      contactId,
      text,
    },
    select: {
      id: true,
      text: true,
      authorId: true,
      dealId: true,
      contactId: true,
      createdAt: true,
      updatedAt: true,
      author: { select: { name: true } },
    },
  });

  await logEvent({
    type: "note.added",
    payload: { noteId: note.id, preview: text.slice(0, 120) },
    dealId,
    contactId,
    actorId: input.actingUser.id,
  });

  return {
    id: note.id,
    text: note.text,
    authorId: note.authorId,
    authorName: note.author.name,
    dealId: note.dealId,
    contactId: note.contactId,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

export async function updateNote(input: UpdateNoteInput): Promise<NoteDetail> {
  const db = tenantDb();
  const text = normalizeText(input.text);

  const existing = await db.note.findFirst({
    where: { id: input.id },
    select: {
      id: true,
      text: true,
      authorId: true,
      dealId: true,
      contactId: true,
      createdAt: true,
      updatedAt: true,
      author: { select: { name: true } },
      deal: { select: { ownerId: true, deletedAt: true } },
      contact: { select: { ownerId: true, deletedAt: true } },
    },
  });

  if (!existing) {
    throw new AppError("NOTE_NOT_FOUND", "Nota não encontrada nesta conta.");
  }
  if (existing.deal?.deletedAt || existing.contact?.deletedAt) {
    throw new AppError(
      "NOTE_TARGET_NOT_FOUND",
      "O registro vinculado à nota não está mais disponível.",
    );
  }
  if (input.actingUser.role !== "ADMIN" && existing.authorId !== input.actingUser.id) {
    throw new AppError("NOTE_FORBIDDEN", "Você não pode editar esta nota.");
  }
  if (
    existing.deal &&
    input.actingUser.role !== "ADMIN" &&
    existing.deal.ownerId !== input.actingUser.id
  ) {
    throw new AppError("NOTE_FORBIDDEN", "Você não pode editar esta nota.");
  }
  if (
    existing.contact &&
    input.actingUser.role !== "ADMIN" &&
    existing.contact.ownerId !== input.actingUser.id
  ) {
    throw new AppError("NOTE_FORBIDDEN", "Você não pode editar esta nota.");
  }

  const updated = await db.note.update({
    where: { id: existing.id },
    data: { text },
    select: {
      id: true,
      text: true,
      authorId: true,
      dealId: true,
      contactId: true,
      createdAt: true,
      updatedAt: true,
      author: { select: { name: true } },
    },
  });

  await logEvent({
    type: "note.updated",
    payload: { noteId: updated.id, previous: existing.text.slice(0, 120) },
    dealId: updated.dealId,
    contactId: updated.contactId,
    actorId: input.actingUser.id,
  });

  return {
    id: updated.id,
    text: updated.text,
    authorId: updated.authorId,
    authorName: updated.author.name,
    dealId: updated.dealId,
    contactId: updated.contactId,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}

export async function deleteNote(input: DeleteNoteInput): Promise<void> {
  const db = tenantDb();

  const existing = await db.note.findFirst({
    where: { id: input.id },
    select: {
      id: true,
      authorId: true,
      dealId: true,
      contactId: true,
      deal: { select: { ownerId: true, deletedAt: true } },
      contact: { select: { ownerId: true, deletedAt: true } },
    },
  });

  if (!existing) {
    throw new AppError("NOTE_NOT_FOUND", "Nota não encontrada nesta conta.");
  }
  if (existing.deal?.deletedAt || existing.contact?.deletedAt) {
    throw new AppError(
      "NOTE_TARGET_NOT_FOUND",
      "O registro vinculado à nota não está mais disponível.",
    );
  }
  if (input.actingUser.role !== "ADMIN" && existing.authorId !== input.actingUser.id) {
    throw new AppError("NOTE_FORBIDDEN", "Você não pode excluir esta nota.");
  }
  if (
    existing.deal &&
    input.actingUser.role !== "ADMIN" &&
    existing.deal.ownerId !== input.actingUser.id
  ) {
    throw new AppError("NOTE_FORBIDDEN", "Você não pode excluir esta nota.");
  }
  if (
    existing.contact &&
    input.actingUser.role !== "ADMIN" &&
    existing.contact.ownerId !== input.actingUser.id
  ) {
    throw new AppError("NOTE_FORBIDDEN", "Você não pode excluir esta nota.");
  }

  await logEvent({
    type: "note.deleted",
    payload: { noteId: existing.id },
    dealId: existing.dealId,
    contactId: existing.contactId,
    actorId: input.actingUser.id,
  });

  await db.note.delete({ where: { id: existing.id } });
}
