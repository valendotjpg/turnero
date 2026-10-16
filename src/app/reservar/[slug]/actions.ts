"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { bookAppointment, type BookingField } from "@/server/booking";
import { deliverPendingEmails } from "@/server/email/outbox";
import { consumeRateLimit, formatRetryAfter, RULES } from "@/server/rate-limit";
import { clientIp } from "@/server/request";

const CUSTOMER_FIELDS = ["customerName", "customerEmail", "customerPhone", "notes"] as const;
type CustomerField = (typeof CUSTOMER_FIELDS)[number];

export interface BookingFormState {
  /** Lo que escribió el cliente, para no perderlo si hay que corregir algo. */
  values?: Partial<Record<CustomerField, string>>;
  fieldErrors?: Partial<Record<BookingField, string>>;
  error?: string;
}

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
};

export async function submitBooking(
  _previous: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const values = Object.fromEntries(CUSTOMER_FIELDS.map((f) => [f, text(formData, f)]));

  const limit = await consumeRateLimit(`booking:${await clientIp()}`, RULES.booking);
  if (!limit.allowed) {
    return {
      values,
      error: `Hiciste demasiadas reservas seguidas. Probá de nuevo en ${formatRetryAfter(limit.retryAfterMs)}.`,
    };
  }

  const result = await bookAppointment(text(formData, "businessSlug"), {
    serviceId: text(formData, "serviceId"),
    startsAt: text(formData, "startsAt"),
    ...values,
  });

  if (result.ok) {
    // Los emails ya quedaron en la outbox; se envían después de responder,
    // así el cliente no espera al servidor de correo.
    after(deliverPendingEmails);
    redirect(`/turno/${result.cancelToken}?reservado=1`);
  }

  switch (result.reason) {
    case "INVALID_INPUT":
      return { values, fieldErrors: result.fieldErrors };
    case "SLOT_UNAVAILABLE":
      return { values, error: "Alguien acaba de reservar ese horario. Elegí otro, por favor." };
    case "NOT_FOUND":
      return { values, error: "Ese servicio ya no está disponible." };
  }
}
