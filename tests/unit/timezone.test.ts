import { describe, expect, it } from "vitest";

import {
  addDaysToDateKey,
  calendarDaysBetweenKeys,
  dateKeyInTimeZone,
  formatDayLabelInTimeZone,
  isValidDateKey,
  parseDateKeyInTimeZone,
  resolveTimeZone,
  startOfDayInTimeZone,
  startOfNextDayInTimeZone,
} from "@/lib/timezone";

const SAO_PAULO = "America/Sao_Paulo";

describe("lib/timezone (007)", () => {
  it("usa o fuso da conta e cai no padrão quando o valor é inválido", () => {
    expect(resolveTimeZone("America/Sao_Paulo")).toBe("America/Sao_Paulo");
    expect(resolveTimeZone("Fuso/Quebrado")).toBe("America/Sao_Paulo");
    expect(resolveTimeZone(null)).toBe("America/Sao_Paulo");
  });

  it("vira a chave do dia às 03:00 UTC em São Paulo", () => {
    expect(dateKeyInTimeZone(new Date("2026-10-30T02:59:00.000Z"), SAO_PAULO)).toBe("2026-10-29");
    expect(dateKeyInTimeZone(new Date("2026-10-30T03:00:00.000Z"), SAO_PAULO)).toBe("2026-10-30");
  });

  it("calcula início do dia e do dia seguinte como instantes UTC", () => {
    const now = new Date("2026-10-30T15:00:00.000Z");
    expect(startOfDayInTimeZone(now, SAO_PAULO).toISOString()).toBe("2026-10-30T03:00:00.000Z");
    expect(startOfNextDayInTimeZone(now, SAO_PAULO).toISOString()).toBe("2026-10-31T03:00:00.000Z");
  });

  it("converte YYYY-MM-DD em 09:00 locais", () => {
    expect(parseDateKeyInTimeZone("2026-10-30", SAO_PAULO)?.toISOString()).toBe(
      "2026-10-30T12:00:00.000Z",
    );
    expect(parseDateKeyInTimeZone("2026-10-30", SAO_PAULO, 18)?.toISOString()).toBe(
      "2026-10-30T21:00:00.000Z",
    );
  });

  it("rejeita datas de calendário impossíveis", () => {
    expect(isValidDateKey("2026-02-30")).toBe(false);
    expect(isValidDateKey("2026-13-01")).toBe(false);
    expect(isValidDateKey("30/10/2026")).toBe(false);
    expect(isValidDateKey("2028-02-29")).toBe(true);
    expect(parseDateKeyInTimeZone("2026-02-30", SAO_PAULO)).toBeNull();
  });

  it("soma dias sem depender do fuso do processo", () => {
    expect(addDaysToDateKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToDateKey("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysToDateKey("2026-03-01", -1)).toBe("2026-02-28");
    expect(calendarDaysBetweenKeys("2026-10-29", "2026-10-30")).toBe(1);
    expect(calendarDaysBetweenKeys("2026-10-30", "2026-10-29")).toBe(-1);
  });

  it("respeita horário de verão em outro fuso", () => {
    const newYork = "America/New_York";
    const springForward = new Date("2026-03-08T12:00:00.000Z");

    expect(startOfDayInTimeZone(springForward, newYork).toISOString()).toBe(
      "2026-03-08T05:00:00.000Z",
    );
    expect(startOfNextDayInTimeZone(springForward, newYork).toISOString()).toBe(
      "2026-03-09T04:00:00.000Z",
    );
    expect(parseDateKeyInTimeZone("2026-03-08", newYork)?.toISOString()).toBe(
      "2026-03-08T13:00:00.000Z",
    );
  });

  it("formata o dia por extenso no fuso da conta", () => {
    const label = formatDayLabelInTimeZone(new Date("2026-10-30T15:00:00.000Z"), SAO_PAULO);
    expect(label).toContain("Sexta-feira");
    expect(label).toContain("30 de outubro");
  });
});
