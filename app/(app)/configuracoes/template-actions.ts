"use server";

import { revalidatePath } from "next/cache";

import { messageTemplateSchema } from "@/lib/schemas/message-template";
import { withAdmin } from "@/lib/session";
import { AppError } from "@/server/errors";
import {
  createMessageTemplate,
  deleteMessageTemplate,
  updateMessageTemplate,
} from "@/server/services/message-templates";

/**
 * CRUD de modelos de mensagem (RF-36) — só ADMIN.
 *
 * O client manda o formulário inteiro; o servidor revalida com Zod, confere se
 * a etapa sugerida pertence à conta e mantém nomes únicos (sem caixa).
 */

export type MessageTemplateFormState = { error?: string; success?: string } | null;

const GENERIC_ERROR = "Não foi possível salvar agora. Tente novamente em instantes.";

function parseForm(formData: FormData) {
  return messageTemplateSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    body: String(formData.get("body") ?? ""),
    suggestedStageId: String(formData.get("suggestedStageId") ?? "") || undefined,
  });
}

function errorMessage(error: unknown, context: string): string {
  if (error instanceof AppError) return error.message;
  console.error(`[modelos-mensagem] ${context}:`, error);
  return GENERIC_ERROR;
}

function revalidateConsumers(): void {
  revalidatePath("/configuracoes");
  revalidatePath("/hoje");
}

export async function createMessageTemplateAction(
  _previous: MessageTemplateFormState,
  formData: FormData,
): Promise<MessageTemplateFormState> {
  return withAdmin(async () => {
    const parsed = parseForm(formData);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    }

    try {
      await createMessageTemplate(parsed.data);
    } catch (error) {
      return { error: errorMessage(error, "Erro ao criar") };
    }

    revalidateConsumers();
    return { success: "Modelo criado." };
  });
}

export async function updateMessageTemplateAction(
  _previous: MessageTemplateFormState,
  formData: FormData,
): Promise<MessageTemplateFormState> {
  return withAdmin(async () => {
    const id = String(formData.get("id") ?? "").trim();
    if (!id) return { error: "Modelo inválido." };

    const parsed = parseForm(formData);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    }

    try {
      await updateMessageTemplate({ id, ...parsed.data });
    } catch (error) {
      return { error: errorMessage(error, "Erro ao atualizar") };
    }

    revalidateConsumers();
    return { success: "Modelo atualizado." };
  });
}

export async function deleteMessageTemplateAction(
  _previous: MessageTemplateFormState,
  formData: FormData,
): Promise<MessageTemplateFormState> {
  return withAdmin(async () => {
    const id = String(formData.get("id") ?? "").trim();
    if (!id) return { error: "Modelo inválido." };

    try {
      await deleteMessageTemplate(id);
    } catch (error) {
      return { error: errorMessage(error, "Erro ao excluir") };
    }

    revalidateConsumers();
    return { success: "Modelo excluído." };
  });
}
