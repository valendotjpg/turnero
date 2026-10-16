import type { ComponentProps } from "react";
import { inputClass } from "./styles";

type FieldProps = {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  multiline?: boolean;
  className?: string;
} & Pick<
  ComponentProps<"input">,
  "type" | "autoComplete" | "required" | "defaultValue" | "min" | "max" | "step" | "inputMode" | "placeholder"
>;

/** Campo de formulario con etiqueta, ayuda y error accesibles. */
export function Field({
  label,
  name,
  error,
  hint,
  optional,
  multiline,
  className = "",
  ...inputProps
}: FieldProps) {
  const id = `field-${name}`;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const shared = {
    id,
    name,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    className: inputClass(Boolean(error)),
  };

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label} {optional && <span className="font-normal text-muted">(opcional)</span>}
      </label>
      {multiline ? (
        <textarea {...shared} rows={3} defaultValue={inputProps.defaultValue} />
      ) : (
        <input {...shared} {...inputProps} />
      )}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1.5 text-sm text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
