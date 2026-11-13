"use server";

import { revalidatePath } from "next/cache";

import { importChunkInputSchema, importFinishedInputSchema } from "@/lib/schemas/import";
import { withSession, type AuthedSession } from "@/lib/session";
import { AppError } from "@/server/errors";
import {
  IMPORT_MAX_BYTES,
  emptyImportResult,
  importRowsChunk,
  logImportCompleted,
  parseImportCsv,
  type ImportPreview,
  type ImportResult,
} from "@/server/services/import";
import type { ActingUser } from "@/server/services/owners";

function actingUserFrom(session: AuthedSession): ActingUser {
  return {
    id: session.user.id,
    role: session.user.role === "ADMIN" ? "ADMIN" : "SELLER",
  };
}

export type PreviewActionResult =
  { ok: true; preview: ImportPreview } | { ok: false; error: string };

export type ImportChunkActionResult =
  { ok: true; result: ImportResult } | { ok: false; error: string };

export async function previewImportAction(formData: FormData): Promise<PreviewActionResult> {
  return withSession(async () => {
    const file = formData.get("file");
    if (!(file instanceof File)) return { ok: false, error: "Selecione um arquivo CSV." };
    if (file.size > IMPORT_MAX_BYTES) return { ok: false, error: "O arquivo é maior que 5 MB." };

    try {
      const buffer = await file.arrayBuffer();
      const preview = parseImportCsv(buffer);
      return { ok: true, preview };
    } catch (error) {
      if (error instanceof AppError) return { ok: false, error: error.message };
      console.error("[importacao] Erro ao pré-visualizar CSV:", error);
      return { ok: false, error: "Não foi possível ler o arquivo." };
    }
  });
}

/**
 * Importa um lote de até 100 linhas. O client chama em sequência e atualiza a
 * barra de progresso; cada chamada é uma transação curta, sem risco de timeout.
 */
export async function importContactsChunkAction(input: unknown): Promise<ImportChunkActionResult> {
  return withSession(async (session) => {
    const parsed = importChunkInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Lote de importação inválido.",
      };
    }

    try {
      const result = await importRowsChunk({
        actingUser: actingUserFrom(session),
        ...parsed.data,
      });
      return { ok: true, result };
    } catch (error) {
      if (error instanceof AppError) return { ok: false, error: error.message };
      console.error("[importacao] Erro ao importar lote:", error);
      return { ok: false, error: "Não foi possível importar este lote." };
    }
  });
}

/** Fecha a importação: registra o evento único e invalida as telas afetadas. */
export async function finishImportAction(input: unknown): Promise<{ ok: boolean; error?: string }> {
  return withSession(async (session) => {
    const parsed = importFinishedInputSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Resumo da importação inválido." };

    try {
      await logImportCompleted({
        actingUser: actingUserFrom(session),
        result: { ...emptyImportResult(), ...parsed.data, errors: [] },
      });
      revalidatePath("/contatos");
      revalidatePath("/hoje");
      revalidatePath("/negocios");
      revalidatePath("/painel");
      return { ok: true };
    } catch (error) {
      console.error("[importacao] Erro ao finalizar importação:", error);
      return {
        ok: false,
        error: "A importação terminou, mas não foi possível registrar o resumo.",
      };
    }
  });
}
