// Agenda del día: turnos, bloqueos y acciones sobre cada turno.

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { button, card } from "@/components/styles";
import { weekdayOf } from "@/lib/availability";
import {
  addDays,
  dateRange,
  formatDateLong,
  formatDayMonth,
  formatTime,
  formatWeekdayShort,
  isCalendarDate,
  localDateOf,
} from "@/lib/dates";
import { requireUser } from "@/server/dal";
import { countAppointmentsByDay, getDayAgenda } from "@/server/panel/agenda";
import { AppointmentActions } from "./appointment-actions";

export const metadata: Metadata = { title: "Agenda" };

export default function AgendaPage({ searchParams }: PageProps<"/panel">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-border/60" />}>
      <Agenda searchParams={searchParams} />
    </Suspense>
  );
}

const STATUS = {
  CONFIRMED: { label: "Confirmado", className: "bg-accent-soft text-accent" },
  COMPLETED: { label: "Realizado", className: "bg-border text-foreground" },
  NO_SHOW: { label: "Ausente", className: "bg-danger-soft text-danger" },
  CANCELLED: { label: "Cancelado", className: "bg-border text-muted line-through" },
} as const;

async function Agenda({ searchParams }: { searchParams: PageProps<"/panel">["searchParams"] }) {
  const { fecha } = await searchParams;
  const user = await requireUser();
  await connection();
  const now = new Date();

  const { timezone } = user.business;
  const today = localDateOf(now, timezone);
  const date = typeof fecha === "string" && isCalendarDate(fecha) ? fecha : today;
  // Semana de lunes a domingo que contiene el día elegido.
  const week = dateRange(addDays(date, -((weekdayOf(date) + 6) % 7)), 7);

  const [{ appointments, timeOff }, counts] = await Promise.all([
    getDayAgenda(user.businessId, timezone, date),
    countAppointmentsByDay(user.businessId, timezone, week),
  ]);
  const active = appointments.filter((a) => a.status !== "CANCELLED");
  const dayHref = (d: string) => (d === today ? "/panel" : `/panel?fecha=${d}`);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{date === today ? "Hoy" : "Agenda"}</p>
          <h1 className="text-2xl font-semibold tracking-tight first-letter:uppercase">
            {formatDateLong(date)}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {active.length === 0
              ? "Sin turnos"
              : `${active.length} ${active.length === 1 ? "turno" : "turnos"}`}
          </p>
        </div>
        <nav aria-label="Cambiar de día" className="flex items-center gap-2">
          <Link href={dayHref(addDays(date, -1))} className={`${button.secondary} ${button.small}`} aria-label="Día anterior">
            ←
          </Link>
          {date !== today && (
            <Link href="/panel" className={`${button.secondary} ${button.small}`}>
              Hoy
            </Link>
          )}
          <Link href={dayHref(addDays(date, 1))} className={`${button.secondary} ${button.small}`} aria-label="Día siguiente">
            →
          </Link>
          {/* Sin JavaScript también funciona: es un formulario GET. */}
          <form action="/panel" className="flex items-center gap-2">
            <label htmlFor="ir-a-fecha" className="sr-only">
              Ir a una fecha
            </label>
            <input
              id="ir-a-fecha"
              type="date"
              name="fecha"
              defaultValue={date}
              className="rounded-xl border border-border bg-card px-2 py-1.5 text-sm"
            />
            <button type="submit" className={`${button.secondary} ${button.small}`}>
              Ir
            </button>
          </form>
        </nav>
      </header>

      <ul className="grid grid-cols-7 gap-1.5" aria-label="Semana">
        {week.map((d) => {
          const selected = d === date;
          const count = counts.get(d) ?? 0;
          return (
            <li key={d}>
              <Link
                href={dayHref(d)}
                aria-current={selected ? "date" : undefined}
                className={`flex flex-col items-center rounded-xl border py-2 text-center transition-colors ${
                  selected
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border bg-card hover:border-accent"
                }`}
              >
                <span className="text-xs uppercase">{formatWeekdayShort(d)}</span>
                <span className={`text-lg font-semibold leading-tight ${d === today && !selected ? "text-accent" : ""}`}>
                  {d.slice(8)}
                </span>
                <span className={`text-xs ${selected ? "" : "text-muted"}`}>
                  {count === 0 ? "—" : `${count} t.`}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {timeOff.map((t) => (
        <p key={t.id} className="rounded-xl border border-dashed border-border px-4 py-3 text-sm">
          <span className="font-medium">Agenda bloqueada</span>{" "}
          <span className="text-muted">
            {describeBlock(t.startsAt, t.endsAt, date, timezone)}
            {t.reason && ` · ${t.reason}`}
          </span>
        </p>
      ))}

      {appointments.length === 0 ? (
        <EmptyState>
          No hay turnos para este día.{" "}
          <Link href={`/reservar/${user.business.slug}`} target="_blank" className="font-medium text-accent hover:underline">
            Ver la página de reservas ↗
          </Link>
        </EmptyState>
      ) : (
        <ol className="space-y-3">
          {appointments.map((a) => {
            const status = STATUS[a.status];
            return (
              <li key={a.id} className={`${card} !p-4 sm:!p-5 ${a.status === "CANCELLED" ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
                  <div className="w-24 shrink-0 tabular-nums">
                    <p className="text-lg font-semibold">{formatTime(a.startsAt, timezone)}</p>
                    <p className="text-sm text-muted">a {formatTime(a.endsAt, timezone)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{a.customerName}</p>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-sm">{a.service.name}</p>
                    <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-muted">
                      <a href={`mailto:${a.customerEmail}`} className="hover:text-foreground hover:underline">
                        {a.customerEmail}
                      </a>
                      {a.customerPhone && (
                        <a href={`tel:${a.customerPhone.replace(/[^\d+]/g, "")}`} className="hover:text-foreground hover:underline">
                          {a.customerPhone}
                        </a>
                      )}
                    </p>
                    {a.notes && (
                      <p className="mt-2 rounded-lg bg-background px-3 py-2 text-sm">
                        <span className="text-muted">Nota: </span>
                        {a.notes}
                      </p>
                    )}
                  </div>
                  <AppointmentActions
                    appointmentId={a.id}
                    status={a.status}
                    started={a.startsAt <= now}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** Describe un bloqueo desde el punto de vista del día que se está mirando. */
function describeBlock(startsAt: Date, endsAt: Date, date: string, timezone: string) {
  const startDate = localDateOf(startsAt, timezone);
  const endDate = localDateOf(new Date(endsAt.getTime() - 1), timezone);
  const from = startDate === date ? formatTime(startsAt, timezone) : null;
  const to = endDate === date ? formatTime(endsAt, timezone) : null;

  if (from && to && !(from === "00:00" && to === "00:00")) return `de ${from} a ${to}`;
  if (from && from !== "00:00") return `desde las ${from}`;
  if (to && to !== "00:00") return `hasta las ${to}`;
  if (startDate !== endDate) return `todo el día (del ${formatDayMonth(startDate)} al ${formatDayMonth(endDate)})`;
  return "todo el día";
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-muted">
      {children}
    </p>
  );
}
