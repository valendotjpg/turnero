import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/server/dal";
import { getWeeklySchedule } from "@/server/panel/schedule";
import { DayScheduleForm } from "./day-schedule-form";

export const metadata: Metadata = { title: "Horarios" };

const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
// La semana se muestra de lunes a domingo.
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function SchedulePage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="display-type text-5xl text-accent sm:text-6xl">Horarios de atención</h1>
        <p className="mt-4 max-w-2xl text-muted">
          Tus clientes sólo pueden reservar dentro de estas franjas. Para un horario cortado, agregá
          más de una franja en el mismo día. Cambiar los horarios no cancela los turnos ya dados.
        </p>
      </header>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-card" />}>
        <Schedule />
      </Suspense>
    </div>
  );
}

async function Schedule() {
  const user = await requireUser();
  const week = await getWeeklySchedule(user.businessId);

  return (
    <ul className="space-y-3">
      {DISPLAY_ORDER.map((weekday) => (
        <li key={weekday}>
          <DayScheduleForm
            weekday={weekday}
            label={WEEKDAYS[weekday]}
            ranges={week[weekday].ranges}
          />
        </li>
      ))}
    </ul>
  );
}
