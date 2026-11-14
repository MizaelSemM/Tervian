import { describe, expect, it } from "vitest";

import { sanitizeAnalyticsProps, scrubErrorText } from "@/lib/privacy";
import { firstIssueMessage, signUpCompanySchema } from "@/lib/schemas/auth";

/**
 * Higiene de dados para LGPD (tarefa 013): nada de PII em log/analytics e
 * aceite dos termos obrigatório no cadastro.
 */

describe("sanitizeAnalyticsProps (013)", () => {
  it("remove chaves que carregam dado pessoal", () => {
    const clean = sanitizeAnalyticsProps({
      name: "Ana Souza",
      phone: "11 99999-0000",
      email: "ana@loja.com",
      note: "cliente pediu desconto",
      source: "form",
      has_email: true,
    });

    expect(clean).toEqual({ source: "form", has_email: true });
  });

  it("remove PII mesmo com caixa alta e variações em português", () => {
    const clean = sanitizeAnalyticsProps({
      Nome: "Ana",
      TELEFONE: "11999990000",
      Email: "ana@loja.com",
      Senha: "segredo",
      stage: "Novo",
    });

    expect(clean).toEqual({ stage: "Novo" });
  });

  it("preserva números e booleanos usados nas métricas", () => {
    const clean = sanitizeAnalyticsProps({
      seconds: 12,
      duplicate: false,
      account_id: "conta-1",
      role: "SELLER",
      vazio: null,
    });

    expect(clean).toEqual({
      seconds: 12,
      duplicate: false,
      account_id: "conta-1",
      role: "SELLER",
      vazio: null,
    });
  });
});

describe("scrubErrorText (013)", () => {
  it("mascara e-mail e telefone", () => {
    const scrubbed = scrubErrorText(
      "Falha ao enviar para ana.souza+teste@loja.com.br pelo telefone +55 (11) 99999-0000",
    );

    expect(scrubbed).not.toContain("ana.souza");
    expect(scrubbed).not.toContain("99999");
    expect(scrubbed).toContain("[email]");
    expect(scrubbed).toContain("[telefone]");
  });

  it("mantém mensagens sem PII e limita o tamanho", () => {
    expect(scrubErrorText("Banco indisponível")).toBe("Banco indisponível");
    expect(scrubErrorText("x".repeat(900))).toHaveLength(500);
  });
});

describe("aceite dos termos no cadastro (013)", () => {
  const base = {
    companyName: "Loja do Bairro",
    name: "Ana Souza",
    email: "ana@loja.com",
    password: "senha-segura-1",
  };

  it("exige aceite explícito dos termos", () => {
    const missing = signUpCompanySchema.safeParse(base);
    expect(missing.success).toBe(false);
    if (!missing.success) expect(firstIssueMessage(missing.error)).toMatch(/termos/i);

    const refused = signUpCompanySchema.safeParse({ ...base, acceptTerms: false });
    expect(refused.success).toBe(false);
  });

  it("aceita cadastro com aceite", () => {
    const parsed = signUpCompanySchema.safeParse({ ...base, acceptTerms: true });
    expect(parsed.success).toBe(true);
  });
});
