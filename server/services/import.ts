import { normalizePhoneBR } from "@/lib/phone";

import { AppError } from "@/server/errors";
import { createLead, type CreateLeadResult } from "@/server/services/leads";
import { logEvent } from "@/server/services/timeline";
import type { ActingUser } from "@/server/services/owners";
import type { ContactOrigin } from "@/lib/schemas/contact";

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 10000;

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

export type ImportResult = {
  total: number;
  imported: number;
  duplicates: number;
  ignored: number;
  errors: ImportError[];
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

export async function importContactsCsv(input: {
  actingUser: ActingUser;
  buffer: ArrayBuffer;
  mapping?: ImportColumnMapping;
  duplicateAction?: "skip" | "create";
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
  const seenPhones = new Set<string>();
  const errors: ImportError[] = [];
  let imported = 0;
  let duplicates = 0;
  let ignored = 0;

  for (const row of preview.rows) {
    if (row.errors.length > 0 || !row.normalizedPhone) {
      ignored += 1;
      errors.push({
        rowNumber: row.rowNumber,
        reason: row.errors.join(" ") || "Linha inválida.",
        raw: row.raw,
      });
      continue;
    }

    if (seenPhones.has(row.normalizedPhone)) {
      duplicates += 1;
      errors.push({
        rowNumber: row.rowNumber,
        reason: "Telefone duplicado dentro do próprio arquivo.",
        raw: row.raw,
      });
      continue;
    }
    seenPhones.add(row.normalizedPhone);

    try {
      const result: CreateLeadResult = await createLead({
        actingUser: input.actingUser,
        name: row.name,
        phone: row.phone,
        email: row.email,
        companyText: row.companyText,
        origin: row.origin ?? "IMPORT",
        source: "csv",
      });

      if (result.status === "duplicate") {
        duplicates += 1;
        errors.push({
          rowNumber: row.rowNumber,
          reason: `Contato duplicado na base: ${result.contact.name}.`,
          raw: row.raw,
        });
      } else {
        imported += 1;
      }
    } catch (error) {
      ignored += 1;
      errors.push({
        rowNumber: row.rowNumber,
        reason: error instanceof AppError ? error.message : "Erro inesperado ao importar.",
        raw: row.raw,
      });
    }
  }

  if (imported > 0) {
    await logEvent({
      type: "import.completed",
      payload: {
        imported,
        duplicates,
        ignored,
        errors: errors.length,
      },
      actorId: input.actingUser.id,
    });
  }

  return {
    total: preview.total,
    imported,
    duplicates,
    ignored,
    errors,
  };
}
