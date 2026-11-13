import { describe, expect, it } from "vitest";

import { IMPORT_MAX_ROWS, dedupeRows, mergeImportResults, emptyImportResult } from "@/lib/import";
import { parseImportCsv } from "@/server/services/import";

/**
 * Fixture de 5.000 linhas (critério de aceite da 009).
 *
 * - 4.700 linhas válidas e únicas;
 * - 200 duplicadas do próprio arquivo (mesmo telefone das primeiras);
 * - 100 com telefone inválido;
 * - cabeçalho e nomes acentuados em windows-1252 (como o Excel exporta).
 */
function buildCsv(): { buffer: ArrayBuffer; expectedValid: number; expectedInvalid: number } {
  const lines = ["Nome;Telefone;E-mail;Empresa"];
  const validRows = 4700;
  const duplicateRows = 200;
  const invalidRows = 100;

  for (let i = 1; i <= validRows; i += 1) {
    const phone = `119${String(i).padStart(8, "0")}`;
    lines.push(`João Cliente ${i};${phone};joao${i}@empresa.com.br;Loja ${i}`);
  }

  for (let i = 1; i <= duplicateRows; i += 1) {
    const phone = `119${String(i).padStart(8, "0")}`;
    lines.push(`João Repetido ${i};${phone};;`);
  }

  for (let i = 1; i <= invalidRows; i += 1) {
    lines.push(`Sem Telefone ${i};1234;;`);
  }

  // `latin1` cobre os acentos usados aqui (á/ã/ç) e força o fallback do decoder.
  const bytes = Buffer.from(lines.join("\r\n"), "latin1");
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

  return {
    buffer: buffer as ArrayBuffer,
    // Duplicadas só são detectadas depois da importação (dedupeRows/banco).
    expectedValid: validRows + duplicateRows,
    expectedInvalid: invalidRows,
  };
}

describe("parseImportCsv — fixture de 5.000 linhas", () => {
  const { buffer, expectedValid, expectedInvalid } = buildCsv();

  it("lê o arquivo inteiro, detecta separador e encoding", () => {
    const preview = parseImportCsv(buffer);

    expect(preview.total).toBe(5000);
    expect(preview.separator).toBe(";");
    expect(preview.encoding).toBe("windows-1252");
    expect(preview.headers).toEqual(["Nome", "Telefone", "E-mail", "Empresa"]);
  });

  it("mapeia as colunas pelos cabeçalhos em pt-BR", () => {
    const preview = parseImportCsv(buffer);

    expect(preview.mapping).toEqual({
      name: 0,
      phone: 1,
      email: 2,
      companyText: 3,
    });
  });

  it("classifica linhas válidas e inválidas sem abortar o arquivo", () => {
    const preview = parseImportCsv(buffer);

    expect(preview.valid).toBe(expectedValid);
    expect(preview.invalid).toBe(expectedInvalid);
    expect(preview.rows).toHaveLength(5000);

    const first = preview.rows[0];
    expect(first.name).toBe("João Cliente 1");
    expect(first.normalizedPhone).toBe("+5511900000001");
    expect(first.errors).toEqual([]);

    const invalid = preview.rows[preview.rows.length - 1];
    expect(invalid.normalizedPhone).toBeNull();
    expect(invalid.errors).toContain("Telefone inválido ou ausente.");
  });

  it("recusa arquivos acima do limite de linhas", () => {
    const lines = ["Nome;Telefone"];
    for (let i = 1; i <= IMPORT_MAX_ROWS + 1; i += 1) {
      lines.push(`Cliente ${i};119${String(i).padStart(8, "0")}`);
    }
    const bytes = Buffer.from(lines.join("\n"), "utf8");
    const tooLarge = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;

    expect(() => parseImportCsv(tooLarge)).toThrowError(/limite é 10000/);
  });
});

describe("dedupeRows — duplicados dentro do arquivo", () => {
  const { buffer } = buildCsv();
  const preview = parseImportCsv(buffer);

  it("mantém a primeira ocorrência e reporta as repetições", () => {
    const { rows, errors } = dedupeRows(preview.rows);

    expect(rows).toHaveLength(4700 + 100);
    expect(errors).toHaveLength(200);
    expect(errors[0]?.reason).toBe("Telefone duplicado dentro do próprio arquivo.");
    expect(errors[0]?.rowNumber).toBe(4702);
  });
});

describe("mergeImportResults", () => {
  it("soma os lotes preservando erros parciais", () => {
    const first = emptyImportResult();
    first.total = 100;
    first.imported = 90;
    first.duplicates = 5;
    first.ignored = 5;
    first.errors.push({ rowNumber: 3, reason: "Telefone inválido ou ausente.", raw: "x" });

    const second = emptyImportResult();
    second.total = 50;
    second.imported = 40;
    second.updated = 4;
    second.dealsCreated = 2;
    second.duplicates = 4;
    second.ignored = 4;

    const merged = mergeImportResults([first, second]);

    expect(merged.total).toBe(150);
    expect(merged.imported).toBe(130);
    expect(merged.updated).toBe(4);
    expect(merged.dealsCreated).toBe(2);
    expect(merged.duplicates).toBe(9);
    expect(merged.ignored).toBe(9);
    expect(merged.errors).toHaveLength(1);
  });
});
