"use server";

import { refresh } from "next/cache";
import { formText, type FormState } from "@/lib/validation";
import { requireUser } from "@/server/dal";
import { saveDaySchedule } from "@/server/panel/schedule";

export async function saveDay(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const starts = formData.getAll("start").map(String);
  const ends = formData.getAll("end").map(String);
  if (starts.length !== ends.length) return { error: "Faltan horas en alguna franja." };

  const result = await saveDaySchedule(
    user.businessId,
    Number(formText(formData, "weekday")),
    starts.map((start, i) => ({ start, end: ends[i] })),
  );
  if (!result.ok) return { error: result.error };

  refresh();
  return { ok: true };
}
