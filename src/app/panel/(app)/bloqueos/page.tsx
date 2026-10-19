import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { button, card } from "@/components/styles";
import { SubmitButton } from "@/components/submit-button";
import { formatDayMonth, formatTime, formatWeekdayShort, localDateOf } from "@/lib/dates";
import { requireUser } from "@/server/dal";
import { listUpcomingTimeOff } from "@/server/panel/time-off";
import { removeTimeOff } from "./actions";
import { TimeOffForm } from "./time-off-form";

export const metadata: Metadata = { title: "Bloqueos" };

export default function TimeOffPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="display-type text-5xl text-accent sm:text-6xl">Bloqueos de agenda</h1>
        <p className="mt-4 max-w-2xl text-muted">
          Feriados, vacaciones o un rato en el que no vas a atender. Mientras dure un bloqueo, nadie
          puede reservar en ese período.
        </p>
      </header>
      <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-card" />}>
        <TimeOffList />
      </Suspense>
    </div>
  );
}

async function TimeOffList() {
  const user = await requireUser();
  await connection();
  const blocks = await listUpcomingTimeOff(user.businessId, new Date());
  const { timezone } = user.business;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
      <section>
        <h2 className="mb-3 font-semibold">Próximos bloqueos</h2>
        {blocks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-6 py-10 text-center text-muted">
            No hay bloqueos programados.
          </p>
        ) : (
          <ul className="space-y-3">
            {blocks.map((b) => (
              <li key={b.id} className={`${card} !p-4 flex items-center justify-between gap-4`}>
                <div>
                  <p className="font-medium">{describeRange(b.startsAt, b.endsAt, timezone)}</p>
                  {b.reason && <p className="text-sm text-muted">{b.reason}</p>}
                </div>
                <form action={removeTimeOff}>
                  <input type="hidden" name="timeOffId" value={b.id} />
                  <SubmitButton
                    className={`${button.secondary} ${button.small}`}
                    confirm="¿Quitar este bloqueo? Ese período vuelve a estar disponible para reservas."
                  >
                    Quitar
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className="mb-4 font-semibold">Nuevo bloqueo</h2>
        <TimeOffForm />
      </section>
    </div>
  );
}

/** "lun 20 oct, todo el día", "lun 20 oct – mié 22 oct", "lun 20 oct, 10:00 a 11:30" */
function describeRange(startsAt: Date, endsAt: Date, timezone: string) {
  const day = (date: string) => `${formatWeekdayShort(date)} ${formatDayMonth(date)}`;
  const startDate = localDateOf(startsAt, timezone);
  const startTime = formatTime(startsAt, timezone);
  const endTime = formatTime(endsAt, timezone);
  const allDay = startTime === "00:00" && endTime === "00:00";
  // Un bloqueo de días completos termina a las 00:00 del día siguiente.
  const endDate = localDateOf(allDay ? new Date(endsAt.getTime() - 1) : endsAt, timezone);

  if (allDay) {
    return startDate === endDate ? `${day(startDate)}, todo el día` : `${day(startDate)} – ${day(endDate)}`;
  }
  return startDate === endDate
    ? `${day(startDate)}, ${startTime} a ${endTime}`
    : `${day(startDate)} ${startTime} – ${day(endDate)} ${endTime}`;
}
