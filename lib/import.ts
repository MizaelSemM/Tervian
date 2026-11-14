import type { ContactOrigin } from "@/lib/schemas/contact";

/**
 * Contrato e utilidades puras da importação CSV (tarefa 009).
 *
 * Fica em `lib/` (e não em `server/services/import.ts`) porque o componente de
 * upload é client: importar tipos e helpers daqui não arrasta os serviços de
 * banco para o bundle do navegador.
 */

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 10000;
/** Tamanho de cada lote enviado ao servidor (evita timeout da função na Vercel). */
export const IMPORT_CHUNK_SIZE = 100;

export type ImportColumnMapping = {
  name?: number;
  phone?: number;
  email?: number;
  companyText?: number;
  origin?: number;
  tags?: number;
};

export type ImportRow = {
  rowNumber: number;
  name: string;
  phone: string;
  normalizedPhone: string | null;
  email: string | null;
  companyText: string | null;
  origin: ContactOrigin | null;
  tags: string[];
  errors: string[];
  raw: string;
};

export type ImportPreview = {
  headers: string[];
  mapping: ImportColumnMapping;
  rows: ImportRow[];
  total: number;
  valid: number;
  invalid: number;
  separator: string;
  encoding: string;
};

export type ImportError = {
  rowNumber: number;
  reason: string;
  raw: string;
};

export type ImportDuplicateAction = "skip" | "update" | "create";

export type ImportResult = {
  total: number;
  imported: number;
  /** Duplicados que tiveram os dados do contato atualizados. */
  updated: number;
  /** Negócios criados: um por lead novo e um para cada duplicado no modo "criar novo". */
  dealsCreated: number;
  duplicates: number;
  ignored: number;
  errors: ImportError[];
};

/** Linha mínima revalidada no servidor a cada lote. */
export type ImportChunkRow = {
  rowNumber: number;
  name: string;
  phone: string;
  email?: string | null;
  companyText?: string | null;
  origin?: ContactOrigin | null;
  raw?: string;
};

export function emptyImportResult(): ImportResult {
  return {
    total: 0,
    imported: 0,
    updated: 0,
    dealsCreated: 0,
    duplicates: 0,
    ignored: 0,
    errors: [],
  };
}

export function mergeImportResults(results: ImportResult[]): ImportResult {
  const merged = emptyImportResult();
  for (const result of results) {
    merged.total += result.total;
    merged.imported += result.imported;
    merged.updated += result.updated;
    merged.dealsCreated += result.dealsCreated;
    merged.duplicates += result.duplicates;
    merged.ignored += result.ignored;
    merged.errors.push(...result.errors);
  }
  return merged;
}

/**
 * Remove duplicados dentro do próprio arquivo antes de enviar os lotes.
 *
 * O telefone é a chave única por conta; se a mesma pessoa aparecer duas vezes,
 * a segunda linha vira erro de duplicidade em vez de atualizar/criar de novo.
 */
export function dedupeRows(rows: ImportRow[]): {
  rows: ImportRow[];
  errors: ImportError[];
} {
  const seen = new Set<string>();
  const kept: ImportRow[] = [];
  const errors: ImportError[] = [];

  for (const row of rows) {
    if (row.normalizedPhone) {
      if (seen.has(row.normalizedPhone)) {
        errors.push({
          rowNumber: row.rowNumber,
          reason: "Telefone duplicado dentro do próprio arquivo.",
          raw: row.raw,
        });
        continue;
      }
      seen.add(row.normalizedPhone);
    }
    kept.push(row);
  }

  return { rows: kept, errors };
}
