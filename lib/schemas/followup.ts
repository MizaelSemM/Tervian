import { z } from "zod";

import { isValidDateKey } from "@/lib/timezone";

/**
 * Validação da conclusão de tarefa (tarefa 007).
 *
 * Regra central: resultado + próxima ação, exceto quando o negócio fecha como
 * ganho/perdido. O servidor revalida tudo; o client só antecipa mensagens.
 */

export const TASK_RESULT_VALUES = ["ANSWERED", "NO_ANSWER", "CALLBACK", "WON", "LOST"] as const;
export type TaskResultValue = (typeof TASK_RESULT_VALUES)[number];

export const CLOSED_TASK_RESULTS: TaskResultValue[] = ["WON", "LOST"];

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, { message })
    .optional()
    .transform((value) => (value ? value : undefined));

function parseMoney(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  const raw = String(value).trim();
  if (!raw) return undefined;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  return Number(normalized);
}

const optionalMoney = z.preprocess(
  parseMoney,
  z
    .number({ message: "Valor inválido." })
    .min(0, { message: "O valor não pode ser negativo." })
    .max(1_000_000_000, { message: "Valor acima do limite do MVP." })
    .optional(),
);

const optionalDateKey = z.preprocess(
  (value) => (value == null || String(value).trim() === "" ? undefined : String(value).trim()),
  z
    .string()
    .refine((value) => isValidDateKey(value), { message: "Informe uma data válida." })
    .optional(),
);

export const completeTaskSchema = z
  .object({
    taskId: z
      .string({ message: "Tarefa inválida." })
      .trim()
      .min(1, { message: "Tarefa inválida." }),
    result: z.enum(TASK_RESULT_VALUES, { message: "Escolha o resultado do contato." }),
    resultNote: optionalText(500, "A observação pode ter no máximo 500 caracteres."),
    nextActionDate: optionalDateKey,
    nextActionTitle: optionalText(120, "O título pode ter no máximo 120 caracteres."),
    wonValue: optionalMoney,
    lostReasonId: optionalText(120, "Motivo inválido."),
    lostNote: optionalText(500, "A observação pode ter no máximo 500 caracteres."),
  })
  .superRefine((data, ctx) => {
    if (data.result === "LOST" && !data.lostReasonId) {
      ctx.addIssue({
        code: "custom",
        path: ["lostReasonId"],
        message: "Escolha o motivo da perda.",
      });
    }

    if (!CLOSED_TASK_RESULTS.includes(data.result) && !data.nextActionDate) {
      ctx.addIssue({
        code: "custom",
        path: ["nextActionDate"],
        message: "Defina a próxima ação antes de concluir.",
      });
    }
  });

export type CompleteTaskFormInput = z.infer<typeof completeTaskSchema>;

export function firstFollowupIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}
