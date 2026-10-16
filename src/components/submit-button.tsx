"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

/**
 * Botón de envío que se deshabilita mientras su formulario se procesa. Sirve
 * para formularios simples de Server Components, sin useActionState.
 */
export function SubmitButton({
  children,
  pendingLabel,
  className,
  name,
  value,
  confirm,
}: {
  children: ReactNode;
  pendingLabel?: string;
  className: string;
  name?: string;
  value?: string;
  /** Pide confirmación antes de enviar. */
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={className}
      onClick={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
