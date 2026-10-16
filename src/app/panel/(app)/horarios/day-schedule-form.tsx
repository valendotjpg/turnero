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

export function DayScheduleForm({
  weekday,
  label,
  ranges: initialRanges,
}: {
  weekday: number;
  label: string;
  ranges: { start: string; end: string }[];
}) {
  const [ranges, setRanges] = useState<Range[]>(() =>
    initialRanges.map((r) => ({ key: nextKey++, start: toInput(r.start), end: toInput(r.end) })),
  );
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveDay, {});
  const [dirty, setDirty] = useState(false);

  const update = (next: Range[]) => {
    setRanges(next);
    setDirty(true);
  };
  const addRange = () => {
    // Una franja nueva arranca donde termina la última, o a las 09:00.
    const last = ranges.at(-1);
    const start = last ? last.end : "09:00";
    update([...ranges, { key: nextKey++, start, end: last ? "20:00" : "13:00" }]);
  };

  return (
    <form
      action={(formData) => {
        setDirty(false);
        formAction(formData);
      }}
      className={`${card} !p-4 sm:!p-5`}
    >
      <input type="hidden" name="weekday" value={weekday} />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <h2 className="w-24 font-semibold">{label}</h2>

        <div className="flex flex-1 flex-wrap items-center gap-2">
          {ranges.length === 0 && <span className="text-muted">Cerrado</span>}
          {ranges.map((range, i) => (
            <fieldset key={range.key} className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-2 py-1">
              <legend className="sr-only">Franja {i + 1}</legend>
              <input
                type="time"
                name="start"
                step={300}
                required
                aria-label={`Apertura, franja ${i + 1}`}
                value={range.start}
                onChange={(e) => update(ranges.map((r) => (r.key === range.key ? { ...r, start: e.target.value } : r)))}
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
                onChange={(e) => update(ranges.map((r) => (r.key === range.key ? { ...r, end: e.target.value } : r)))}
                className="bg-transparent tabular-nums outline-none"
              />
              <button
                type="button"
                onClick={() => update(ranges.filter((r) => r.key !== range.key))}
                className="ml-1 rounded-md px-1.5 text-muted hover:bg-danger-soft hover:text-danger"
                aria-label={`Quitar franja ${i + 1}`}
              >
                ×
              </button>
            </fieldset>
          ))}
          {ranges.length < MAX_RANGES && (
            <button type="button" onClick={addRange} className="rounded-xl px-2 py-1 text-sm font-medium text-accent hover:bg-accent-soft">
              + Franja
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {!dirty && state.ok && (
            <span role="status" className="text-sm text-accent">
              Guardado
            </span>
          )}
          <button type="submit" disabled={pending || !dirty} className={`${button.primary} ${button.small}`}>
            {pending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
      {state.error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
