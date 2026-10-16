"use server";

import { redirect } from "next/navigation";
import { formText, type FormState } from "@/lib/validation";
import { authenticate } from "@/server/auth";
import { startSession } from "@/server/dal";

export async function login(_previous: FormState, formData: FormData): Promise<FormState> {
  const email = formText(formData, "email");
  const password = formText(formData, "password");
  // La contraseña nunca se devuelve al cliente.
  const values = { email };

  if (!email.trim() || !password) {
    return { error: "Completá tu email y tu contraseña.", values };
  }

  const userId = await authenticate(email, password);
  // Mismo mensaje para email inexistente y contraseña incorrecta: no se
  // revela qué cuentas existen.
  if (!userId) return { error: "El email o la contraseña no son correctos.", values };

  await startSession(userId);
  redirect("/panel");
}
