"use server";

import { refresh } from "next/cache";
import { formText, type FormState } from "@/lib/validation";
import { requireUser } from "@/server/dal";
import { updateAppointmentStatus } from "@/server/panel/agenda";

const STATUSES = ["CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELLED"] as const;

export async function changeAppointmentStatus(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  // Cada acción se autentica sola: es un endpoint público que cualquiera
  // puede llamar con un POST, no sólo desde la página.
  const user = await requireUser();

  const status = STATUSES.find((s) => s === formText(formData, "status"));
  if (!status) return { error: "Estado inválido." };

  const result = await updateAppointmentStatus(
    user.businessId,
    formText(formData, "appointmentId"),
    status,
  );
  if (!result.ok) return { error: result.error };

  refresh();
  return { ok: true };
}
