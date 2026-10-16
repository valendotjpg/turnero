"use client";

import { useActionState } from "react";
import { Field } from "@/components/field";
import { button } from "@/components/styles";
import type { FormState } from "@/lib/validation";
import { addTimeOff } from "./actions";

export function TimeOffForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addTimeOff, {});
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <Field label="Desde" name="startDate" type="date" defaultValue={values.startDate} error={errors.startDate} />
        <Field label="Hora" name="startTime" type="time" step={300} defaultValue={values.startTime} error={errors.startTime} optional />
        <Field label="Hasta" name="endDate" type="date" defaultValue={values.endDate} error={errors.endDate} />
        <Field label="Hora" name="endTime" type="time" step={300} defaultValue={values.endTime} error={errors.endTime} optional />
      </div>
      <p className="-mt-1 text-sm text-muted">Sin horas, se bloquean los días completos.</p>
      <Field
        label="Motivo"
        name="reason"
        defaultValue={values.reason}
        error={errors.reason}
        placeholder="Feriado, vacaciones…"
        optional
      />

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="rounded-xl bg-accent-soft px-3 py-2 text-sm">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className={`${button.primary} w-full`}>
        {pending ? "Guardando…" : "Bloquear agenda"}
      </button>
    </form>
  );
}
