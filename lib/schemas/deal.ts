import { z } from "zod";

import { dateKeyBR, parseDateKeyBR } from "@/lib/utils";

/**
 * Validação de negócios (tarefa 006).
 *
 * O servidor SEMPRE revalida os dados do formulário; os schemas aqui são
 * compartilhados com o client só para exibir mensagens em pt-BR.
 */

export const DEAL_STATUSES = ["OPEN", "WON", "LOST"] as const;
export type DealStatusValue = (typeof DEAL_STATUSES)[number];

export const DEAL_STATUS_LABELS: Record<DealStatusValue, string> = {
  OPEN: "Aberto",
  WON: "Ganho",
  LOST: "Perdido",
};

export const TASK_TYPE_LABELS = {
  WHATSAPP: "WhatsApp",
  CALL: "Ligação",
  MEETING: "Reunião",
  OTHER: "Outro",
} as const;

export const TASK_RESULT_LABELS = {
  ANSWERED: "Respondeu",
  NO_ANSWER: "Não respondeu",
  CALLBACK: "Pediu para voltar",
  WON: "Fechou",
  LOST: "Perdeu",
} as const;

const titleField = z
  .string({ message: "Informe o título do negócio." })
  .trim()
  .min(2, { message: "O título precisa ter pelo menos 2 caracteres." })
  .max(120, { message: "O título pode ter no máximo 120 caracteres." });

const idField = z.string({ message: "Negócio inválido." }).trim().min(1);

const optionalIdField = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

function parseMoney(value: unknown): number | undefined {
  if (value == null) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;
  // Aceita "1.200,50" (digitado) e "1200.50" (input type=number).
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  return Number(normalized);
}

const moneyField = z.preprocess(
  parseMoney,
  z
    .number({ message: "Valor inválido." })
    .min(0, { message: "O valor não pode ser negativo." })
    .max(1_000_000_000, { message: "Valor acima do limite do MVP." })
    .optional(),
);

const dateKey = (requiredMessage: string, invalidMessage = "Data inválida.") =>
  z
    .string({ message: requiredMessage })
    .trim()
    .refine(
      (value) => {
        const parsed = parseDateKeyBR(value);
        return parsed !== null && dateKeyBR(parsed) === value;
      },
      { message: invalidMessage },
    );

const optionalDateField = z.preprocess(
  (value) => (value == null || String(value).trim() === "" ? undefined : String(value).trim()),
  dateKey("Data inválida.").optional(),
);

/** Criação: contato, título e próxima ação são obrigatórios (regra do 007). */
export const createDealSchema = z.object({
  contactId: z.string({ message: "Contato inválido." }).trim().min(1),
  title: titleField,
  value: moneyField,
  stageId: optionalIdField,
  ownerId: optionalIdField,
  expectedCloseAt: optionalDateField,
  nextActionAt: dateKey("Informe a próxima ação."),
});

/** Edição: etapa e próxima ação têm ações próprias (drag e reagendamento). */
export const updateDealSchema = z.object({
  id: idField,
  title: titleField,
  value: moneyField,
  ownerId: optionalIdField,
  expectedCloseAt: optionalDateField,
});

export const closeDealSchema = z
  .object({
    id: idField,
    status: z.enum(["WON", "LOST"], { message: "Fechamento inválido." }),
    value: moneyField,
    lostReasonId: optionalIdField,
    lostNote: z
      .string()
      .trim()
      .max(500, { message: "A observação pode ter no máximo 500 caracteres." })
      .optional()
      .transform((value) => (value ? value : undefined)),
  })
  .superRefine((data, ctx) => {
    if (data.status === "LOST" && !data.lostReasonId) {
      ctx.addIssue({
        code: "custom",
        path: ["lostReasonId"],
        message: "Escolha o motivo da perda.",
      });
    }
  });

export const rescheduleDealSchema = z.object({
  id: idField,
  date: dateKey("Informe a nova data."),
});

export type CreateDealFormInput = z.infer<typeof createDealSchema>;
export type UpdateDealFormInput = z.infer<typeof updateDealSchema>;
export type CloseDealFormInput = z.infer<typeof closeDealSchema>;

/** Primeira mensagem de erro de um ZodError (mensagens já em pt-BR). */
export function firstDealIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}
