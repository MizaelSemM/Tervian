/**
 * Geração de CSV para exportação (RF-54).
 *
 * Escolhas deliberadas para o público brasileiro:
 * - separador `;` e BOM UTF-8, para o Excel em pt-BR abrir as colunas certas;
 * - quebra de linha CRLF, compatível com Excel/Sheets;
 * - células com `;`, aspas ou quebra de linha são escapadas entre aspas.
 *
 * A regra de fórmula é uma proteção contra CSV injection: um nome de contato
 * começando com `=`, `+`, `-` ou `@` não pode virar fórmula ao abrir a planilha.
 * Telefones em E.164 (`+55...`) são preservados porque o sinal é seguido de
 * dígito.
 */

export type CsvCell = string | number | null | undefined;

function neutralizeFormula(value: string): string {
  if (/^[=@]/.test(value)) return `'${value}`;
  if (/^[+-]/.test(value) && !/^[+-]?\d/.test(value)) return `'${value}`;
  return value;
}

export function escapeCsvCell(value: CsvCell): string {
  const raw = value == null ? "" : String(value).replace(/\r\n?/g, "\n");
  const text = neutralizeFormula(raw);

  if (/[;"\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Monta o CSV completo, com BOM e CRLF, a partir de linhas já tipadas. */
export function toCsv(rows: CsvCell[][]): string {
  const body = rows.map((row) => row.map(escapeCsvCell).join(";")).join("\r\n");
  return `\uFEFF${body}\r\n`;
}
