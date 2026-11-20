import { describe, expect, it } from "vitest";

import {
  PIPELINE_STAGE_NAME_MAX,
  PIPELINE_STAGE_PROBABILITY_MAX,
  PIPELINE_STAGE_PROBABILITY_MIN,
} from "@/lib/pipeline";
import { pipelineStagesSchema } from "@/lib/schemas/pipeline";

const validStages = [
  { id: "novo", name: "  Novo  ", probability: "10" },
  { id: "contatado", name: "Contatado", probability: 25 },
  { id: "proposta", name: "Proposta enviada", probability: "50" },
  { id: "negociacao", name: "Negociação", probability: "75" },
];

describe("pipelineStagesSchema", () => {
  it("normaliza os campos e aceita probabilidade como texto do formulário", () => {
    const parsed = pipelineStagesSchema.safeParse({ stages: validStages });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.stages[0]).toMatchObject({ name: "Novo", probability: 10 });
      expect(parsed.data.stages[3]).toMatchObject({ name: "Negociação", probability: 75 });
    }
  });

  it("mantém a ordem recebida (a posição no array é a nova ordem)", () => {
    const parsed = pipelineStagesSchema.safeParse({
      stages: [validStages[2], validStages[0], validStages[1], validStages[3]],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.stages.map((stage) => stage.id)).toEqual([
        "proposta",
        "novo",
        "contatado",
        "negociacao",
      ]);
    }
  });

  it("recusa nomes duplicados sem diferenciar caixa", () => {
    const parsed = pipelineStagesSchema.safeParse({
      stages: [
        { id: "a", name: "Contatado", probability: 10 },
        { id: "b", name: "contatado", probability: 20 },
      ],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("Já existe uma etapa com esse nome.");
    }
  });

  it("recusa IDs duplicados", () => {
    const parsed = pipelineStagesSchema.safeParse({
      stages: [
        { id: "a", name: "Novo", probability: 10 },
        { id: "a", name: "Contatado", probability: 20 },
      ],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("Etapa duplicada no formulário.");
    }
  });

  it("recusa probabilidade fora da faixa, fracionada ou vazia", () => {
    const base = { id: "a", name: "Novo" };

    for (const probability of [String(PIPELINE_STAGE_PROBABILITY_MAX + 1), "-1", "12.5", ""]) {
      const parsed = pipelineStagesSchema.safeParse({
        stages: [{ ...base, probability }],
      });
      expect(parsed.success).toBe(false);
    }

    expect(
      pipelineStagesSchema.safeParse({
        stages: [{ ...base, probability: String(PIPELINE_STAGE_PROBABILITY_MIN) }],
      }).success,
    ).toBe(true);
  });

  it("recusa nome curto, longo ou lista vazia", () => {
    expect(
      pipelineStagesSchema.safeParse({
        stages: [{ id: "a", name: "A", probability: 10 }],
      }).success,
    ).toBe(false);
    expect(
      pipelineStagesSchema.safeParse({
        stages: [
          {
            id: "a",
            name: "x".repeat(PIPELINE_STAGE_NAME_MAX + 1),
            probability: 10,
          },
        ],
      }).success,
    ).toBe(false);
    expect(pipelineStagesSchema.safeParse({ stages: [] }).success).toBe(false);
  });
});
