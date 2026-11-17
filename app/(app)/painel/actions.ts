"use server";

import { revalidatePath } from "next/cache";

import { withAdmin } from "@/lib/session";
import { AppError } from "@/server/errors";
import { reassignDeals } from "@/server/services/dashboard";

/**
 * Ações do painel do gestor (tarefa 011).
 *
 * A página já exige ADMIN; a action repete a checagem via `withAdmin` porque
 * Server Actions são um endpoint público e não podem confiar no render.
 */

export type ReassignState =
  { ok: true; updated: number; message: string } | { ok: false; error: string } | null;

const GENERIC_ERROR = "Não foi possível reatribuir agora. Tente novamente em instantes.";

export async function reassignDealsAction(
  _previous: ReassignState,
  formData: FormData,
): Promise<ReassignState> {
  return withAdmin(async (session) => {
    const dealIds = formData
      .getAll("dealIds")
      .map((value) => String(value).trim())
      .filter(Boolean);
    const ownerId = String(formData.get("ownerId") ?? "").trim();

    if (dealIds.length === 0) {
      return { ok: false, error: "Selecione ao menos um negócio." };
    }
    if (!ownerId) {
      return { ok: false, error: "Escolha o novo responsável." };
    }

    try {
      const result = await reassignDeals({
        actingUser: { id: session.user.id, role: "ADMIN" },
        dealIds,
        ownerId,
      });

      revalidatePath("/painel");
      revalidatePath("/painel/carteira");
      revalidatePath("/hoje");
      revalidatePath("/negocios");
      revalidatePath("/negocios/[id]", "page");

      if (result.updated === 0) {
        return {
          ok: true,
          updated: 0,
          message: `Nenhum negócio precisou de troca: já estavam com ${result.ownerName}.`,
        };
      }

      return {
        ok: true,
        updated: result.updated,
        message: `${result.updated} ${
          result.updated === 1 ? "negócio reatribuído" : "negócios reatribuídos"
        } para ${result.ownerName}.`,
      };
    } catch (error) {
      if (error instanceof AppError) return { ok: false, error: error.message };
      console.error("[painel] Erro ao reatribuir negócios:", error);
      return { ok: false, error: GENERIC_ERROR };
    }
  });
}
