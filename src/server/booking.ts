// Reserva y cancelación de turnos desde la página pública.
//
// La disponibilidad se vuelve a calcular en el servidor al reservar: lo que
// manda el formulario es sólo una elección del cliente, no una garantía de
// que el horario siga libre ni de que alguna vez lo haya estado. Aun así, dos
// reservas simultáneas del mismo horario pueden pasar ambas esa verificación;
// la que llega segunda la frena la restricción EXCLUDE de la base.

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { localDateOf } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { computeSlots, findSlotContext } from "./availability";

/** Convierte "" (campo opcional vacío del formulario) en `undefined`. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), schema.optional());

export const bookingInputSchema = z.object({
  serviceId: z.string().min(1),
  startsAt: z.iso.datetime({ offset: true }).transform((s) => new Date(s)),
  customerName: z
    .string()
    .trim()
    .min(2, "Ingresá tu nombre.")
    .max(100, "El nombre es demasiado largo."),
  customerEmail: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Ingresá un email válido.").max(254, "El email es demasiado largo.")),
  customerPhone: optional(
    z
      .string()
      .trim()
      .regex(/^\+?[\d\s()-]{6,30}$/, "Ingresá un teléfono válido."),
  ),
  notes: optional(z.string().trim().max(500, "Las notas no pueden superar los 500 caracteres.")),
});

export type BookingInput = z.infer<typeof bookingInputSchema>;
export type BookingField = keyof BookingInput;

export type BookingResult =
  | { ok: true; cancelToken: string }
  | { ok: false; reason: "INVALID_INPUT"; fieldErrors: Partial<Record<BookingField, string>> }
  | { ok: false; reason: "NOT_FOUND" | "SLOT_UNAVAILABLE" };

/** Token de 32 caracteres URL-safe con 192 bits de entropía. */
export function generateCancelToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * ¿El error es la violación de la restricción que impide turnos superpuestos?
 * Prisma no tiene un código propio para las restricciones EXCLUDE: el error
 * original de PostgreSQL llega dentro de `meta.driverAdapterError.cause`.
 */
export function isExclusionViolation(error: unknown): boolean {
  const cause = (
    error as { meta?: { driverAdapterError?: { cause?: { code?: unknown; message?: unknown } } } }
  )?.meta?.driverAdapterError?.cause;

  return (
    cause?.code === "23P01" && // SQLSTATE exclusion_violation
    typeof cause.message === "string" &&
    cause.message.includes('"Appointment_no_overlap"')
  );
}

export async function bookAppointment(
  businessSlug: string,
  rawInput: unknown,
  now: Date = new Date(),
): Promise<BookingResult> {
  const parsed = bookingInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<BookingField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as BookingField;
      fieldErrors[field] ??= issue.message;
    }
    return { ok: false, reason: "INVALID_INPUT", fieldErrors };
  }
  const input = parsed.data;

  const context = await findSlotContext(businessSlug, input.serviceId);
  if (!context) return { ok: false, reason: "NOT_FOUND" };

  const date = localDateOf(input.startsAt, context.timezone);
  const slots = await computeSlots(context, date, now);
  const slot = slots.find((s) => s.start.getTime() === input.startsAt.getTime());
  if (!slot) return { ok: false, reason: "SLOT_UNAVAILABLE" };

  const cancelToken = generateCancelToken();
  try {
    await prisma.appointment.create({
      data: {
        businessId: context.businessId,
        serviceId: input.serviceId,
        startsAt: slot.start,
        endsAt: slot.end,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        notes: input.notes,
        cancelToken,
      },
    });
  } catch (error) {
    if (isExclusionViolation(error)) return { ok: false, reason: "SLOT_UNAVAILABLE" };
    throw error;
  }

  return { ok: true, cancelToken };
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

/** Turno con los datos necesarios para mostrarlo al cliente. */
export async function findAppointmentByToken(token: string) {
  if (!TOKEN_PATTERN.test(token)) return null;

  return prisma.appointment.findUnique({
    where: { cancelToken: token },
    select: {
      startsAt: true,
      endsAt: true,
      status: true,
      customerName: true,
      customerEmail: true,
      service: { select: { name: true, priceCents: true, durationMinutes: true } },
      business: {
        select: { name: true, slug: true, timezone: true, address: true, phone: true },
      },
    },
  });
}

export type CancelResult = { ok: true } | { ok: false; reason: "NOT_FOUND" | "NOT_CANCELLABLE" };

/**
 * Cancela un turno confirmado que todavía no empezó. La condición va en el
 * mismo UPDATE para que dos cancelaciones simultáneas no compitan.
 */
export async function cancelAppointment(token: string, now: Date = new Date()): Promise<CancelResult> {
  if (!TOKEN_PATTERN.test(token)) return { ok: false, reason: "NOT_FOUND" };

  const { count } = await prisma.appointment.updateMany({
    where: { cancelToken: token, status: "CONFIRMED", startsAt: { gt: now } },
    data: { status: "CANCELLED" },
  });
  if (count === 1) return { ok: true };

  const exists = await prisma.appointment.findUnique({
    where: { cancelToken: token },
    select: { id: true },
  });
  return { ok: false, reason: exists ? "NOT_CANCELLABLE" : "NOT_FOUND" };
}
