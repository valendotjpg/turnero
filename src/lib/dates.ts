// Fechas de calendario (YYYY-MM-DD) e instantes formateados en la zona del
// negocio. Una fecha de calendario no tiene zona: "2026-10-20" es el martes 20
// para el negocio, sin importar dónde corra el servidor o el navegador.

import { TZDate } from "@date-fns/tz";

const LOCALE = "es-AR";
const DAY_MS = 86_400_000;

/** ¿Es una fecha de calendario YYYY-MM-DD que existe? */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}

/** "09:30" → 570. Admite "24:00" (1440) como fin del día. `null` si no es válida. */
export function parseTimeOfDay(value: string): number | null {
  const match = /^([01]\d|2[0-4]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes <= 24 * 60 ? minutes : null;
}

/** 570 → "09:30" */
export function formatTimeOfDay(minutes: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** Fecha de calendario de un instante en la zona `timezone`. */
export function localDateOf(instant: Date, timezone: string): string {
  const local = new TZDate(instant.getTime(), timezone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`;
}

/** Suma (o resta) días a una fecha de calendario. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Lista de `count` fechas consecutivas a partir de `from` (inclusive). */
export function dateRange(from: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(from, i));
}

// Las fechas de calendario se formatean como medianoche UTC en zona UTC, así el
// resultado no depende de la zona del servidor.
const calendarDate = (date: string) => new Date(`${date}T00:00:00Z`);

/** "mar" */
export function formatWeekdayShort(date: string): string {
  return new Intl.DateTimeFormat(LOCALE, { weekday: "short", timeZone: "UTC" })
    .format(calendarDate(date))
    .replace(".", "");
}

/** "martes 20 de octubre" */
export function formatDateLong(date: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(calendarDate(date));
}

/** "20 oct" */
export function formatDayMonth(date: string): string {
  return new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", timeZone: "UTC" })
    .format(calendarDate(date))
    .replace(".", "");
}

/** "09:30", en 24 horas y en la zona del negocio. */
export function formatTime(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: timezone,
  }).format(instant);
}

/** "$ 12.000" a partir de centavos. */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** "45 min", "1 h", "1 h 30 min" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
