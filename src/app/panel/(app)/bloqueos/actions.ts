"use server";

import { refresh } from "next/cache";
import { formText, type FormState } from "@/lib/validation";
import { requireUser } from "@/server/dal";
import { createTimeOff, deleteTimeOff } from "@/server/panel/time-off";

const FIELDS = ["startDate", "endDate", "startTime", "endTime", "reason"] as const;

export async function addTimeOff(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const values = Object.fromEntries(FIELDS.map((f) => [f, formText(formData, f)]));

  const result = await createTimeOff(user.businessId, user.business.timezone, values);
  if (!result.ok) return { error: result.error, fieldErrors: result.fieldErrors, values };

  refresh();
  const n = result.overlappingAppointments;
  return {
    ok: true,
    message:
      n === 0
        ? "Listo, la agenda quedó bloqueada."
        : `Listo. Ojo: ya había ${n} ${n === 1 ? "turno confirmado" : "turnos confirmados"} en ese período. Revisalos en la agenda para avisarles o cancelarlos.`,
  };
}

export async function removeTimeOff(formData: FormData) {
  const user = await requireUser();
  await deleteTimeOff(user.businessId, formText(formData, "timeOffId"));
  refresh();
}
