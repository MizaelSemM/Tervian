import { describe, expect, it } from "vitest";

import {
  closeDealSchema,
  createDealSchema,
  firstDealIssueMessage,
  rescheduleDealSchema,
  updateDealSchema,
} from "@/lib/schemas/deal";

describe("createDealSchema", () => {
  it("aceita o formulário completo e normaliza título, dinheiro e datas", () => {
    const parsed = createDealSchema.safeParse({
      contactId: " contact-1 ",
      title: "  Compra de 20 unidades  ",
      value: "1.200,50",
      stageId: "",
      ownerId: "",
      expectedCloseAt: "2026-11-30",
      nextActionAt: "2026-10-25",
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toMatchObject({
      contactId: "contact-1",
      title: "Compra de 20 unidades",
      value: 1200.5,
      stageId: undefined,
      ownerId: undefined,
      expectedCloseAt: "2026-11-30",
      nextActionAt: "2026-10-25",
    });
  });

  it("aceita valor vazio e data prevista vazia", () => {
    const parsed = createDealSchema.safeParse({
      contactId: "contact-1",
      title: "Negócio",
      value: "",
      expectedCloseAt: "",
      nextActionAt: "2026-10-25",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.value).toBeUndefined();
      expect(parsed.data.expectedCloseAt).toBeUndefined();
    }
  });

  it("rejeita título curto, valor negativo e próxima ação ausente", () => {
    const short = createDealSchema.safeParse({
      contactId: "contact-1",
      title: "A",
      nextActionAt: "2026-10-25",
    });
    expect(short.success).toBe(false);
    if (!short.success) expect(firstDealIssueMessage(short.error)).toMatch(/pelo menos 2/);

    const negative = createDealSchema.safeParse({
      contactId: "contact-1",
      title: "Negócio",
      value: "-1",
      nextActionAt: "2026-10-25",
    });
    expect(negative.success).toBe(false);

    const noAction = createDealSchema.safeParse({
      contactId: "contact-1",
      title: "Negócio",
    });
    expect(noAction.success).toBe(false);
    if (!noAction.success) expect(firstDealIssueMessage(noAction.error)).toMatch(/próxima ação/i);
  });

  it("rejeita data de calendário impossível", () => {
    const parsed = createDealSchema.safeParse({
      contactId: "contact-1",
      title: "Negócio",
      nextActionAt: "2026-02-30",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(firstDealIssueMessage(parsed.error)).toBe("Data inválida.");
  });
});

describe("updateDealSchema", () => {
  it("exige id e título, mas permite limpar valor/data", () => {
    const ok = updateDealSchema.safeParse({
      id: "deal-1",
      title: "Novo título",
      value: "",
      expectedCloseAt: "",
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.value).toBeUndefined();
      expect(ok.data.expectedCloseAt).toBeUndefined();
    }

    expect(updateDealSchema.safeParse({ id: "", title: "Ok" }).success).toBe(false);
  });
});

describe("closeDealSchema", () => {
  it("aceita ganho com valor opcional (o serviço usa o valor atual)", () => {
    const parsed = closeDealSchema.safeParse({
      id: "deal-1",
      status: "WON",
      value: "",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.value).toBeUndefined();
  });

  it("exige motivo quando o status é LOST", () => {
    const missing = closeDealSchema.safeParse({
      id: "deal-1",
      status: "LOST",
      lostReasonId: "",
    });
    expect(missing.success).toBe(false);
    if (!missing.success)
      expect(firstDealIssueMessage(missing.error)).toBe("Escolha o motivo da perda.");

    const ok = closeDealSchema.safeParse({
      id: "deal-1",
      status: "LOST",
      lostReasonId: "reason-1",
      lostNote: "  Preço alto  ",
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.lostNote).toBe("Preço alto");
  });

  it("rejeita status diferente de WON/LOST", () => {
    expect(closeDealSchema.safeParse({ id: "deal-1", status: "OPEN" }).success).toBe(false);
  });
});

describe("rescheduleDealSchema", () => {
  it("aceita data válida e rejeita data impossível", () => {
    expect(rescheduleDealSchema.safeParse({ id: "deal-1", date: "2026-10-25" }).success).toBe(true);
    expect(rescheduleDealSchema.safeParse({ id: "deal-1", date: "25/10/2026" }).success).toBe(
      false,
    );
    expect(rescheduleDealSchema.safeParse({ id: "deal-1", date: "2026-04-31" }).success).toBe(
      false,
    );
  });
});
