"use server";

import { revalidatePath } from "next/cache";

import { firstPipelineIssueMessage, pipelineStagesSchema } from "@/lib/schemas/pipeline";
import { withAdmin } from "@/lib/session";
import { AppError } from "@/server/errors";
import { updatePipelineStages, type StageRef } from "@/server/services/pipeline";

/**
 * Edição das etapas do funil (RF-24) — só ADMIN.
 *
 * O formulário envia listas repetidas na ordem exibida (`stageId`,
 * `stageName`, `stageProbability`). O servidor revalida com Zod e o serviço
 * confere se os IDs ainda são exatamente os do funil da conta.
 */

export type PipelineStagesFormState = {
  error?: string;
  success?: string;
  stages?: StageRef[];
} | null;

const GENERIC_ERROR = "Não foi possível salvar agora. Tente novamente em instantes.";

function parseForm(formData: FormData) {
  const ids = formData.getAll("stageId").map((value) => String(value));
  const names = formData.getAll("stageName").map((value) => String(value));
  const probabilities = formData.getAll("stageProbability").map((value) => String(value));

  if (ids.length !== names.length || ids.length !== probabilities.length) return null;

  return pipelineStagesSchema.safeParse({
    stages: ids.map((id, index) => ({
      id,
      name: names[index] ?? "",
      probability: probabilities[index] ?? "",
    })),
  });
}

function revalidateConsumers(): void {
  revalidatePath("/configuracoes");
  revalidatePath("/negocios");
  revalidatePath("/negocios/novo");
  revalidatePath("/negocios/[id]", "page");
  revalidatePath("/contatos");
  revalidatePath("/contatos/[id]", "page");
  revalidatePath("/painel");
  revalidatePath("/painel/carteira");
  revalidatePath("/hoje");
}

export async function updatePipelineStagesAction(
  _previous: PipelineStagesFormState,
  formData: FormData,
): Promise<PipelineStagesFormState> {
  return withAdmin(async () => {
    const parsed = parseForm(formData);
    if (!parsed) return { error: "Dados inválidos." };
    if (!parsed.success) {
      return { error: firstPipelineIssueMessage(parsed.error) };
    }

    let stages: StageRef[];
    try {
      stages = await updatePipelineStages(parsed.data.stages);
    } catch (error) {
      if (error instanceof AppError) return { error: error.message };
      console.error("[etapas-funil] Erro ao atualizar:", error);
      return { error: GENERIC_ERROR };
    }

    revalidateConsumers();
    return { success: "Etapas atualizadas.", stages };
  });
}
