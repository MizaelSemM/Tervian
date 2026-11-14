"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createLeadSchema,
  firstContactIssueMessage,
  updateContactSchema,
} from "@/lib/schemas/contact";
import { withSession, withAdmin, type AuthedSession } from "@/lib/session";
import { AppError } from "@/server/errors";
import { softDeleteContact, updateContact } from "@/server/services/contacts";
import { purgeContact } from "@/server/services/lgpd";
import { createNote, deleteNote, updateNote } from "@/server/services/notes";
import { createLead, type DuplicateContact } from "@/server/services/leads";
import type { ActingUser } from "@/server/services/owners";

/**
 * Server Actions de contatos (tarefa 005).
 *
 * Toda ação roda dentro de `withSession` (sessão real + contexto de tenant) e
 * revalida os dados com os schemas — o client nunca é fonte de verdade.
 */

export type CreateContactFormState = {
  error?: string;
  duplicate?: DuplicateContact;
} | null;

export type ContactActionState = { error?: string } | null;

const GENERIC_ERROR = "Não foi possível concluir agora. Tente novamente em instantes.";

function actingUserFrom(session: AuthedSession): ActingUser {
  return {
    id: session.user.id,
    role: session.user.role === "ADMIN" ? "ADMIN" : "SELLER",
  };
}

function captureSecondsFrom(formData: FormData): number | undefined {
  const startedAt = Number(formData.get("startedAt"));
  if (!Number.isFinite(startedAt) || startedAt <= 0) return undefined;
  const seconds = Math.round((Date.now() - startedAt) / 1000);
  return seconds >= 0 && seconds < 60 * 60 ? seconds : undefined;
}

export async function createContactAction(
  _previous: CreateContactFormState,
  formData: FormData,
): Promise<CreateContactFormState> {
  return withSession(async (session) => {
    const parsed = createLeadSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { error: firstContactIssueMessage(parsed.error) };

    let result: Awaited<ReturnType<typeof createLead>>;
    try {
      result = await createLead({
        actingUser: actingUserFrom(session),
        ...parsed.data,
        source: "manual",
        captureSeconds: captureSecondsFrom(formData),
      });
    } catch (error) {
      if (error instanceof AppError) return { error: error.message };
      console.error("[contatos] Erro ao criar lead:", error);
      return { error: GENERIC_ERROR };
    }

    if (result.status === "duplicate") {
      return { duplicate: result.contact };
    }

    revalidatePath("/contatos");
    redirect(`/contatos/${result.contactId}?novo=1`);
  });
}

export async function updateContactAction(
  _previous: ContactActionState,
  formData: FormData,
): Promise<ContactActionState> {
  return withSession(async (session) => {
    const id = String(formData.get("id") ?? "");
    if (!id) return { error: "Contato inválido." };

    const parsed = updateContactSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { error: firstContactIssueMessage(parsed.error) };

    try {
      await updateContact({
        id,
        actingUser: actingUserFrom(session),
        ...parsed.data,
      });
    } catch (error) {
      if (error instanceof AppError) return { error: error.message };
      console.error("[contatos] Erro ao editar contato:", error);
      return { error: GENERIC_ERROR };
    }

    revalidatePath("/contatos");
    revalidatePath(`/contatos/${id}`);
    redirect(`/contatos/${id}?salvo=1`);
  });
}

export async function deleteContactAction(
  _previous: ContactActionState,
  formData: FormData,
): Promise<ContactActionState> {
  return withSession(async (session) => {
    const id = String(formData.get("id") ?? "");
    if (!id) return { error: "Contato inválido." };

    try {
      await softDeleteContact({ id, actingUser: actingUserFrom(session) });
    } catch (error) {
      if (error instanceof AppError) return { error: error.message };
      console.error("[contatos] Erro ao excluir contato:", error);
      return { error: GENERIC_ERROR };
    }

    revalidatePath("/contatos");
    redirect("/contatos?excluido=1");
  });
}

/**
 * Exclusão definitiva (LGPD): apaga contato + negócios + tarefas + notas +
 * timeline. Diferente de `deleteContactAction`, que só marca `deletedAt`.
 * Exige confirmação digitada e papel ADMIN, revalidado no servidor.
 */
export async function purgeContactAction(
  contactId: string,
  confirmation: string,
): Promise<ContactActionState> {
  return withAdmin(async (session) => {
    if (!contactId) return { error: "Contato inválido." };
    if (confirmation.trim().toUpperCase() !== "EXCLUIR") {
      return { error: "Digite EXCLUIR para confirmar a remoção definitiva." };
    }

    try {
      await purgeContact({ contactId, actingUser: actingUserFrom(session) });
    } catch (error) {
      if (error instanceof AppError) return { error: error.message };
      console.error("[contatos] Erro ao excluir contato definitivamente:", error);
      return { error: GENERIC_ERROR };
    }

    revalidatePath("/contatos");
    revalidatePath("/hoje");
    revalidatePath("/negocios");
    return null;
  });
}

export async function createContactNoteAction(
  _previous: ContactActionState,
  formData: FormData,
): Promise<ContactActionState> {
  return withSession(async (session) => {
    const contactId = String(formData.get("contactId") ?? "").trim();
    const text = String(formData.get("text") ?? "");
    if (!contactId) return { error: "Contato inválido." };

    try {
      await createNote({
        actingUser: actingUserFrom(session),
        contactId,
        text,
      });
    } catch (error) {
      if (error instanceof AppError) return { error: error.message };
      console.error("[contatos] Erro ao criar nota:", error);
      return { error: GENERIC_ERROR };
    }

    revalidatePath(`/contatos/${contactId}`);
    return null;
  });
}

export async function deleteContactNoteAction(
  noteId: string,
  contactId: string,
): Promise<ContactActionState> {
  return withSession(async (session) => {
    try {
      await deleteNote({ id: noteId, actingUser: actingUserFrom(session) });
    } catch (error) {
      if (error instanceof AppError) return { error: error.message };
      console.error("[contatos] Erro ao excluir nota:", error);
      return { error: GENERIC_ERROR };
    }

    revalidatePath(`/contatos/${contactId}`);
    return null;
  });
}
export async function updateContactNoteAction(
  _previous: ContactActionState,
  formData: FormData,
): Promise<ContactActionState> {
  return withSession(async (session) => {
    const noteId = String(formData.get("noteId") ?? "").trim();
    const contactId = String(formData.get("contactId") ?? "").trim();
    const text = String(formData.get("text") ?? "");
    if (!noteId || !contactId) return { error: "Nota inv�lida." };

    try {
      await updateNote({
        id: noteId,
        actingUser: actingUserFrom(session),
        text,
      });
    } catch (error) {
      if (error instanceof AppError) return { error: error.message };
      console.error("[contatos] Erro ao editar nota:", error);
      return { error: GENERIC_ERROR };
    }

    revalidatePath(`/contatos/${contactId}`);
    return null;
  });
}
