// Emails del negocio (la outbox), para revisarlos desde el panel.

import "server-only";
import { prisma } from "@/lib/prisma";
import type { EmailKind } from "@/generated/prisma/client";

export const EMAIL_KIND_LABELS: Record<EmailKind, string> = {
  BOOKING_CONFIRMATION: "Confirmación al cliente",
  BOOKING_NOTICE: "Aviso de turno nuevo",
  CANCELLATION_CONFIRMATION: "Cancelación (al cliente)",
  CANCELLATION_NOTICE: "Aviso de cancelación",
  CANCELLED_BY_BUSINESS: "Cancelación del negocio",
  REMINDER: "Recordatorio",
};

/** Los emails que recibe el cliente (los demás van al negocio). */
export const CUSTOMER_EMAIL_KINDS: EmailKind[] = [
  "BOOKING_CONFIRMATION",
  "CANCELLATION_CONFIRMATION",
  "CANCELLED_BY_BUSINESS",
  "REMINDER",
];

export function listEmails(businessId: string, limit = 50) {
  return prisma.emailMessage.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      kind: true,
      to: true,
      subject: true,
      status: true,
      attempts: true,
      lastError: true,
      createdAt: true,
      sentAt: true,
    },
  });
}

/** Un email del negocio, con su contenido. `null` si no existe o es de otro negocio. */
export function findEmail(businessId: string, emailId: string) {
  return prisma.emailMessage.findFirst({
    where: { id: emailId, businessId },
    select: { id: true, kind: true, to: true, subject: true, html: true, status: true, createdAt: true },
  });
}

/** Emails que recibió el cliente por un turno, identificado por su enlace privado. */
export function findCustomerEmailsByToken(token: string) {
  return prisma.emailMessage.findMany({
    where: { appointment: { cancelToken: token }, kind: { in: CUSTOMER_EMAIL_KINDS } },
    orderBy: { createdAt: "asc" },
    select: { id: true, kind: true, to: true, subject: true, html: true, createdAt: true },
  });
}
