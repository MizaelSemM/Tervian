import { describe, expect, it } from "vitest";

import {
  CLOSED_TASK_RESULTS,
  completeTaskSchema,
  firstFollowupIssueMessage,
} from "@/lib/schemas/followup";

const base = { taskId: "task-1" } as const;

describe("completeTaskSchema (007)", () => {
  it("exige próxima ação para resultados que mantêm o negócio aberto", () => {
    const missing = completeTaskSchema.safeParse({ ...base, result: "ANSWERED" });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(firstFollowupIssueMessage(missing.error)).toBe(
        "Defina a próxima ação antes de concluir.",
      );
    }

    expect(
      completeTaskSchema.safeParse({
        ...base,
        result: "ANSWERED",
        nextActionDate: "2026-11-02",
      }).success,
    ).toBe(true);
  });

  it("aceita ganho sem data e sem motivo de perda", () => {
    const parsed = completeTaskSchema.safeParse({ ...base, result: "WON" });
    expect(parsed.success).toBe(true);
  });

  it("exige motivo ao perder", () => {
    const missing = completeTaskSchema.safeParse({ ...base, result: "LOST" });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(firstFollowupIssueMessage(missing.error)).toBe("Escolha o motivo da perda.");
    }

    expect(
      completeTaskSchema.safeParse({
        ...base,
        result: "LOST",
        lostReasonId: "reason-1",
        lostNote: "Sem retorno",
      }).success,
    ).toBe(true);
  });

  it("normaliza valor em formato brasileiro", () => {
    const parsed = completeTaskSchema.safeParse({
      ...base,
      result: "WON",
      wonValue: "1.234,56",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.wonValue).toBe(1234.56);
  });

  it("rejeita data inválida e texto acima do limite", () => {
    expect(
      completeTaskSchema.safeParse({
        ...base,
        result: "CALLBACK",
        nextActionDate: "2026-02-30",
      }).success,
    ).toBe(false);
    expect(
      completeTaskSchema.safeParse({
        ...base,
        result: "NO_ANSWER",
        nextActionDate: "2026-11-02",
        resultNote: "x".repeat(501),
      }).success,
    ).toBe(false);
  });

  it("trata campos opcionais vazios como ausentes", () => {
    const parsed = completeTaskSchema.safeParse({
      ...base,
      result: "CALLBACK",
      nextActionDate: "2026-11-02",
      resultNote: "   ",
      nextActionTitle: "",
      wonValue: "",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.resultNote).toBeUndefined();
      expect(parsed.data.nextActionTitle).toBeUndefined();
      expect(parsed.data.wonValue).toBeUndefined();
    }
  });

  it("expõe apenas ganho/perdido como resultados de fechamento", () => {
    expect(CLOSED_TASK_RESULTS).toEqual(["WON", "LOST"]);
  });
});
