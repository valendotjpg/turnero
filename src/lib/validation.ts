// Helpers de validación compartidos por los formularios.

import { z } from "zod";

/** Convierte "" (campo opcional vacío de un formulario) en `undefined`. */
export const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), schema.optional());

/** Errores de validación por campo: el primer mensaje de cada uno. */
export type FieldErrors<Field extends string> = Partial<Record<Field, string>>;

export function fieldErrorsOf<Field extends string>(error: z.ZodError): FieldErrors<Field> {
  const errors: FieldErrors<Field> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as Field | undefined;
    if (field !== undefined) errors[field] ??= issue.message;
  }
  return errors;
}

/** Resultado de una operación de escritura desde un formulario. */
export type MutationResult<Field extends string = string> =
  | { ok: true }
  | { ok: false; error?: string; fieldErrors?: FieldErrors<Field> };

/** Estado que devuelven las Server Actions de formularios con useActionState. */
export interface FormState {
  ok?: boolean;
  /** Mensaje de éxito. */
  message?: string;
  /** Error general, que no corresponde a un campo. */
  error?: string;
  fieldErrors?: Record<string, string | undefined>;
  /** Lo que escribió el usuario, para no perderlo si hay que corregir algo. */
  values?: Record<string, string>;
}

/** Lee un campo de texto de un FormData ("" si falta o no es texto). */
export function formText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
