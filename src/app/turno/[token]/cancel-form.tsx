"use client";

import { useActionState, useState } from "react";
import { submitCancellation, type CancelFormState } from "./actions";

/** Cancelación en dos pasos, para evitar cancelar por un toque accidental. */
export function CancelForm({ token }: { token: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<CancelFormState, FormData>(
    submitCancellation,
    {},
  );

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm font-medium text-danger underline-offset-4 hover:underline"
      >
        Cancelar turno
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <p className="text-sm">¿Seguro que querés cancelar el turno? El horario queda libre para otra persona.</p>
      {state.error && (
        <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-danger px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Cancelando…" : "Sí, cancelar"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-background"
        >
          No, mantener
        </button>
      </div>
    </form>
  );
}
