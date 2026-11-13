import {
  IMPORT_CHUNK_SIZE,
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
  emptyImportResult,
  mergeImportResults,
  type ImportChunkRow,
  type ImportColumnMapping,
  type ImportDuplicateAction,
  type ImportError,
  type ImportPreview,
  type ImportResult,
  type ImportRow,
} from "@/lib/import";
import { normalizePhoneBR } from "@/lib/phone";
import { CONTACT_ORIGINS, createLeadSchema, type ContactOrigin } from "@/lib/schemas/contact";

import { AppError } from "@/server/errors";
import { updateContact } from "@/server/services/contacts";
import { createDeal } from "@/server/services/deals";
import { createLead } from "@/server/services/leads";
import { logEvent } from "@/server/services/timeline";
import type { ActingUser } from "@/server/services/owners";

// Reexporta o contrato puro para quem já importava daqui.
export {
  IMPORT_CHUNK_SIZE,
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
  emptyImportResult,
  mergeImportResults,
};
export type {
  ImportChunkRow,
  ImportColumnMapping,
  ImportDuplicateAction,
  ImportError,
  ImportPreview,
  ImportResult,
  ImportRow,
};

const ORIGINS = new Set<string>([
  "INSTAGRAM",
  "REFERRAL",
  "SITE",
  "STORE",
  "FORM",
  "IMPORT",
  "OTHER",
]);

const HEADER_ALIASES: Record<keyof ImportColumnMapping, string[]> = {
  name: ["nome", "name", "cliente", "contato", "lead"],
  phone: ["telefone", "phone", "tel", "celular", "whatsapp", "fone"],
  email: ["email", "e-mail", "mail"],
  companyText: ["empresa", "company", "empresa_texto", "organizacao", "organização"],
  origin: ["origem", "origin", "fonte", "source"],
  tags: ["tags", "etiquetas", "marcadores"],
};

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function detectEncoding(buffer: ArrayBuffer): { text: string; encoding: string } {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    const text = new TextDecoder("utf-8").decode(buffer.slice(3));
    return { text, encoding: "utf-8-bom" };
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return { text, encoding: "utf-8" };
  } catch {
    return { text: new TextDecoder("windows-1252").decode(buffer), encoding: "windows-1252" };
  }
}

function detectSeparator(firstLine: string): string {
  const candidates = [";", ",", "\t"];
  let best = ",";
  let bestCount = 0;
  for (const candidate of candidates) {
    const count = firstLine.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

function parseDelimited(text: string, separator: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === separator && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  }

  return rows;
}

function suggestMapping(headers: string[]): ImportColumnMapping {
  const normalized = headers.map(normalizeHeader);
  const mapping: ImportColumnMapping = {};

  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [
    keyof ImportColumnMapping,
    string[],
  ][]) {
    const index = normalized.findIndex((header) => aliases.includes(header));
    if (index >= 0) mapping[field] = index;
  }

  return mapping;
}

function splitTags(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[;,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function validateOrigin(value: string | undefined): ContactOrigin | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (ORIGINS.has(normalized)) return normalized as ContactOrigin;
  return null;
}

function buildRow(
  rowNumber: number,
  cells: string[],
  headers: string[],
  mapping: ImportColumnMapping,
): ImportRow {
  const get = (field: keyof ImportColumnMapping) => {
    const index = mapping[field];
    return index === undefined ? undefined : cells[index];
  };

  const name = get("name")?.trim() ?? "";
  const phoneRaw = get("phone")?.trim() ?? "";
  const normalizedPhone = normalizePhoneBR(phoneRaw);
  const email = get("email")?.trim().toLowerCase() || null;
  const companyText = get("companyText")?.trim() || null;
  const originRaw = get("origin")?.trim();
  const origin = validateOrigin(originRaw);
  const tags = splitTags(get("tags"));

  const errors: string[] = [];
  if (name.length < 2) errors.push("Nome inválido ou ausente.");
  if (!normalizedPhone) errors.push("Telefone inválido ou ausente.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("E-mail inválido.");
  if (originRaw && !origin) errors.push("Origem inválida.");

  return {
    rowNumber,
    name,
    phone: phoneRaw,
    normalizedPhone,
    email,
    companyText,
    origin,
    tags,
    errors,
    raw: cells.join(";"),
  };
}

export function parseImportCsv(
  buffer: ArrayBuffer,
  mappingOverride?: ImportColumnMapping,
): ImportPreview {
  const { text, encoding } = detectEncoding(buffer);
  const lines = text.split(/\r?\n/);
  const firstNonEmpty = lines.find((line) => line.trim() !== "") ?? "";
  const separator = detectSeparator(firstNonEmpty);
  const rows = parseDelimited(text, separator);

  if (rows.length === 0) {
    throw new AppError("IMPORT_EMPTY", "O arquivo CSV está vazio.");
  }

  const headers = rows[0].map((header) => header.trim());
  const mapping = mappingOverride ?? suggestMapping(headers);
  const dataRows = rows.slice(1);

  if (dataRows.length > IMPORT_MAX_ROWS) {
    throw new AppError(
      "IMPORT_TOO_LARGE",
      `O arquivo tem ${dataRows.length} linhas; o limite é ${IMPORT_MAX_ROWS}.`,
    );
  }

  const parsedRows = dataRows
    .filter((cells) => cells.some((cell) => cell.trim() !== ""))
    .map((cells, index) => buildRow(index + 2, cells, headers, mapping));

  return {
    headers,
    mapping,
    rows: parsedRows,
    total: parsedRows.length,
    valid: parsedRows.filter((row) => row.errors.length === 0).length,
    invalid: parsedRows.filter((row) => row.errors.length > 0).length,
    separator,
    encoding,
  };
}

function rowError(row: ImportChunkRow, reason: string): ImportError {
  return {
    rowNumber: row.rowNumber,
    reason,
    raw: row.raw ?? [row.name, row.phone, row.email ?? "", row.companyText ?? ""].join(";"),
  };
}

function parseChunkRow(row: ImportChunkRow) {
  return createLeadSchema.safeParse({
    name: row.name,
    phone: row.phone,
    email: row.email ?? undefined,
    companyText: row.companyText ?? undefined,
    origin: row.origin ?? undefined,
  });
}

/**
 * Importa um lote pequeno (até 100 linhas) e devolve o relatório parcial.
 *
 * O client envia vários lotes em sequência e mostra o progresso; assim nenhuma
 * execução chega perto do timeout da Vercel, mesmo com 5.000+ linhas. O servidor
 * revalida cada linha (não confia no preview do client) e usa os mesmos serviços
 * da captura manual.
 */
export async function importRowsChunk(input: {
  actingUser: ActingUser;
  rows: ImportChunkRow[];
  duplicateAction?: ImportDuplicateAction;
  onlyContacts?: boolean;
  baseLegal: boolean;
}): Promise<ImportResult> {
  if (!input.baseLegal) {
    throw new AppError(
      "IMPORT_BASE_LEGAL_REQUIRED",
      "Confirme a base legal para importar os dados.",
    );
  }
  if (input.rows.length === 0) {
    throw new AppError("IMPORT_EMPTY", "Nenhuma linha para importar.");
  }
  if (input.rows.length > IMPORT_CHUNK_SIZE) {
    throw new AppError("IMPORT_CHUNK_TOO_LARGE", "Envie no máximo 100 linhas por lote.");
  }

  const result = emptyImportResult();
  const duplicateAction = input.duplicateAction ?? "skip";
  const onlyContacts = input.onlyContacts ?? false;

  for (const row of input.rows) {
    result.total += 1;
    const parsed = parseChunkRow(row);
    if (!parsed.success) {
      result.ignored += 1;
      result.errors.push(rowError(row, parsed.error.issues[0]?.message ?? "Linha inválida."));
      continue;
    }

    try {
      const created = await createLead({
        actingUser: input.actingUser,
        ...parsed.data,
        origin: parsed.data.origin ?? "IMPORT",
        source: "csv",
        createDeal: !onlyContacts,
      });

      if (created.status !== "duplicate") {
        result.imported += 1;
        continue;
      }

      result.duplicates += 1;

      if (duplicateAction === "skip") {
        result.errors.push(rowError(row, `Contato duplicado na base: ${created.contact.name}.`));
        continue;
      }

      if (duplicateAction === "update") {
        try {
          await updateContact({
            id: created.contact.id,
            actingUser: input.actingUser,
            name: parsed.data.name,
            phone: parsed.data.phone,
            email: parsed.data.email,
            companyText: parsed.data.companyText,
            origin: parsed.data.origin,
          });
          result.updated += 1;
        } catch (error) {
          result.ignored += 1;
          result.errors.push(
            rowError(
              row,
              error instanceof AppError ? error.message : "Erro ao atualizar o contato existente.",
            ),
          );
        }
        continue;
      }

      // "create": mantém o contato único (telefone é a chave) e cria um novo
      // negócio para ele — útil quando a mesma pessoa traz outra oportunidade.
      if (onlyContacts) {
        result.errors.push(
          rowError(row, "Contato já existe; o modo “só contatos” não cria novo negócio."),
        );
        continue;
      }

      try {
        await createDeal({
          actingUser: input.actingUser,
          contactId: created.contact.id,
          title: parsed.data.name,
          nextActionAt: new Date(),
        });
        result.dealsCreated += 1;
      } catch (error) {
        result.ignored += 1;
        result.errors.push(
          rowError(
            row,
            error instanceof AppError ? error.message : "Erro ao criar negócio para o contato.",
          ),
        );
      }
    } catch (error) {
      result.ignored += 1;
      result.errors.push(
        rowError(row, error instanceof AppError ? error.message : "Erro inesperado ao importar."),
      );
    }
  }

  return result;
}

/** Caminho legado (importação em uma chamada) — mantido para scripts/testes. */
export async function importContactsCsv(input: {
  actingUser: ActingUser;
  buffer: ArrayBuffer;
  mapping?: ImportColumnMapping;
  duplicateAction?: ImportDuplicateAction;
  onlyContacts?: boolean;
  baseLegal: boolean;
}): Promise<ImportResult> {
  if (!input.baseLegal) {
    throw new AppError(
      "IMPORT_BASE_LEGAL_REQUIRED",
      "Confirme a base legal para importar os dados.",
    );
  }
  if (input.buffer.byteLength > IMPORT_MAX_BYTES) {
    throw new AppError("IMPORT_FILE_TOO_LARGE", "O arquivo é maior que 5 MB.");
  }

  const preview = parseImportCsv(input.buffer, input.mapping);
  const chunks: ImportResult[] = [];
  for (let index = 0; index < preview.rows.length; index += IMPORT_CHUNK_SIZE) {
    chunks.push(
      await importRowsChunk({
        actingUser: input.actingUser,
        rows: preview.rows.slice(index, index + IMPORT_CHUNK_SIZE),
        duplicateAction: input.duplicateAction,
        onlyContacts: input.onlyContacts,
        baseLegal: true,
      }),
    );
  }

  const merged = mergeImportResults(chunks);
  if (merged.imported + merged.updated + merged.dealsCreated > 0) {
    await logEvent({
      type: "import.completed",
      payload: {
        imported: merged.imported,
        updated: merged.updated,
        dealsCreated: merged.dealsCreated,
        duplicates: merged.duplicates,
        ignored: merged.ignored,
        errors: merged.errors.length,
      },
      actorId: input.actingUser.id,
    });
  }
  return merged;
}

/** Registra o evento único de conclusão quando o client termina todos os lotes. */
export async function logImportCompleted(input: {
  actingUser: ActingUser;
  result: ImportResult;
}): Promise<void> {
  if (input.result.imported + input.result.updated + input.result.dealsCreated <= 0) {
    return;
  }
  await logEvent({
    type: "import.completed",
    payload: {
      imported: input.result.imported,
      updated: input.result.updated,
      dealsCreated: input.result.dealsCreated,
      duplicates: input.result.duplicates,
      ignored: input.result.ignored,
      errors: input.result.errors.length,
    },
    actorId: input.actingUser.id,
  });
}

// Mantém a lista de origens exportada para o schema de importação do client.
export const IMPORT_ORIGINS = CONTACT_ORIGINS;
