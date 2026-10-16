"use client";

import { useActionState, useState } from "react";
import { button, card } from "@/components/styles";
import type { FormState } from "@/lib/validation";
import { saveDay } from "./actions";

interface Range {
  /** Identificador local, sólo para las keys de React. */
  key: number;
  start: string;
  end: string;
}

const MAX_RANGES = 4;
let nextKey = 0;

// Un <input type="time"> no acepta "24:00": la medianoche se muestra como 00:00.
const toInput = (time: string) => (time === "24:00" ? "00:00" : time);

/** Representación comparable de un conjunto de franjas, sin importar el orden. */
const signature = (ranges: { start: string; end: string }[]) =>
  ranges
    .map((r) => `${r.start}-${r.end}`)
    .sort()
    .join(",");

export function DayScheduleForm({
  weekday,
  label,
  ranges: savedRanges,
}: {
  weekday: number;
  label: string;
  /** Franjas guardadas. Se actualizan solas después de guardar (refresh). */
  ranges: { start: string; end: string }[];
}) {
  const saved = savedRanges.map((r) => ({ start: toInput(r.start), end: toInput(r.end) }));
  const fromSaved = () => saved.map((r) => ({ ...r, key: nextKey++ }));

  const [ranges, setRanges] = useState<Range[]>(fromSaved);
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveDay, {});
  // Hay cambios si lo que se ve difiere de lo guardado. Si guardar falla, sigue
  // habiendo cambios y el botón no desaparece.
  const dirty = signature(ranges) !== signature(saved);

  const setRange = (key: number, field: "start" | "end", value: string) =>
    setRanges(ranges.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  const addRange = () => {
    // Una franja nueva arranca donde termina la última, o a las 09:00.
    const last = ranges.at(-1);
    setRanges([...ranges, { key: nextKey++, start: last ? last.end : "09:00", end: last ? "20:00" : "13:00" }]);
  };

  return (
    <form action={formAction} className={`${card} !p-4 sm:!p-5`}>
      <input type="hidden" name="weekday" value={weekday} />
      {/* Celular: día y acciones arriba, franjas abajo. Pantallas anchas: una sola fila. */}
      <div className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 sm:grid-cols-[6rem_1fr_auto]">
        <h2 className="font-semibold">{label}</h2>

        <div className="col-span-2 flex flex-wrap items-center gap-2 sm:order-none sm:col-span-1 order-last">
          {ranges.length === 0 && <span className="text-muted">Cerrado</span>}
          {ranges.map((range, i) => (
            <fieldset
              key={range.key}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-2 py-1"
            >
              <legend className="sr-only">Franja {i + 1}</legend>
              <input
                type="time"
                name="start"
                step={300}
                required
                aria-label={`Apertura, franja ${i + 1}`}
                value={range.start}
                onChange={(e) => setRange(range.key, "start", e.target.value)}
                className="bg-transparent tabular-nums outline-none"
              />
              <span className="text-muted">a</span>
              <input
                type="time"
                name="end"
                step={300}
                required
                aria-label={`Cierre, franja ${i + 1}`}
                value={range.end}
                onChange={(e) => setRange(range.key, "end", e.target.value)}
                className="bg-transparent tabular-nums outline-none"
              />
              <button
                type="button"
                onClick={() => setRanges(ranges.filter((r) => r.key !== range.key))}
                className="ml-1 rounded-md px-1.5 text-muted hover:bg-danger-soft hover:text-danger"
                aria-label={`Quitar franja ${i + 1}`}
              >
                ×
              </button>
            </fieldset>
          ))}
          {ranges.length < MAX_RANGES && (
            <button
              type="button"
              onClick={addRange}
              className="rounded-xl px-2 py-1 text-sm font-medium text-accent hover:bg-accent-soft"
            >
              + Franja
            </button>
          )}
        </div>

        {/* Altura fija: que la fila no salte cuando aparecen o desaparecen los botones. */}
        <div className="flex h-8 items-center justify-end gap-2">
          {dirty ? (
            <>
              <button
                type="button"
                onClick={() => setRanges(fromSaved())}
                disabled={pending}
                className="rounded-xl px-2 py-1 text-sm font-medium text-muted hover:text-foreground"
              >
                Descartar
              </button>
              <button type="submit" disabled={pending} className={`${button.primary} ${button.small}`}>
                {pending ? "Guardando…" : "Guardar"}
              </button>
            </>
          ) : (
            state.ok && (
              <span role="status" className="text-sm text-accent">
                Guardado ✓
              </span>
            )
          )}
        </div>
      </div>
      {dirty && state.error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
