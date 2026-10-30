"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  closeDealSchema,
  createDealSchema,
  firstDealIssueMessage,
  rescheduleDealSchema,
  updateDealSchema,
} from "@/lib/schemas/deal";
import { withSession, type AuthedSession } from "@/lib/session";
import { parseDateKeyBR } from "@/lib/utils";
import { AppError } from "@/server/errors";
import { closeDeal, createDeal, moveDeal, updateDeal } from "@/server/services/deals";
import { deferDealNextAction, scheduleNextAction } from "@/server/services/followup";
import type { ActingUser } from "@/server/services/owners";

/**
 * Server Actions de negócios (tarefa 006).
 *
 * Toda ação roda dentro de `withSession` (sessão real + contexto de tenant) e
 * revalida os dados com os schemas. O client nunca é fonte de verdade.
 */

export type DealFormState = { error?: string } | null;

export type ResultActionState =
  | { ok: true }
  | { ok: false; error: string }
  | { ok: true; oldDate: string | null; newDate: string };

const GENERIC_ERROR = "Não foi possível concluir agora. Tente novamente em instantes.";

function actingUserFrom(session: AuthedSession): ActingUser {
  return {
    id: session.user.id,
    role: session.user.role === "ADMIN" ? "ADMIN" : "SELLER",
  };
}

function revalidateDealPaths(dealId: string, contactId?: string): void {
  revalidatePath("/negocios");
  revalidatePath(`/negocios/${dealId}`);
  if (contactId) {
    revalidatePath(`/contatos/${contactId}`);
    revalidatePath("/contatos");
  }
}

export async function createDealAction(
  _previous: DealFormState,
  formData: FormData,
): Promise<DealFormState> {
  return withSession(async (session) => {
    const parsed = createDealSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { error: firstDealIssueMessage(parsed.error) };

    const nextActionAt = parseDateKeyBR(parsed.data.nextActionAt);
    if (!nextActionAt) return { error: "Informe uma próxima ação válida." };
    const expectedCloseAt = parsed.data.expectedCloseAt
      ? parseDateKeyBR(parsed.data.expectedCloseAt, 12)
      : null;
    if (parsed.data.expectedCloseAt && !expectedCloseAt) {
      return { error: "Informe uma data prevista válida." };
    }

    let result: Awaited<ReturnType<typeof createDeal>>;
    try {
      result = await createDeal({
        actingUser: actingUserFrom(session),
        contactId: parsed.data.contactId,
        title: parsed.data.title,
        value: parsed.data.value ?? null,
        stageId: parsed.data.stageId ?? null,
        ownerId: parsed.data.ownerId ?? null,
        expectedCloseAt,
        nextActionAt,
      });
    } catch (error) {
      if (error instanceof AppError) return { error: error.message };
      console.error("[negocios] Erro ao criar negócio:", error);
      return { error: GENERIC_ERROR };
    }

    revalidateDealPaths(result.dealId, result.contactId);
    redirect(`/negocios/${result.dealId}?novo=1`);
  });
}

export async function updateDealAction(
  _previous: DealFormState,
  formData: FormData,
): Promise<DealFormState> {
  return withSession(async (session) => {
    const parsed = updateDealSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { error: firstDealIssueMessage(parsed.error) };

    const expectedCloseAt = parsed.data.expectedCloseAt
      ? parseDateKeyBR(parsed.data.expectedCloseAt, 12)
      : null;
    if (parsed.data.expectedCloseAt && !expectedCloseAt) {
      return { error: "Informe uma data prevista válida." };
    }

    let result: Awaited<ReturnType<typeof updateDeal>>;
    try {
      result = await updateDeal({
        id: parsed.data.id,
        actingUser: actingUserFrom(session),
        title: parsed.data.title,
        value: parsed.data.value ?? null,
        ownerId: parsed.data.ownerId,
        expectedCloseAt,
      });
    } catch (error) {
      if (error instanceof AppError) return { error: error.message };
      console.error("[negocios] Erro ao editar negócio:", error);
      return { error: GENERIC_ERROR };
    }

    revalidateDealPaths(parsed.data.id, result.contactId);
    redirect(`/negocios/${parsed.data.id}?salvo=1`);
  });
}

/** Chamado pelo drag-and-drop e pelo select de etapa. */
export async function moveDealAction(
  dealId: string,
  toStageId: string,
): Promise<ResultActionState> {
  if (!dealId || !toStageId) return { ok: false, error: "Negócio ou etapa inválidos." };

  return withSession(async (session) => {
    try {
      const result = await moveDeal({
        id: dealId,
        actingUser: actingUserFrom(session),
        toStageId,
      });
      revalidateDealPaths(dealId, result.contactId);
      return { ok: true };
    } catch (error) {
      if (error instanceof AppError) return { ok: false, error: error.message };
      console.error("[negocios] Erro ao mover negócio:", error);
      return { ok: false, error: GENERIC_ERROR };
    }
  });
}

export async function rescheduleDealAction(
  dealId: string,
  date: string,
): Promise<ResultActionState> {
  return withSession(async (session) => {
    const parsed = rescheduleDealSchema.safeParse({ id: dealId, date });
    if (!parsed.success) return { ok: false, error: firstDealIssueMessage(parsed.error) };

    const dueAt = parseDateKeyBR(parsed.data.date);
    if (!dueAt) return { ok: false, error: "Informe uma data válida." };

    try {
      const result = await scheduleNextAction({
        id: parsed.data.id,
        actingUser: actingUserFrom(session),
        dueAt,
      });
      revalidateDealPaths(parsed.data.id, result.contactId);
      return { ok: true };
    } catch (error) {
      if (error instanceof AppError) return { ok: false, error: error.message };
      console.error("[negocios] Erro ao reagendar próxima ação:", error);
      return { ok: false, error: GENERIC_ERROR };
    }
  });
}

/** Atalho "Adiar 1 dia" — devolve a data antiga para o toast de desfazer. */
export async function deferDealAction(dealId: string): Promise<ResultActionState> {
  return withSession(async (session) => {
    try {
      const result = await deferDealNextAction({
        id: dealId,
        actingUser: actingUserFrom(session),
      });
      revalidateDealPaths(dealId, result.contactId);
      return { ok: true, oldDate: result.oldDate, newDate: result.newDate };
    } catch (error) {
      if (error instanceof AppError) return { ok: false, error: error.message };
      console.error("[negocios] Erro ao adiar próxima ação:", error);
      return { ok: false, error: GENERIC_ERROR };
    }
  });
}

export async function closeDealAction(
  _previous: DealFormState,
  formData: FormData,
): Promise<DealFormState> {
  return withSession(async (session) => {
    const parsed = closeDealSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { error: firstDealIssueMessage(parsed.error) };

    let result: Awaited<ReturnType<typeof closeDeal>>;
    try {
      result = await closeDeal({
        id: parsed.data.id,
        actingUser: actingUserFrom(session),
        status: parsed.data.status,
        value: parsed.data.value ?? null,
        lostReasonId: parsed.data.lostReasonId ?? null,
        lostNote: parsed.data.lostNote ?? null,
      });
    } catch (error) {
      if (error instanceof AppError) return { error: error.message };
      console.error("[negocios] Erro ao fechar negócio:", error);
      return { error: GENERIC_ERROR };
    }

    revalidateDealPaths(parsed.data.id, result.contactId);
    redirect(`/negocios/${parsed.data.id}?fechado=${parsed.data.status.toLowerCase()}`);
  });
}
