/**
 * Datas de calendário no fuso da conta (tarefa 007).
 *
 * O banco guarda `DateTime` em UTC; a tela "Hoje" precisa saber onde começa e
 * onde termina o dia para o vendedor. Em vez de assumir -03:00, usamos
 * `Intl.DateTimeFormat` com o `Account.timezone` — assim uma conta em outro
 * fuso (ou com horário de verão) continua correta.
 *
 * Funções puras (sem Prisma): dá para usar no client e testar sem banco.
 */

export const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

/** Usa o fuso da conta quando válido; cai no padrão se o dado estiver corrompido. */
export function resolveTimeZone(value: string | null | undefined): string {
  if (!value) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function partsInTimeZone(date: Date, timeZone: string): DateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;
    return Number(value ?? 0);
  };

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Offset do fuso (ms) naquele instante: UTC - local. */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = partsInTimeZone(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Converte uma data/hora de parede no fuso para o instante UTC correspondente. */
export function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const target = Date.UTC(year, month - 1, day, hour, minute, 0);
  let timestamp = target - timeZoneOffsetMs(new Date(target), timeZone);

  // Segunda passada cobre a mudança de offset perto de transições de horário de verão.
  const offset = timeZoneOffsetMs(new Date(timestamp), timeZone);
  timestamp = target - offset;
  return new Date(timestamp);
}

/** `YYYY-MM-DD` no fuso informado. */
export function dateKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = partsInTimeZone(date, timeZone);
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(
    parts.day,
  ).padStart(2, "0")}`;
}

/** Data de hoje (`YYYY-MM-DD`) no fuso informado. */
export function todayKeyInTimeZone(timeZone: string, now: Date = new Date()): string {
  return dateKeyInTimeZone(now, timeZone);
}

/** Valida uma data de calendário real (rejeita 2026-02-30, 2026-13-01 etc.). */
export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** Soma dias a uma chave `YYYY-MM-DD` sem depender do fuso do processo. */
export function addDaysToDateKey(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * `YYYY-MM-DD` → instante no fuso da conta.
 * O padrão é 09:00 (atalhos da tela "Hoje").
 */
export function parseDateKeyInTimeZone(value: string, timeZone: string, hour = 9): Date | null {
  if (!isValidDateKey(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = zonedDateTimeToUtc(year, month, day, hour, 0, timeZone);
  return dateKeyInTimeZone(date, timeZone) === value ? date : null;
}

/** Início do dia (00:00) no fuso, como instante UTC. */
export function startOfDayInTimeZone(now: Date, timeZone: string): Date {
  const key = dateKeyInTimeZone(now, timeZone);
  const [year, month, day] = key.split("-").map(Number);
  return zonedDateTimeToUtc(year, month, day, 0, 0, timeZone);
}

/** Início do dia seguinte (00:00), como instante UTC. */
export function startOfNextDayInTimeZone(now: Date, timeZone: string): Date {
  const key = addDaysToDateKey(dateKeyInTimeZone(now, timeZone), 1);
  const [year, month, day] = key.split("-").map(Number);
  return zonedDateTimeToUtc(year, month, day, 0, 0, timeZone);
}

/** Diferença em dias de calendário (`to - from`). */
export function calendarDaysBetweenKeys(fromKey: string, toKey: string): number {
  const [fromYear, fromMonth, fromDay] = fromKey.split("-").map(Number);
  const [toYear, toMonth, toDay] = toKey.split("-").map(Number);
  return Math.round(
    (Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) /
      86_400_000,
  );
}

/** Hora curta no fuso (ex.: "09:00"). */
export function formatTimeInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Data por extenso no fuso (ex.: "Sexta-feira, 30 de outubro"). */
export function formatDayLabelInTimeZone(date: Date, timeZone: string): string {
  const label = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
