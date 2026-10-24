export { cn } from "cn";

/** Fuso padrão da conta no MVP (o campo `Account.timezone` será usado na 007). */
export const APP_TIME_ZONE = "America/Sao_Paulo";

/** Offset fixo do Brasil (sem horário de verão desde 2019). */
const APP_TIME_ZONE_OFFSET = "-03:00";

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Data curta em pt-BR (ex.: 17/10/2026). Entrada inválida vira "—". */
export function formatDateBR(value: Date | string | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: APP_TIME_ZONE,
  }).format(date);
}

/** Data e hora curtas em pt-BR (ex.: 17/10/2026, 14:30). */
export function formatDateTimeBR(value: Date | string | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: APP_TIME_ZONE,
  }).format(date);
}

/** Valor em reais (ex.: R$ 1.200,00). */
export function formatCurrencyBR(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Chave de calendário no fuso da conta: `YYYY-MM-DD`.
 * Usada em `<input type="date">` e nas comparações de "hoje"/"atrasada".
 */
export function dateKeyBR(value: Date | string | null | undefined): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = toDate(value);
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Data de hoje no fuso da conta, como `YYYY-MM-DD`. */
export function todayDateKeyBR(now: Date = new Date()): string {
  return dateKeyBR(now);
}

/**
 * Converte `YYYY-MM-DD` em `Date`.
 *
 * O horário padrão é 18h: uma ação marcada para "hoje" continua válida durante
 * o dia inteiro, em vez de nascer atrasada às 09h. O fuso é fixo (-03:00)
 * porque o Brasil não tem mais horário de verão.
 */
export function parseDateKeyBR(value: string, hour = 18): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T${String(hour).padStart(2, "0")}:00:00${APP_TIME_ZONE_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Diferença em dias de calendário (`to - from`), sem depender do horário. */
export function calendarDaysBetween(fromKey: string, toKey: string): number {
  const [fromYear, fromMonth, fromDay] = fromKey.split("-").map(Number);
  const [toYear, toMonth, toDay] = toKey.split("-").map(Number);
  const from = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const to = Date.UTC(toYear, toMonth - 1, toDay);
  return Math.round((to - from) / 86_400_000);
}

/** Dias desde uma data (0 = hoje). Datas futuras viram 0. */
export function daysSinceBR(
  value: Date | string | null | undefined,
  now: Date = new Date(),
): number | null {
  const key = dateKeyBR(value);
  if (!key) return null;
  return Math.max(0, calendarDaysBetween(key, todayDateKeyBR(now)));
}

export type NextActionTone = "overdue" | "today" | "soon" | "none";

/** Rótulo curto da próxima ação, comparando apenas o calendário. */
export function nextActionLabelBR(
  value: Date | string | null | undefined,
  now: Date = new Date(),
): { text: string; tone: NextActionTone } {
  const key = dateKeyBR(value);
  if (!key) return { text: "Sem próxima ação", tone: "none" };
  const diff = calendarDaysBetween(todayDateKeyBR(now), key);
  if (diff < 0) {
    const days = Math.abs(diff);
    return { text: `Atrasada há ${days} ${days === 1 ? "dia" : "dias"}`, tone: "overdue" };
  }
  if (diff === 0) return { text: "Hoje", tone: "today" };
  if (diff === 1) return { text: "Amanhã", tone: "soon" };
  return { text: `Em ${diff} dias`, tone: "soon" };
}
