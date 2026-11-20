import { z } from "zod";

import {
  PIPELINE_STAGE_NAME_MAX,
  PIPELINE_STAGE_NAME_MIN,
  PIPELINE_STAGE_PROBABILITY_MAX,
  PIPELINE_STAGE_PROBABILITY_MIN,
} from "@/lib/pipeline";

/**
 * Edição das etapas do funil (RF-24).
 *
 * O formulário envia as etapas na ordem exibida (a posição no array É a nova
 * ordem). O servidor revalida nomes, probabilidades e duplicidades; o serviço
 * confere depois se o conjunto de IDs ainda é o funil atual da conta.
 */
export const pipelineStagesSchema = z
  .object({
    stages: z
      .array(
        z.object({
          id: z
            .string({ message: "Etapa inválida." })
            .trim()
            .min(1, { message: "Etapa inválida." }),
          name: z
            .string({ message: "Informe o nome da etapa." })
            .trim()
            .min(PIPELINE_STAGE_NAME_MIN, {
              message: `O nome da etapa precisa ter pelo menos ${PIPELINE_STAGE_NAME_MIN} caracteres.`,
            })
            .max(PIPELINE_STAGE_NAME_MAX, {
              message: `O nome da etapa pode ter no máximo ${PIPELINE_STAGE_NAME_MAX} caracteres.`,
            }),
          probability: z.preprocess(
            (value) => {
              if (typeof value !== "string") return value;
              const trimmed = value.trim();
              return trimmed === "" ? undefined : Number(trimmed);
            },
            z
              .number({ message: "Informe a probabilidade da etapa." })
              .int({ message: "A probabilidade deve ser um número inteiro." })
              .min(PIPELINE_STAGE_PROBABILITY_MIN, {
                message: `A probabilidade mínima é ${PIPELINE_STAGE_PROBABILITY_MIN}%.`,
              })
              .max(PIPELINE_STAGE_PROBABILITY_MAX, {
                message: `A probabilidade máxima é ${PIPELINE_STAGE_PROBABILITY_MAX}%.`,
              }),
          ),
        }),
      )
      .min(1, { message: "Mantenha pelo menos uma etapa no funil." })
      .max(20, { message: "O funil pode ter no máximo 20 etapas." }),
  })
  .superRefine(({ stages }, ctx) => {
    const ids = new Set<string>();
    const names = new Set<string>();

    stages.forEach((stage, index) => {
      if (ids.has(stage.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["stages", index, "id"],
          message: "Etapa duplicada no formulário.",
        });
      }
      ids.add(stage.id);

      const nameKey = stage.name.toLocaleLowerCase("pt-BR");
      if (names.has(nameKey)) {
        ctx.addIssue({
          code: "custom",
          path: ["stages", index, "name"],
          message: "Já existe uma etapa com esse nome.",
        });
      }
      names.add(nameKey);
    });
  });

export type PipelineStagesInput = z.infer<typeof pipelineStagesSchema>;

/** Primeira mensagem de erro de um ZodError (mensagens já em pt-BR). */
export function firstPipelineIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}
