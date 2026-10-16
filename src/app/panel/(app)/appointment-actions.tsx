"use client";

import { useActionState } from "react";
import { button } from "@/components/styles";
import type { FormState } from "@/lib/validation";
import { changeAppointmentStatus } from "./actions";

type Status = "CONFIRMED" | "COMPLETED" | "NO_SHOW" | "CANCELLED";

/** Botones de cambio de estado de un turno, según su estado actual. */
export function AppointmentActions({
  appointmentId,
  status,
  started,
}: {
  appointmentId: string;
  status: Status;
  started: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(changeAppointmentStatus, {});

  const options: { status: Status; label: string; style: string; confirm?: string }[] = [];
  if (status === "CONFIRMED" && started) {
    options.push({ status: "COMPLETED", label: "Realizado", style: button.primary });
    options.push({ status: "NO_SHOW", label: "Ausente", style: button.secondary });
  }
  if (status === "CONFIRMED") {
    options.push({
      status: "CANCELLED",
      label: "Cancelar",
      style: button.secondary,
      confirm: "¿Cancelar este turno? Le vamos a avisar al cliente por email y el horario vuelve a quedar libre.",
    });
  }
  if (status === "COMPLETED" || status === "NO_SHOW") {
    options.push({ status: "CONFIRMED", label: "Deshacer", style: button.secondary });
  }
  if (options.length === 0) return null;

  return (
    <form action={formAction} className="flex shrink-0 flex-col gap-2 sm:items-end">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.status}
            type="submit"
            name="status"
            value={o.status}
            disabled={pending}
            className={`${o.style} ${button.small}`}
            onClick={(event) => {
              if (o.confirm && !window.confirm(o.confirm)) event.preventDefault();
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
