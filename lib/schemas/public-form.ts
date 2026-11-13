import { z } from "zod";

import { normalizePhoneBR } from "@/lib/phone";
import {
  PUBLIC_FORM_MESSAGE_MAX,
  PUBLIC_FORM_SLUG_MAX,
  PUBLIC_FORM_SLUG_MIN,
  PUBLIC_FORM_SLUG_PATTERN,
  PUBLIC_FORM_TITLE_MAX,
} from "@/lib/public-form";

/**
 * Validação da configuração do formulário público (tarefa 010).
 *
 * O servidor SEMPRE revalida; o schema também é usado no client para mensagens
 * em pt-BR. O telefone do WhatsApp é opcional, mas se preenchido precisa ser
 * um número brasileiro válido.
 */

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

export const publicFormSettingsSchema = z.object({
  enabled: z.boolean(),
  slug: z
    .string({ message: "Informe o link do formulário." })
    .trim()
    .toLowerCase()
    .min(PUBLIC_FORM_SLUG_MIN, {
      message: `O link precisa ter pelo menos ${PUBLIC_FORM_SLUG_MIN} caracteres.`,
    })
    .max(PUBLIC_FORM_SLUG_MAX, {
      message: `O link pode ter no máximo ${PUBLIC_FORM_SLUG_MAX} caracteres.`,
    })
    .regex(PUBLIC_FORM_SLUG_PATTERN, {
      message: "Use apenas letras sem acento, números e hífen (ex.: loja-da-carla).",
    }),
  title: z
    .string({ message: "Informe o título do formulário." })
    .trim()
    .min(2, { message: "O título precisa ter pelo menos 2 caracteres." })
    .max(PUBLIC_FORM_TITLE_MAX, {
      message: `O título pode ter no máximo ${PUBLIC_FORM_TITLE_MAX} caracteres.`,
    }),
  message: z
    .string({ message: "Informe a mensagem de agradecimento." })
    .trim()
    .min(2, { message: "A mensagem precisa ter pelo menos 2 caracteres." })
    .max(PUBLIC_FORM_MESSAGE_MAX, {
      message: `A mensagem pode ter no máximo ${PUBLIC_FORM_MESSAGE_MAX} caracteres.`,
    }),
  whatsapp: optionalText.pipe(
    z
      .string()
      .trim()
      .refine((value) => normalizePhoneBR(value) !== null, {
        message: "WhatsApp inválido. Use DDD + número (ex.: (11) 98765-4321).",
      })
      .optional(),
  ),
  ownerId: optionalText,
});

export type PublicFormSettingsInput = z.infer<typeof publicFormSettingsSchema>;
