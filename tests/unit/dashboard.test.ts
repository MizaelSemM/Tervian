import { describe, expect, it } from "vitest";

import {
  buildStageSummaries,
  calendarRangeInTimeZone,
  dashboardPeriodRange,
  DEFAULT_STALLED_DAYS,
  isDealStalled,
  parseDashboardPeriod,
  parseStalledDays,
  stalledCutoff,
  weightedForecast,
} from "@/lib/dashboard";

const SAO_PAULO = "America/Sao_Paulo";
const NEW_YORK = "America/New_York";
const NOW = new Date("2026-11-08T15:00:00.000Z");

describe("lib/dashboard (011)", () => {
  it("normaliza os filtros de per��odo e de dias parados", () => {
    expect(parseDashboardPeriod("30d")).toBe("30d");
    expect(parseDashboardPeriod("mes")).toBe("month");
    expect(parseDashboardPeriod(null)).toBe("month");

    expect(parseStalledDays("14")).toBe(14);
    expect(parseStalledDays(30)).toBe(30);
    expect(parseStalledDays("8")).toBe(DEFAULT_STALLED_DAYS);
    expect(parseStalledDays(undefined)).toBe(DEFAULT_STALLED_DAYS);
  });

  it("calcula o m��s atual no fuso da conta", () => {
    const range = dashboardPeriodRange("month", NOW, SAO_PAULO);
    expect(range.start.toISOString()).toBe("2026-11-01T03:00:00.000Z");
    expect(range.end.toISOString()).toBe(NOW.toISOString());

    const newYorkRange = dashboardPeriodRange(
      "month",
      new Date("2026-03-08T12:00:00.000Z"),
      NEW_YORK,
    );
    expect(newYorkRange.start.toISOString()).toBe("2026-03-01T05:00:00.000Z");
  });

  it("conta os ��ltimos 30 dias de calend��rio, incluindo hoje", () => {
    const range = dashboardPeriodRange("30d", NOW, SAO_PAULO);
    expect(range.start.toISOString()).toBe("2026-10-10T03:00:00.000Z");
    expect(range.end.toISOString()).toBe(NOW.toISOString());

    expect(calendarRangeInTimeZone(NOW, SAO_PAULO, 1).start.toISOString()).toBe(
      "2026-11-08T03:00:00.000Z",
    );
  });

  it("corta 'parado' no in��cio do dia X dias atr��s", () => {
    const cutoff = stalledCutoff(NOW, 7, SAO_PAULO);
    expect(cutoff.toISOString()).toBe("2026-11-01T03:00:00.000Z");

    expect(
      isDealStalled(
        { lastActivityAt: new Date("2026-10-31T23:00:00.000Z"), createdAt: new Date() },
        cutoff,
      ),
    ).toBe(true);
    expect(
      isDealStalled(
        { lastActivityAt: new Date("2026-11-01T03:00:00.000Z"), createdAt: new Date() },
        cutoff,
      ),
    ).toBe(false);
  });

  it("usa a cria����o como fallback quando nunca houve atividade", () => {
    const cutoff = stalledCutoff(NOW, 14, SAO_PAULO);
    expect(
      isDealStalled(
        { lastActivityAt: null, createdAt: new Date("2026-10-20T12:00:00.000Z") },
        cutoff,
      ),
    ).toBe(true);
    expect(
      isDealStalled(
        { lastActivityAt: null, createdAt: new Date("2026-11-05T12:00:00.000Z") },
        cutoff,
      ),
    ).toBe(false);
  });

  it("calcula a previs��o ponderada pela probabilidade da etapa", () => {
    expect(
      weightedForecast([
        { totalValue: 1_000, probability: 10 },
        { totalValue: 2_000, probability: 50 },
        { totalValue: 500, probability: 0 },
      ]),
    ).toBe(1_100);

    // Probabilidade corrompida n��o pode inflar a previs��o.
    expect(
      weightedForecast([
        { totalValue: 1_000, probability: 150 },
        { totalValue: 1_000, probability: -20 },
      ]),
    ).toBe(1_000);
  });

  it("junta etapas e totais agregados, incluindo etapa sem neg��cios", () => {
    const stages = [
      { id: "novo", name: "Novo", position: 1, probability: 10 },
      { id: "proposta", name: "Proposta", position: 2, probability: 50 },
      { id: "negociacao", name: "Negocia����o", position: 3, probability: 75 },
    ];
    const summaries = buildStageSummaries(stages, {
      novo: { count: 2, totalValue: 1_000 },
      proposta: { count: 1, totalValue: 2_000 },
    });

    expect(summaries).toEqual([
      {
        id: "novo",
        name: "Novo",
        position: 1,
        probability: 10,
        count: 2,
        totalValue: 1_000,
        weightedValue: 100,
      },
      {
        id: "proposta",
        name: "Proposta",
        position: 2,
        probability: 50,
        count: 1,
        totalValue: 2_000,
        weightedValue: 1_000,
      },
      {
        id: "negociacao",
        name: "Negocia����o",
        position: 3,
        probability: 75,
        count: 0,
        totalValue: 0,
        weightedValue: 0,
      },
    ]);
  });
});
