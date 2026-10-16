"use client";

import { useActionState } from "react";
import { Field } from "@/components/field";
import { button } from "@/components/styles";
import type { FormState } from "@/lib/validation";
import { saveService } from "./actions";

interface ServiceFormProps {
  /** Sin servicio, el formulario crea uno nuevo. */
  service?: {
    id: string;
    name: string;
    description: string | null;
    durationMinutes: number;
    priceCents: number;
  };
}

export function ServiceForm({ service }: ServiceFormProps) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveService, {});
  const errors = state.fieldErrors ?? {};
  // Si el servidor devolvió lo escrito (por un error), eso manda sobre los datos guardados.
  const values = state.values ?? {
    name: service?.name ?? "",
    description: service?.description ?? "",
    durationMinutes: service ? String(service.durationMinutes) : "",
    price: service ? String(service.priceCents / 100) : "",
  };
  // Los ids de los campos tienen que ser únicos en la página.
  const prefix = service ? `servicio-${service.id}-` : "nuevo-";

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {service && <input type="hidden" name="serviceId" value={service.id} />}
      <Field label="Nombre" name={`${prefix}name`} defaultValue={values.name} error={errors.name} />
      <Field
        label="Descripción"
        name={`${prefix}description`}
        defaultValue={values.description}
        error={errors.description}
        optional
      />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Duración (min)"
          name={`${prefix}durationMinutes`}
          type="number"
          inputMode="numeric"
          min={5}
          max={480}
          step={5}
          defaultValue={values.durationMinutes}
          error={errors.durationMinutes}
        />
        <Field
          label="Precio ($)"
          name={`${prefix}price`}
          type="number"
          inputMode="decimal"
          min={0}
          step={0.01}
          defaultValue={values.price}
          error={errors.price}
        />
      </div>
      <input type="hidden" name="prefix" value={prefix} />

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="text-sm text-accent">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${button.primary} w-full`}>
        {pending ? "Guardando…" : service ? "Guardar cambios" : "Agregar servicio"}
      </button>
    </form>
  );
}
