// Agenda del negocio: turnos por día y cambios de estado.

import "server-only";
import { dayBounds } from "@/lib/availability";
import { localDateOf } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import type { AppointmentStatus } from "@/generated/prisma/client";
import type { MutationResult } from "@/lib/validation";
import { enqueueAppointmentEmails } from "../email/outbox";

/** Turnos (en cualquier estado) y bloqueos de un día, en orden cronológico. */
export async function getDayAgenda(businessId: string, timezone: string, date: string) {
  const day = dayBounds(date, timezone);

  const [appointments, timeOff] = await Promise.all([
    prisma.appointment.findMany({
      where: { businessId, startsAt: { gte: day.start, lt: day.end } },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        status: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        notes: true,
        service: { select: { name: true } },
      },
    }),
    prisma.timeOff.findMany({
      where: { businessId, startsAt: { lt: day.end }, endsAt: { gt: day.start } },
      orderBy: { startsAt: "asc" },
      select: { id: true, startsAt: true, endsAt: true, reason: true },
    }),
  ]);
  return { appointments, timeOff };
}

/** Cantidad de turnos no cancelados por día, para una lista de días consecutivos. */
export async function countAppointmentsByDay(
  businessId: string,
  timezone: string,
  dates: string[],
): Promise<Map<string, number>> {
  const counts = new Map(dates.map((d) => [d, 0]));
  if (dates.length === 0) return counts;

  const rows = await prisma.appointment.findMany({
    where: {
      businessId,
      status: { not: "CANCELLED" },
      startsAt: {
        gte: dayBounds(dates[0], timezone).start,
        lt: dayBounds(dates[dates.length - 1], timezone).end,
      },
    },
    select: { startsAt: true },
  });

  for (const { startsAt } of rows) {
    const date = localDateOf(startsAt, timezone);
    if (counts.has(date)) counts.set(date, counts.get(date)! + 1);
  }
  return counts;
}

/**
 * Transiciones de estado permitidas: desde qué estados se puede llegar a cada
 * uno. Un turno cancelado no se reactiva (su horario pudo haberse ocupado).
 */
const ALLOWED_FROM: Record<AppointmentStatus, AppointmentStatus[]> = {
  CONFIRMED: ["COMPLETED", "NO_SHOW"], // deshacer
  COMPLETED: ["CONFIRMED", "NO_SHOW"],
  NO_SHOW: ["CONFIRMED", "COMPLETED"],
  CANCELLED: ["CONFIRMED"],
};

/** Marcar como realizado o ausente sólo tiene sentido una vez que el turno empezó. */
const REQUIRES_STARTED: AppointmentStatus[] = ["COMPLETED", "NO_SHOW"];

export async function updateAppointmentStatus(
  businessId: string,
  appointmentId: string,
  status: AppointmentStatus,
  now: Date = new Date(),
): Promise<MutationResult> {
  if (!(status in ALLOWED_FROM)) return { ok: false, error: "Estado inválido." };

  const updated = await prisma.$transaction(async (tx) => {
    // Negocio, estado de origen y hora en el mismo UPDATE: sin carreras.
    const { count } = await tx.appointment.updateMany({
      where: {
        id: appointmentId,
        businessId,
        status: { in: ALLOWED_FROM[status] },
        ...(REQUIRES_STARTED.includes(status) && { startsAt: { lte: now } }),
      },
      data: { status },
    });
    // Si el negocio cancela, se le avisa al cliente.
    if (count === 1 && status === "CANCELLED") {
      await enqueueAppointmentEmails(tx, appointmentId, ["CANCELLED_BY_BUSINESS"], now);
    }
    return count === 1;
  });
  if (updated) return { ok: true };

  const exists = await prisma.appointment.count({ where: { id: appointmentId, businessId } });
  return {
    ok: false,
    error: exists ? "Ese cambio de estado no está permitido para este turno." : "No encontramos ese turno.",
  };
}
