// =============================================================
// Motor de disponibilidad
// =============================================================
// Calcula los horarios en los que se puede reservar un servicio en un día
// dado. Es lógica pura: no accede a la base ni al reloj del sistema (la hora
// actual se recibe como parámetro), así que se puede testear de forma
// determinística.
//
// Convenciones:
//   - Los intervalos son semiabiertos [start, end): un turno que termina a las
//     10:00 no se superpone con otro que empieza a las 10:00. Es la misma regla
//     que aplica la restricción EXCLUDE de la base.
//   - Los horarios de atención están en minutos desde la medianoche, en la
//     hora local del negocio. Se convierten a instantes reales para cada fecha,
//     de modo que los cambios de horario de verano se resuelven solos.
//   - Los horarios ofrecidos avanzan en tiempo real (no de reloj de pared)
//     desde el inicio de cada franja.
// =============================================================

import { TZDate } from "@date-fns/tz";

export interface Interval {
  start: Date;
  end: Date;
}

export interface WorkingWindow {
  /** 0 = domingo … 6 = sábado */
  weekday: number;
  startMinute: number;
  endMinute: number;
}

export interface AvailabilityInput {
  /** Día a consultar, en la hora local del negocio (YYYY-MM-DD). */
  date: string;
  /** Zona horaria IANA del negocio. */
  timezone: string;
  /** Franjas de atención semanales. Se usan sólo las del día de `date`. */
  workingHours: WorkingWindow[];
  /** Intervalos no disponibles: turnos activos y bloqueos de agenda. */
  busy: Interval[];
  durationMinutes: number;
  /** Separación entre horarios ofrecidos. Por defecto, 15 minutos. */
  stepMinutes?: number;
  now: Date;
  /** Anticipación mínima para reservar. Por defecto, 0. */
  minLeadMinutes?: number;
}

const MINUTE_MS = 60_000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Separa "YYYY-MM-DD" en sus partes, validando que sea una fecha real. */
function parseLocalDate(date: string) {
  const match = DATE_PATTERN.exec(date);
  if (!match) throw new RangeError(`Fecha inválida: "${date}" (se espera YYYY-MM-DD)`);

  const [year, month, day] = match.slice(1).map(Number);
  // Date.UTC normaliza fechas imposibles (31/02 → 03/03); si cambió, no existía.
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    throw new RangeError(`Fecha inexistente: "${date}"`);
  }
  return { year, month, day, weekday: utc.getUTCDay() };
}

/** Instante real que corresponde a `date` + `minute` en la zona `timezone`. */
function zonedInstant(date: string, minute: number, timezone: string): Date {
  const { year, month, day } = parseLocalDate(date);
  const local = new TZDate(year, month - 1, day, Math.floor(minute / 60), minute % 60, timezone);
  return new Date(local.getTime());
}

/** Día de la semana (0 = domingo) de una fecha YYYY-MM-DD. */
export function weekdayOf(date: string): number {
  return parseLocalDate(date).weekday;
}

/**
 * Comienzo y fin del día `date` en la zona `timezone`. Sirve para buscar en la
 * base los turnos y bloqueos que pueden afectar la disponibilidad de ese día.
 */
export function dayBounds(date: string, timezone: string): Interval {
  return {
    start: zonedInstant(date, 0, timezone),
    end: zonedInstant(date, 24 * 60, timezone),
  };
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

function assertPositiveInteger(value: number, name: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} debe ser un entero positivo (recibido: ${value})`);
  }
}

/** Horarios disponibles para reservar, ordenados cronológicamente. */
export function getAvailableSlots(input: AvailabilityInput): Interval[] {
  const { date, timezone, workingHours, busy, durationMinutes, now } = input;
  const stepMinutes = input.stepMinutes ?? 15;
  const minLeadMinutes = input.minLeadMinutes ?? 0;

  assertPositiveInteger(durationMinutes, "durationMinutes");
  assertPositiveInteger(stepMinutes, "stepMinutes");

  const weekday = weekdayOf(date);
  const durationMs = durationMinutes * MINUTE_MS;
  const stepMs = stepMinutes * MINUTE_MS;
  const earliestStart = now.getTime() + minLeadMinutes * MINUTE_MS;

  // Se indexa por timestamp para descartar duplicados si hay franjas solapadas.
  const slots = new Map<number, Interval>();

  for (const window of workingHours) {
    if (window.weekday !== weekday) continue;

    const windowStart = zonedInstant(date, window.startMinute, timezone).getTime();
    const windowEnd = zonedInstant(date, window.endMinute, timezone).getTime();

    for (let start = windowStart; start + durationMs <= windowEnd; start += stepMs) {
      if (start < earliestStart) continue;

      const slot = { start: new Date(start), end: new Date(start + durationMs) };
      if (busy.some((interval) => overlaps(slot, interval))) continue;

      slots.set(start, slot);
    }
  }

  return [...slots.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
}
