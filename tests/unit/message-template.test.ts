import { describe, expect, it } from "vitest";

import {
  firstName,
  renderMessageTemplate,
  templateVariables,
  unknownTemplateVariables,
} from "@/lib/message-template";
import { messageTemplateSchema } from "@/lib/schemas/message-template";

const vars = {
  contactName: "Carla Mendes",
  companyName: "Loja da Carla",
  sellerName: "João Silva",
};

describe("renderMessageTemplate", () => {
  it("troca as três variáveis e usa só o primeiro nome do contato", () => {
    expect(renderMessageTemplate("Oi, {nome}! Aqui é {vendedor}, da {empresa}.", vars)).toBe(
      "Oi, Carla! Aqui é João Silva, da Loja da Carla.",
    );
  });

  it("aceita a variável com caixa e espaços internos", () => {
    expect(renderMessageTemplate("Oi, { Nome }! {EMPRESA}.", vars)).toBe(
      "Oi, Carla! Loja da Carla.",
    );
  });

  it("repete a variável quantas vezes aparecer", () => {
    expect(renderMessageTemplate("{nome}, {nome}! Fala com {vendedor}.", vars)).toBe(
      "Carla, Carla! Fala com João Silva.",
    );
  });

  it("mantém o texto sem variáveis intacto", () => {
    expect(renderMessageTemplate("Mensagem simples.", vars)).toBe("Mensagem simples.");
  });

  it("usa fallbacks neutros quando o dado não existe", () => {
    expect(
      renderMessageTemplate("Oi, {nome}! Falo sobre a {empresa} com {vendedor}.", {
        contactName: "   ",
        companyName: null,
        sellerName: "",
      }),
    ).toBe("Oi, cliente! Falo sobre a sua empresa com equipe.");
  });
});

describe("variáveis do template", () => {
  it("lista as variáveis únicas em minúsculas", () => {
    expect(templateVariables("{nome} {empresa} {Nome} {vendedor}")).toEqual([
      "nome",
      "empresa",
      "vendedor",
    ]);
  });

  it("aponta somente as variáveis fora do conjunto suportado", () => {
    expect(unknownTemplateVariables("{nome} {cidade} {empresa} {telefone}")).toEqual([
      "cidade",
      "telefone",
    ]);
    expect(unknownTemplateVariables("{nome} {empresa} {vendedor}")).toEqual([]);
  });

  it("extrai o primeiro nome ignorando espaços extras", () => {
    expect(firstName("  Carla   Mendes ")).toBe("Carla");
    expect(firstName("")).toBe("");
  });
});

describe("messageTemplateSchema", () => {
  const base = {
    name: "  Retorno  ",
    body: "Oi, {nome}! Tudo bem?",
    suggestedStageId: "",
  };

  it("aceita um modelo válido e normaliza os campos", () => {
    const parsed = messageTemplateSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("Retorno");
      expect(parsed.data.body).toBe("Oi, {nome}! Tudo bem?");
      expect(parsed.data.suggestedStageId).toBeUndefined();
    }
  });

  it("recusa variável desconhecida com mensagem em pt-BR", () => {
    const parsed = messageTemplateSchema.safeParse({
      ...base,
      body: "Oi, {nome}! Sou de {cidade}.",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain("{cidade}");
    }
  });

  it("recusa nome e mensagem vazios", () => {
    expect(messageTemplateSchema.safeParse({ ...base, name: "" }).success).toBe(false);
    expect(messageTemplateSchema.safeParse({ ...base, body: "  " }).success).toBe(false);
  });
});
