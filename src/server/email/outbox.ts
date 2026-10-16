// Outbox de emails: encolar dentro de una transacción, enviar después.
//
// Garantías:
//   - Un email se encola en la misma transacción que el hecho que lo origina:
//     si la reserva se revierte, el email no existe; si se confirma, el email
//     queda guardado aunque el servidor de correo esté caído.
//   - Cada email lo envía un solo worker: se "reserva" con un UPDATE
//     condicionado al estado, que sólo puede ganar uno.
//   - Los errores se reintentan con espera exponencial, hasta MAX_ATTEMPTS.
//   - Si un worker muere a mitad de un envío, el email vuelve a la cola
//     cuando su reserva vence (STALE_LOCK_MS).

import "server-only";
import { googleCalendarUrl } from "@/lib/calendar";
import { localDateOf } from "@/lib/dates";
import * as templates from "@/lib/email-templates";
import { describeError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { EmailKind, Prisma } from "@/generated/prisma/client";
import { appUrl, getMailer, type Mailer } from "./mailer";

type Tx = Prisma.TransactionClient;

export const MAX_ATTEMPTS = 5;
const STALE_LOCK_MS = 10 * 60_000;
const HOUR_MS = 3_600_000;

/** Espera antes del reintento n (1, 2, 3…): 1, 2, 4, 8 minutos… */
export function retryDelayMs(attempt: number): number {
  return 60_000 * 2 ** (attempt - 1);
}

/** Destinatario y plantilla de cada tipo de email. */
const KINDS: Record<
  EmailKind,
  { to: "customer" | "business"; render: (d: templates.AppointmentEmailData) => templates.RenderedEmail }
> = {
  BOOKING_CONFIRMATION: { to: "customer", render: templates.bookingConfirmation },
  BOOKING_NOTICE: { to: "business", render: templates.bookingNotice },
  CANCELLATION_CONFIRMATION: { to: "customer", render: templates.cancellationConfirmation },
  CANCELLATION_NOTICE: { to: "business", render: templates.cancellationNotice },
  CANCELLED_BY_BUSINESS: { to: "customer", render: templates.cancelledByBusiness },
  REMINDER: { to: "customer", render: templates.reminder },
};

async function loadEmailData(tx: Tx, appointmentId: string) {
  const a = await tx.appointment.findUniqueOrThrow({
    where: { id: appointmentId },
    select: {
      startsAt: true,
      endsAt: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      notes: true,
      cancelToken: true,
      service: { select: { name: true, priceCents: true } },
      business: {
        select: {
          id: true,
          name: true,
          slug: true,
          address: true,
          phone: true,
          timezone: true,
          users: { select: { email: true } },
        },
      },
    },
  });
  const { business, service } = a;

  const data: templates.AppointmentEmailData = {
    businessName: business.name,
    businessAddress: business.address,
    businessPhone: business.phone,
    timezone: business.timezone,
    serviceName: service.name,
    priceCents: service.priceCents,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    customerName: a.customerName,
    customerEmail: a.customerEmail,
    customerPhone: a.customerPhone,
    notes: a.notes,
    manageUrl: appUrl(`/turno/${a.cancelToken}`),
    icsUrl: appUrl(`/turno/${a.cancelToken}/calendario.ics`),
    googleCalendarUrl: googleCalendarUrl({
      uid: appointmentId,
      title: `${service.name} en ${business.name}`,
      start: a.startsAt,
      end: a.endsAt,
      location: business.address,
    }),
    panelUrl: appUrl(`/panel?fecha=${localDateOf(a.startsAt, business.timezone)}`),
    bookingUrl: appUrl(`/reservar/${business.slug}`),
  };

  return {
    data,
    businessId: business.id,
    customerEmail: a.customerEmail,
    businessEmails: business.users.map((u) => u.email),
  };
}

/**
 * Encola los emails de un turno. Se llama dentro de la transacción que
 * produce el cambio (reserva, cancelación). `now` es la hora de la aplicación:
 * el worker compara contra ese mismo reloj, nunca contra el de la base.
 */
export async function enqueueAppointmentEmails(
  tx: Tx,
  appointmentId: string,
  kinds: EmailKind[],
  now: Date,
) {
  const { data, businessId, customerEmail, businessEmails } = await loadEmailData(tx, appointmentId);

  const rows = kinds.flatMap((kind) => {
    const { to, render } = KINDS[kind];
    const content = render(data);
    const recipients = to === "customer" ? [customerEmail] : businessEmails;
    return recipients.map((recipient) => ({
      businessId,
      appointmentId,
      kind,
      to: recipient,
      ...content,
      nextAttemptAt: now,
    }));
  });
  if (rows.length > 0) await tx.emailMessage.createMany({ data: rows });
}

export interface DeliveryReport {
  sent: number;
  failed: number;
  retrying: number;
}

/** Envía los emails pendientes cuyo momento de envío ya llegó. */
export async function processOutbox({
  mailer = getMailer(),
  now = new Date(),
  limit = 50,
}: { mailer?: Mailer; now?: Date; limit?: number } = {}): Promise<DeliveryReport> {
  const report: DeliveryReport = { sent: 0, failed: 0, retrying: 0 };

  // Recupera los que quedaron "enviándose" porque un worker se cayó.
  await prisma.emailMessage.updateMany({
    where: { status: "SENDING", lockedAt: { lt: new Date(now.getTime() - STALE_LOCK_MS) } },
    data: { status: "PENDING", lockedAt: null },
  });

  const candidates = await prisma.emailMessage.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: now } },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
    select: { id: true },
  });

  for (const { id } of candidates) {
    // Reserva atómica: si otro worker ya lo tomó, count es 0 y se saltea.
    const { count } = await prisma.emailMessage.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "SENDING", lockedAt: now, attempts: { increment: 1 } },
    });
    if (count === 0) continue;

    const email = await prisma.emailMessage.findUniqueOrThrow({
      where: { id },
      select: { to: true, subject: true, html: true, text: true, attempts: true },
    });

    try {
      await mailer.send(email);
      await prisma.emailMessage.update({
        where: { id },
        data: { status: "SENT", sentAt: new Date(), lockedAt: null, lastError: null },
      });
      report.sent++;
    } catch (error) {
      const giveUp = email.attempts >= MAX_ATTEMPTS;
      await prisma.emailMessage.update({
        where: { id },
        data: {
          status: giveUp ? "FAILED" : "PENDING",
          lockedAt: null,
          lastError: describeError(error).slice(0, 500),
          nextAttemptAt: new Date(now.getTime() + retryDelayMs(email.attempts)),
        },
      });
      if (giveUp) report.failed++;
      else report.retrying++;
    }
  }
  return report;
}

/** Recordatorio 24 horas antes del turno. */
export const REMINDER_LEAD_MS = 24 * HOUR_MS;

/**
 * Encola los recordatorios de los turnos confirmados que empiezan dentro de
 * las próximas 24 horas. Sólo para turnos reservados con más de 24 horas de
 * anticipación: quien reservó para mañana acaba de recibir la confirmación.
 * Es idempotente: cada turno se marca y no se vuelve a encolar.
 */
export async function enqueueReminders(now: Date = new Date()): Promise<number> {
  const horizon = new Date(now.getTime() + REMINDER_LEAD_MS);
  const due = await prisma.appointment.findMany({
    where: {
      status: "CONFIRMED",
      reminderQueuedAt: null,
      startsAt: { gt: now, lte: horizon },
    },
    select: { id: true, startsAt: true, createdAt: true },
  });

  let queued = 0;
  for (const appointment of due) {
    const bookedEarly = appointment.startsAt.getTime() - appointment.createdAt.getTime() > REMINDER_LEAD_MS;

    await prisma.$transaction(async (tx) => {
      // Marca y encola juntos; el filtro en el UPDATE evita duplicados si dos
      // procesos corren a la vez.
      const { count } = await tx.appointment.updateMany({
        where: { id: appointment.id, reminderQueuedAt: null },
        data: { reminderQueuedAt: now },
      });
      if (count === 1 && bookedEarly) {
        await enqueueAppointmentEmails(tx, appointment.id, ["REMINDER"], now);
        queued++;
      }
    });
  }
  return queued;
}

/**
 * Para llamar con after(): intenta enviar lo pendiente apenas termina la
 * respuesta. Si falla, el cron lo reintenta; nunca rompe el request.
 */
export async function deliverPendingEmails() {
  try {
    await processOutbox();
  } catch (error) {
    console.error("[email] Error al procesar la outbox:", error);
  }
}
