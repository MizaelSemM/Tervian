"use server";

import { revalidatePath } from "next/cache";

import { withAdmin } from "@/lib/session";
import { AppError } from "@/server/errors";
import { reassignDeals } from "@/server/services/dashboard";

/**
 * A����es do painel do gestor (tarefa 011).
 *
 * A p��gina j�� exige ADMIN; a action repete a checagem via `withAdmin` porque
 * Server Actions s��o um endpoint p��blico e n��o podem confiar no render.
 */

export type ReassignState =
  { ok: true; updated: number; message: string } | { ok: false; error: string } | null;

const GENERIC_ERROR = "N��o foi poss��vel reatribuir agora. Tente novamente em instantes.";

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
      return { ok: false, error: "Selecione ao menos um neg��cio." };
    }
    if (!ownerId) {
      return { ok: false, error: "Escolha o novo respons��vel." };
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
          message: `Nenhum neg��cio precisou de troca: j�� estavam com ${result.ownerName}.`,
        };
      }

      return {
        ok: true,
        updated: result.updated,
        message: `${result.updated} ${
          result.updated === 1 ? "neg��cio reatribu��do" : "neg��cios reatribu��dos"
        } para ${result.ownerName}.`,
      };
    } catch (error) {
      if (error instanceof AppError) return { ok: false, error: error.message };
      console.error("[painel] Erro ao reatribuir neg��cios:", error);
      return { ok: false, error: GENERIC_ERROR };
    }
  });
}
