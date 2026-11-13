"use server";

import { revalidatePath } from "next/cache";

import { publicFormSettingsSchema } from "@/lib/schemas/public-form";
import { withAdmin } from "@/lib/session";
import { AppError } from "@/server/errors";
import { updatePublicFormSettings } from "@/server/services/public-form";

/**
 * Configuração do formulário público (tarefa 010).
 *
 * O client manda o formulário inteiro; o servidor revalida com Zod, confere o
 * dono do link (namespace global) e o responsável escolhido.
 */

export type PublicFormSettingsState = { error?: string; success?: boolean } | null;

const GENERIC_ERROR = "Não foi possível salvar agora. Tente novamente em instantes.";

export async function updatePublicFormSettingsAction(
  _previous: PublicFormSettingsState,
  formData: FormData,
): Promise<PublicFormSettingsState> {
  return withAdmin(async () => {
    const parsed = publicFormSettingsSchema.safeParse({
      enabled: formData.get("enabled") === "on",
      slug: String(formData.get("slug") ?? ""),
      title: String(formData.get("title") ?? ""),
      message: String(formData.get("message") ?? ""),
      whatsapp: String(formData.get("whatsapp") ?? "") || undefined,
      ownerId: String(formData.get("ownerId") ?? "") || undefined,
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    }

    try {
      await updatePublicFormSettings(parsed.data);
    } catch (error) {
      if (error instanceof AppError) return { error: error.message };
      console.error("[formulario-publico] Erro ao salvar configuração:", error);
      return { error: GENERIC_ERROR };
    }

    revalidatePath("/configuracoes");
    revalidatePath(`/f/${parsed.data.slug}`);
    revalidatePath("/f/[slug]", "page");
    return { success: true };
  });
}
