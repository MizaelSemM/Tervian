import { describe, expect, it } from "vitest";

import { escapeCsvCell, toCsv } from "@/lib/csv";

describe("lib/csv (RF-54)", () => {
  it("usa ponto e vírgula, CRLF e BOM UTF-8 para o Excel em pt-BR", () => {
    const csv = toCsv([
      ["Nome", "Telefone"],
      ["Ana", "+5511987654321"],
    ]);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("Nome;Telefone\r\n");
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("escapa aspas, ponto e vírgula e quebra de linha", () => {
    expect(escapeCsvCell("Silva; Souza")).toBe('"Silva; Souza"');
    expect(escapeCsvCell('Elisa "Bia"')).toBe('"Elisa ""Bia"""');
    expect(escapeCsvCell("linha 1\nlinha 2")).toBe('"linha 1\nlinha 2"');
  });

  it("preserva telefone E.164, mas neutraliza fórmula em texto livre", () => {
    expect(escapeCsvCell("+5511987654321")).toBe("+5511987654321");
    expect(escapeCsvCell('=HYPERLINK("http://malicioso")')).toBe(
      '"\'=HYPERLINK(""http://malicioso"")"',
    );
    expect(escapeCsvCell("@inicio")).toBe("'@inicio");
    expect(escapeCsvCell("-nome")).toBe("'-nome");
  });

  it("trata nulo e número", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
    expect(escapeCsvCell(123.45)).toBe("123.45");
  });
});
