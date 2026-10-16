"use server";

import { refresh } from "next/cache";
import { cancelAppointment } from "@/server/booking";

export interface CancelFormState {
  error?: string;
}

export async function submitCancellation(
  _previous: CancelFormState,
  formData: FormData,
): Promise<CancelFormState> {
  const token = formData.get("token");
  const result = await cancelAppointment(typeof token === "string" ? token : "");

  if (!result.ok) {
    return {
      error:
        result.reason === "NOT_FOUND"
          ? "No encontramos este turno."
          : "Este turno ya no se puede cancelar.",
    };
  }

  // Vuelve a renderizar la página para mostrar el turno como cancelado.
  refresh();
  return {};
}
