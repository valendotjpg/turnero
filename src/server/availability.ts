// Une el motor de disponibilidad con la base: busca los datos del negocio
// para un día y delega el cálculo en la lógica pura de @/lib/availability.

import { dayBounds, getAvailableSlots, weekdayOf, type Interval } from "@/lib/availability";
import { addDays, localDateOf } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

/** Separación entre los horarios ofrecidos al cliente. */
export const SLOT_STEP_MINUTES = 15;
/** Anticipación mínima para reservar online. */
export const MIN_LEAD_MINUTES = 60;
/** Cuántos días hacia adelante (contando hoy) se puede reservar. */
export const BOOKING_WINDOW_DAYS = 30;

/** Lo mínimo que hace falta saber del negocio y del servicio para calcular. */
export interface SlotContext {
  businessId: string;
  timezone: string;
  durationMinutes: number;
}

/** Primer y último día reservables, en la hora local del negocio. */
export function bookingWindow(timezone: string, now: Date) {
  const first = localDateOf(now, timezone);
  return { first, last: addDays(first, BOOKING_WINDOW_DAYS - 1) };
}

/**
 * Horarios libres para un servicio ya identificado. Fuera de la ventana de
 * reserva devuelve una lista vacía. Lanza RangeError si la fecha no es válida.
 */
export async function computeSlots(
  { businessId, timezone, durationMinutes }: SlotContext,
  date: string,
  now: Date,
): Promise<Interval[]> {
  const day = dayBounds(date, timezone); // valida la fecha
  const window = bookingWindow(timezone, now);
  if (date < window.first || date > window.last) return [];

  // Cualquier intervalo que toque el día, aunque empiece el día anterior.
  const touchesDay = { startsAt: { lt: day.end }, endsAt: { gt: day.start } };

  const [workingHours, appointments, timeOff] = await Promise.all([
    prisma.workingHours.findMany({
      where: { businessId, weekday: weekdayOf(date) },
      select: { weekday: true, startMinute: true, endMinute: true },
    }),
    prisma.appointment.findMany({
      where: { businessId, status: { not: "CANCELLED" }, ...touchesDay },
      select: { startsAt: true, endsAt: true },
    }),
    prisma.timeOff.findMany({
      where: { businessId, ...touchesDay },
      select: { startsAt: true, endsAt: true },
    }),
  ]);

  const busy = [...appointments, ...timeOff].map(({ startsAt, endsAt }) => ({
    start: startsAt,
    end: endsAt,
  }));

  return getAvailableSlots({
    date,
    timezone,
    workingHours,
    busy,
    durationMinutes,
    stepMinutes: SLOT_STEP_MINUTES,
    now,
    minLeadMinutes: MIN_LEAD_MINUTES,
  });
}

/**
 * Busca el negocio y un servicio activo suyo. Devuelve `null` si alguno no
 * existe o si el servicio pertenece a otro negocio.
 */
export async function findSlotContext(
  businessSlug: string,
  serviceId: string,
): Promise<SlotContext | null> {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, active: true, business: { slug: businessSlug } },
    select: { durationMinutes: true, business: { select: { id: true, timezone: true } } },
  });
  if (!service) return null;

  return {
    businessId: service.business.id,
    timezone: service.business.timezone,
    durationMinutes: service.durationMinutes,
  };
}

interface FindAvailableSlotsParams {
  businessSlug: string;
  serviceId: string;
  /** Día en la hora local del negocio (YYYY-MM-DD). */
  date: string;
  now?: Date;
}

/**
 * Horarios libres de un servicio en un día. Devuelve `null` si el negocio no
 * existe o el servicio no pertenece a él o no está activo. Lanza RangeError
 * si la fecha no es válida.
 */
export async function findAvailableSlots({
  businessSlug,
  serviceId,
  date,
  now = new Date(),
}: FindAvailableSlotsParams): Promise<Interval[] | null> {
  const context = await findSlotContext(businessSlug, serviceId);
  return context && computeSlots(context, date, now);
}
