import { describe, expect, it } from "vitest";

import {
  PUBLIC_FORM_SLUG_MAX,
  PUBLIC_FORM_SLUG_PATTERN,
  generatePublicFormSlug,
  publicFormEmbedSnippet,
  publicFormUrl,
  slugify,
} from "@/lib/public-form";
import { publicFormSettingsSchema } from "@/lib/schemas/public-form";

describe("slug do formulário público", () => {
  it("normaliza nome da empresa (acentos, caixa e espaços)", () => {
    expect(slugify("  Loja da Carla & Cia. ")).toBe("loja-da-carla-cia");
    expect(slugify("Ação & Reação")).toBe("acao-reacao");
  });

  it("gera slug único com sufixo e dentro do limite", () => {
    const first = generatePublicFormSlug("Empresa Muito Longa ".repeat(5));
    const second = generatePublicFormSlug("Empresa Muito Longa ".repeat(5));

    expect(first).toMatch(PUBLIC_FORM_SLUG_PATTERN);
    expect(first.length).toBeLessThanOrEqual(PUBLIC_FORM_SLUG_MAX);
    expect(second).not.toBe(first);
  });

  it("monta URL e snippet de embed", () => {
    expect(publicFormUrl("loja", "https://app.tervian.dev/")).toBe(
      "https://app.tervian.dev/f/loja",
    );
    expect(publicFormEmbedSnippet("https://app.tervian.dev/f/loja")).toContain(
      'src="https://app.tervian.dev/f/loja"',
    );
  });
});

describe("publicFormSettingsSchema", () => {
  const base = {
    enabled: true,
    slug: "loja-da-carla",
    title: "Fale com a Carla",
    message: "Recebemos seu contato!",
    whatsapp: "",
    ownerId: "",
  };

  it("aceita a configuração mínima", () => {
    const parsed = publicFormSettingsSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.whatsapp).toBeUndefined();
      expect(parsed.data.ownerId).toBeUndefined();
    }
  });

  it("normaliza o slug para minúsculo", () => {
    const parsed = publicFormSettingsSchema.safeParse({ ...base, slug: "Loja-Da-Carla" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.slug).toBe("loja-da-carla");
  });

  it.each([
    ["com espaço", "loja da carla"],
    ["com acento", "loja-da-carlá"],
    ["com underscore", "loja_da_carla"],
    ["curto demais", "ab"],
  ])("recusa slug %s", (_label, slug) => {
    expect(publicFormSettingsSchema.safeParse({ ...base, slug }).success).toBe(false);
  });

  it("recusa WhatsApp inválido e aceita válido", () => {
    expect(publicFormSettingsSchema.safeParse({ ...base, whatsapp: "1234" }).success).toBe(false);
    expect(
      publicFormSettingsSchema.safeParse({ ...base, whatsapp: "(11) 98765-4321" }).success,
    ).toBe(true);
  });
});
