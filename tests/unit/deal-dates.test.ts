import { describe, expect, it } from "vitest";

import {
  calendarDaysBetween,
  dateKeyBR,
  daysSinceBR,
  nextActionLabelBR,
  parseDateKeyBR,
  todayDateKeyBR,
} from "@/lib/utils";

describe("datas do funil (fuso da conta)", () => {
  it("formata a chave de calendário no fuso de São Paulo", () => {
    // 01:00 UTC de 25/10 ainda é 24/10 em São Paulo (UTC-3).
    expect(dateKeyBR(new Date("2026-10-25T01:00:00Z"))).toBe("2026-10-24");
    expect(dateKeyBR(new Date("2026-10-25T03:00:00Z"))).toBe("2026-10-25");
    expect(dateKeyBR("2026-10-24")).toBe("2026-10-24");
    expect(dateKeyBR(null)).toBe("");
  });

  it("converte YYYY-MM-DD para o fim do dia e volta para a mesma chave", () => {
    const date = parseDateKeyBR("2026-10-24");
    expect(date).not.toBeNull();
    expect(dateKeyBR(date)).toBe("2026-10-24");
    expect(date?.toISOString()).toBe("2026-10-24T21:00:00.000Z"); // 18h BRT
  });

  it("rejeita formato inválido", () => {
    expect(parseDateKeyBR("24/10/2026")).toBeNull();
    expect(parseDateKeyBR("")).toBeNull();
  });

  it("conta dias de calendário sem depender do horário", () => {
    expect(calendarDaysBetween("2026-10-24", "2026-11-01")).toBe(8);
    expect(calendarDaysBetween("2026-10-24", "2026-10-24")).toBe(0);
    expect(daysSinceBR("2026-10-20T23:30:00-03:00", new Date("2026-10-24T01:00:00-03:00"))).toBe(4);
    expect(daysSinceBR("2026-10-30T12:00:00-03:00", new Date("2026-10-24T12:00:00-03:00"))).toBe(0);
  });

  it("rotula a próxima ação por dia", () => {
    const now = new Date("2026-10-24T15:00:00-03:00");

    expect(nextActionLabelBR(null, now)).toEqual({ text: "Sem próxima ação", tone: "none" });
    expect(nextActionLabelBR(new Date("2026-10-22T09:00:00-03:00"), now)).toEqual({
      text: "Atrasada há 2 dias",
      tone: "overdue",
    });
    expect(nextActionLabelBR(new Date("2026-10-24T23:00:00-03:00"), now)).toEqual({
      text: "Hoje",
      tone: "today",
    });
    expect(nextActionLabelBR(new Date("2026-10-25T08:00:00-03:00"), now)).toEqual({
      text: "Amanhã",
      tone: "soon",
    });
    expect(nextActionLabelBR(new Date("2026-10-28T09:00:00-03:00"), now)).toEqual({
      text: "Em 4 dias",
      tone: "soon",
    });
  });

  it("todayDateKeyBR usa a data do fuso, não UTC", () => {
    expect(todayDateKeyBR(new Date("2026-10-25T01:00:00Z"))).toBe("2026-10-24");
  });
});
