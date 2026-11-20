import { z } from "zod";

import {
  MESSAGE_TEMPLATE_BODY_MAX,
  MESSAGE_TEMPLATE_NAME_MAX,
  unknownTemplateVariables,
} from "@/lib/message-template";

/**
 * Validação de modelo de mensagem (RF-36). O servidor SEMPRE revalida; o mesmo
 * schema alimenta as mensagens em pt-BR exibidas no formulário.
 *
 * Variáveis são a única "linguagem" do template: qualquer `{...}` fora de
 * `{nome}`, `{empresa}` e `{vendedor}` é recusado para não sair na mensagem
 * final como texto literal.
 */
export const messageTemplateSchema = z
  .object({
    name: z
      .string({ message: "Informe o nome do modelo." })
      .trim()
      .min(2, { message: "O nome precisa ter pelo menos 2 caracteres." })
      .max(MESSAGE_TEMPLATE_NAME_MAX, {
        message: `O nome pode ter no máximo ${MESSAGE_TEMPLATE_NAME_MAX} caracteres.`,
      }),
    body: z
      .string({ message: "Escreva a mensagem do modelo." })
      .trim()
      .min(2, { message: "A mensagem precisa ter pelo menos 2 caracteres." })
      .max(MESSAGE_TEMPLATE_BODY_MAX, {
        message: `A mensagem pode ter no máximo ${MESSAGE_TEMPLATE_BODY_MAX} caracteres.`,
      }),
    suggestedStageId: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value : undefined)),
  })
  .superRefine((value, ctx) => {
    const [unknown] = unknownTemplateVariables(value.body);
    if (unknown) {
      ctx.addIssue({
        code: "custom",
        path: ["body"],
        message: `Variável desconhecida: {${unknown}}. Use apenas {nome}, {empresa} e {vendedor}.`,
      });
    }
  });

export type MessageTemplateInput = z.infer<typeof messageTemplateSchema>;
