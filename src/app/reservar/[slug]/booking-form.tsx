"use client";

import Link from "next/link";
import { useActionState, type ComponentProps } from "react";
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
        className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Reservando…" : "Confirmar turno"}
      </button>
    </form>
  );
}

type FieldProps = {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  multiline?: boolean;
} & Pick<ComponentProps<"input">, "type" | "autoComplete" | "required" | "defaultValue">;

function Field({ label, name, error, hint, optional, multiline, ...inputProps }: FieldProps) {
  const id = `field-${name}`;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const className = `w-full rounded-xl border bg-background px-3 py-2.5 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30 ${
    error ? "border-danger" : "border-border"
  }`;
  const shared = {
    id,
    name,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    className,
  };

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label} {optional && <span className="font-normal text-muted">(opcional)</span>}
      </label>
      {multiline ? (
        <textarea {...shared} rows={3} defaultValue={inputProps.defaultValue} />
      ) : (
        <input {...shared} {...inputProps} />
      )}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1.5 text-sm text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
