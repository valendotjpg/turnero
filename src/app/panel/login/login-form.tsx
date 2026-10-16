"use client";

import { useActionState } from "react";
import { Field } from "@/components/field";
import { button } from "@/components/styles";
import type { FormState } from "@/lib/validation";
import { login } from "./actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(login, {});

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error && (
        <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      )}
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="username"
        required
        defaultValue={state.values?.email}
      />
      <Field label="Contraseña" name="password" type="password" autoComplete="current-password" required />
      <button type="submit" disabled={pending} className={`${button.primary} w-full`}>
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
