// Une el motor de disponibilidad con la base: busca los datos del negocio
// para un día y delega el cálculo en la lógica pura de @/lib/availability.

import { dayBounds, getAvailableSlots, weekdayOf, type Interval } from "@/lib/availability";
import { prisma } from "@/lib/prisma";

/** Separación entre los horarios ofrecidos al cliente. */
export const SLOT_STEP_MINUTES = 15;
/** Anticipación mínima para reservar online. */
export const MIN_LEAD_MINUTES = 60;

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
  const business = await prisma.business.findUnique({
    where: { slug: businessSlug },
    select: { id: true, timezone: true },
  });
  if (!business) return null;

  const service = await prisma.service.findFirst({
    where: { id: serviceId, businessId: business.id, active: true },
    select: { durationMinutes: true },
  });
  if (!service) return null;

  const day = dayBounds(date, business.timezone);
  // Cualquier intervalo que toque el día, aunque empiece el día anterior.
  const touchesDay = { startsAt: { lt: day.end }, endsAt: { gt: day.start } };

  const [workingHours, appointments, timeOff] = await Promise.all([
    prisma.workingHours.findMany({
      where: { businessId: business.id, weekday: weekdayOf(date) },
      select: { weekday: true, startMinute: true, endMinute: true },
    }),
    prisma.appointment.findMany({
      where: { businessId: business.id, status: { not: "CANCELLED" }, ...touchesDay },
      select: { startsAt: true, endsAt: true },
    }),
    prisma.timeOff.findMany({
      where: { businessId: business.id, ...touchesDay },
      select: { startsAt: true, endsAt: true },
    }),
  ]);

  const busy = [...appointments, ...timeOff].map(({ startsAt, endsAt }) => ({
    start: startsAt,
    end: endsAt,
  }));

  return getAvailableSlots({
    date,
    timezone: business.timezone,
    workingHours,
    busy,
    durationMinutes: service.durationMinutes,
    stepMinutes: SLOT_STEP_MINUTES,
    now,
    minLeadMinutes: MIN_LEAD_MINUTES,
  });
}
