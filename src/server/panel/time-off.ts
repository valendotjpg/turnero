// Bloqueos puntuales de agenda: feriados, vacaciones, un trámite.

import "server-only";
import { z } from "zod";
import { zonedInstant } from "@/lib/availability";
import { addDays, isCalendarDate, parseTimeOfDay } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { fieldErrorsOf, optional, type FieldErrors } from "@/lib/validation";

const calendarDate = z.string().refine(isCalendarDate, "Ingresá una fecha válida.");
const timeOfDay = z
  .string()
  .refine((v) => parseTimeOfDay(v) !== null, "Ingresá una hora válida (HH:MM).");

export const timeOffInputSchema = z.object({
  startDate: calendarDate,
  endDate: calendarDate,
  /** Sin horas, el bloqueo abarca los días completos. */
  startTime: optional(timeOfDay),
  endTime: optional(timeOfDay),
  reason: optional(z.string().trim().max(120, "El motivo no puede superar los 120 caracteres.")),
});

export type TimeOffField = keyof z.input<typeof timeOffInputSchema>;

export type CreateTimeOffResult =
  | { ok: true; overlappingAppointments: number }
  | { ok: false; error?: string; fieldErrors?: FieldErrors<TimeOffField> };

export function listUpcomingTimeOff(businessId: string, now: Date = new Date()) {
  return prisma.timeOff.findMany({
    where: { businessId, endsAt: { gt: now } },
    orderBy: { startsAt: "asc" },
    select: { id: true, startsAt: true, endsAt: true, reason: true },
  });
}

/**
 * Crea un bloqueo. No cancela los turnos que ya estaban dados en ese período:
 * devuelve cuántos son para que el negocio decida qué hacer con ellos.
 */
export async function createTimeOff(
  businessId: string,
  timezone: string,
  rawInput: unknown,
): Promise<CreateTimeOffResult> {
  const parsed = timeOffInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };
  const { startDate, endDate, startTime, endTime, reason } = parsed.data;

  // Sin hora de inicio, desde las 00:00; sin hora de fin, hasta el final del día.
  const startsAt = zonedInstant(startDate, startTime ? parseTimeOfDay(startTime)! : 0, timezone);
  const endsAt = endTime
    ? zonedInstant(endDate, parseTimeOfDay(endTime)!, timezone)
    : zonedInstant(addDays(endDate, 1), 0, timezone);

  if (endsAt <= startsAt) {
    return { ok: false, fieldErrors: { endDate: "El bloqueo tiene que terminar después de empezar." } };
  }

  await prisma.timeOff.create({ data: { businessId, startsAt, endsAt, reason } });

  const overlappingAppointments = await prisma.appointment.count({
    where: { businessId, status: "CONFIRMED", startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
  });
  return { ok: true, overlappingAppointments };
}

export async function deleteTimeOff(businessId: string, timeOffId: string) {
  const { count } = await prisma.timeOff.deleteMany({ where: { id: timeOffId, businessId } });
  return count === 1;
}
