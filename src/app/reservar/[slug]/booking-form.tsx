"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field } from "@/components/field";
import { button } from "@/components/styles";
import { submitBooking, type BookingFormState } from "./actions";

interface BookingFormProps {
  businessSlug: string;
  serviceId: string;
  startsAt: string;
  /** Enlace para volver a elegir horario si el elegido se ocupó. */
  backHref: string;
}

export function BookingForm({ businessSlug, serviceId, startsAt, backHref }: BookingFormProps) {
  const [state, formAction, pending] = useActionState<BookingFormState, FormData>(
    submitBooking,
    {},
  );
  // React resetea el formulario después de cada acción; los campos vuelven a
  // su defaultValue, que es lo que el servidor devolvió en `values`.
  const { values = {}, fieldErrors = {} } = state;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="businessSlug" value={businessSlug} />
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="startsAt" value={startsAt} />

      {state.error && (
        <div role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {state.error}{" "}
          <Link href={backHref} className="font-medium underline underline-offset-2">
            Ver horarios disponibles
          </Link>
        </div>
      )}

      <Field
        label="Nombre y apellido"
        name="customerName"
        autoComplete="name"
        required
        defaultValue={values.customerName}
        error={fieldErrors.customerName}
      />
      <Field
        label="Email"
        name="customerEmail"
        type="email"
        autoComplete="email"
        required
        defaultValue={values.customerEmail}
        error={fieldErrors.customerEmail}
        hint="Te sirve para identificar tu turno."
      />
      <Field
        label="Teléfono"
        name="customerPhone"
        type="tel"
        autoComplete="tel"
        defaultValue={values.customerPhone}
        error={fieldErrors.customerPhone}
        optional
      />
      <Field
        label="Notas para el negocio"
        name="notes"
        multiline
        defaultValue={values.notes}
        error={fieldErrors.notes}
        optional
      />

      <button
        type="submit"
        disabled={pending}
        className={`${button.primary} w-full py-3`}
      >
        {pending ? "Reservando…" : "Confirmar turno ▸"}
      </button>
    </form>
  );
}
