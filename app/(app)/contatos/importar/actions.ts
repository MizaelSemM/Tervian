"use server";

import { withSession, type AuthedSession } from "@/lib/session";
import { AppError } from "@/server/errors";
import {
  IMPORT_MAX_BYTES,
  importContactsCsv,
  parseImportCsv,
  type ImportColumnMapping,
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

export type ImportActionResult = { ok: true; result: ImportResult } | { ok: false; error: string };

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

export async function runImportAction(formData: FormData): Promise<ImportActionResult> {
  return withSession(async (session) => {
    const file = formData.get("file");
    if (!(file instanceof File)) return { ok: false, error: "Selecione um arquivo CSV." };
    if (file.size > IMPORT_MAX_BYTES) return { ok: false, error: "O arquivo é maior que 5 MB." };

    const baseLegal = formData.get("baseLegal") === "on";
    if (!baseLegal) return { ok: false, error: "Confirme a base legal para importar os dados." };

    let mapping: ImportColumnMapping | undefined;
    const mappingRaw = formData.get("mapping");
    if (typeof mappingRaw === "string" && mappingRaw.trim()) {
      try {
        mapping = JSON.parse(mappingRaw) as ImportColumnMapping;
      } catch {
        return { ok: false, error: "Mapeamento de colunas inválido." };
      }
    }

    try {
      const buffer = await file.arrayBuffer();
      const result = await importContactsCsv({
        actingUser: actingUserFrom(session),
        buffer,
        mapping,
        baseLegal,
      });
      return { ok: true, result };
    } catch (error) {
      if (error instanceof AppError) return { ok: false, error: error.message };
      console.error("[importacao] Erro ao importar CSV:", error);
      return { ok: false, error: "Não foi possível importar o arquivo." };
    }
  });
}
