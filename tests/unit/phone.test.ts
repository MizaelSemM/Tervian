import { describe, expect, it } from "vitest";

import { formatPhoneBR, maskPhoneInput, normalizePhoneBR, whatsappLinkBR } from "@/lib/phone";

describe("normalizePhoneBR", () => {
  it("normaliza celular com DDD sem máscara", () => {
    expect(normalizePhoneBR("11987654321")).toBe("+5511987654321");
  });

  it("normaliza celular com máscara", () => {
    expect(normalizePhoneBR("(11) 98765-4321")).toBe("+5511987654321");
  });

  it("normaliza celular com DDI e o sinal de +", () => {
    expect(normalizePhoneBR("+55 11 98765-4321")).toBe("+5511987654321");
    expect(normalizePhoneBR("5511987654321")).toBe("+5511987654321");
  });

  it("remove zero de operadora/DDD", () => {
    expect(normalizePhoneBR("011987654321")).toBe("+5511987654321");
  });

  it("normaliza telefone fixo (10 dígitos)", () => {
    expect(normalizePhoneBR("11 3456-7890")).toBe("+551134567890");
    expect(normalizePhoneBR("551134567890")).toBe("+551134567890");
  });

  it("NÃO confunde DDD 55 com DDI 55", () => {
    // 11 dígitos começando com 55 = DDD 55 (Santa Maria/RS), não DDI.
    expect(normalizePhoneBR("55987654321")).toBe("+5555987654321");
  });

  it("rejeita entradas inválidas", () => {
    expect(normalizePhoneBR("")).toBeNull();
    expect(normalizePhoneBR("1234")).toBeNull();
    expect(normalizePhoneBR("(00) 98765-4321")).toBeNull();
    expect(normalizePhoneBR("0198765432")).toBeNull(); // sobra 9 dígitos após remover os zeros — inválido
  });

  it("rejeita celular sem o nono dígito 9 (11 dígitos fora do padrão)", () => {
    expect(normalizePhoneBR("11876543210")).toBeNull();
  });
});

describe("formatPhoneBR", () => {
  it("formata celular", () => {
    expect(formatPhoneBR("+5511987654321")).toBe("(11) 98765-4321");
  });

  it("formata fixo", () => {
    expect(formatPhoneBR("+551134567890")).toBe("(11) 3456-7890");
  });

  it("devolve a entrada original quando inválida", () => {
    expect(formatPhoneBR("abc")).toBe("abc");
  });
});

describe("whatsappLinkBR", () => {
  it("gera link wa.me sem o +", () => {
    expect(whatsappLinkBR("(11) 98765-4321")).toBe("https://wa.me/5511987654321");
  });

  it("inclui a mensagem pronta encoded no link", () => {
    expect(whatsappLinkBR("(11) 98765-4321", "Oi, Carla! Tudo bem?")).toBe(
      "https://wa.me/5511987654321?text=Oi%2C%20Carla!%20Tudo%20bem%3F",
    );
  });

  it("ignora texto vazio ou só espaços", () => {
    expect(whatsappLinkBR("(11) 98765-4321", "   ")).toBe("https://wa.me/5511987654321");
  });

  it("retorna null para telefone inválido", () => {
    expect(whatsappLinkBR("abc")).toBeNull();
  });
});

describe("maskPhoneInput", () => {
  it("formata progressivamente enquanto digita", () => {
    expect(maskPhoneInput("")).toBe("");
    expect(maskPhoneInput("1")).toBe("(1");
    expect(maskPhoneInput("11")).toBe("(11");
    expect(maskPhoneInput("119")).toBe("(11) 9");
    expect(maskPhoneInput("119876")).toBe("(11) 9876");
    expect(maskPhoneInput("1198765")).toBe("(11) 9876-5");
    expect(maskPhoneInput("1198765432")).toBe("(11) 9876-5432");
    expect(maskPhoneInput("11987654321")).toBe("(11) 98765-4321");
  });

  it("aceita colar com DDI e remove zero de operadora", () => {
    expect(maskPhoneInput("+55 11 98765-4321")).toBe("(11) 98765-4321");
    expect(maskPhoneInput("011987654321")).toBe("(11) 98765-4321");
  });

  it("não aceita mais de 11 dígitos", () => {
    expect(maskPhoneInput("119876543219999")).toBe("(11) 98765-4321");
  });
});
