"use server";

import { revalidatePath } from "next/cache";

import { completeTaskSchema, firstFollowupIssueMessage } from "@/lib/schemas/followup";
import { withSession, type AuthedSession } from "@/lib/session";
import { AppError } from "@/server/errors";
import { completeTask } from "@/server/services/followup";
import type { ActingUser } from "@/server/services/owners";

/**
 * Conclusão de tarefa na tela "Hoje" (tarefa 007).
 *
 * O client manda só a intenção (resultado + próxima data); o servidor revalida
 * tudo e decide sozinho o dono do negócio, a conta e as regras de fechamento.
 */

export type CompleteTaskActionResult = { ok: true } | { ok: false; error: string };

const GENERIC_ERROR = "Não foi possível concluir a tarefa. Tente novamente em instantes.";

function actingUserFrom(session: AuthedSession): ActingUser {
  return {
    id: session.user.id,
    role: session.user.role === "ADMIN" ? "ADMIN" : "SELLER",
  };
}

export async function completeTaskAction(input: unknown): Promise<CompleteTaskActionResult> {
  return withSession(async (session) => {
    const parsed = completeTaskSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: firstFollowupIssueMessage(parsed.error) };
    }

    try {
      const result = await completeTask({
        taskId: parsed.data.taskId,
        actingUser: actingUserFrom(session),
        result: parsed.data.result,
        resultNote: parsed.data.resultNote ?? null,
        nextActionDate: parsed.data.nextActionDate ?? null,
        nextActionTitle: parsed.data.nextActionTitle ?? null,
        wonValue: parsed.data.wonValue ?? null,
        lostReasonId: parsed.data.lostReasonId ?? null,
        lostNote: parsed.data.lostNote ?? null,
      });

      revalidatePath("/");
      revalidatePath("/hoje");
      revalidatePath("/negocios");
      revalidatePath(`/negocios/${result.dealId}`);
      revalidatePath("/contatos");
      revalidatePath(`/contatos/${result.contactId}`);

      return { ok: true };
    } catch (error) {
      if (error instanceof AppError) return { ok: false, error: error.message };
      console.error("[hoje] Erro ao concluir tarefa:", error);
      return { ok: false, error: GENERIC_ERROR };
    }
  });
}
