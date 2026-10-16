"use server";

import { refresh } from "next/cache";
import { formText, type FormState } from "@/lib/validation";
import { requireUser } from "@/server/dal";
import { createService, setServiceActive, updateService } from "@/server/panel/services";

const FIELDS = ["name", "description", "durationMinutes", "price"] as const;

export async function saveService(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  // Los campos llevan un prefijo para que sus ids no choquen entre formularios.
  const prefix = formText(formData, "prefix");
  const values = Object.fromEntries(FIELDS.map((f) => [f, formText(formData, `${prefix}${f}`)]));
  const serviceId = formText(formData, "serviceId");

  const result = serviceId
    ? await updateService(user.businessId, serviceId, values)
    : await createService(user.businessId, values);
  if (!result.ok) return { error: result.error, fieldErrors: result.fieldErrors, values };

  refresh();
  return { ok: true, message: serviceId ? "Cambios guardados." : "Servicio agregado." };
}

export async function toggleService(formData: FormData) {
  const user = await requireUser();
  await setServiceActive(user.businessId, formText(formData, "serviceId"), formText(formData, "active") === "true");
  refresh();
}
