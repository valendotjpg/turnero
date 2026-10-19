// Página privada de un turno: se accede con el enlace secreto que recibe el
// cliente al reservar. Muestra el turno y permite cancelarlo.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { googleCalendarUrl } from "@/lib/calendar";
import { isDemoMode } from "@/lib/demo";
import { formatDateLong, formatDuration, formatPrice, formatTime, localDateOf } from "@/lib/dates";
import { findAppointmentByToken } from "@/server/booking";
import { SiteHeader } from "@/components/site-header";
import { CancelForm } from "./cancel-form";

export const metadata: Metadata = {
  title: "Tu turno",
  // El enlace es secreto: que ningún buscador lo indexe.
  robots: { index: false, follow: false },
};

export default function AppointmentPage({ params, searchParams }: PageProps<"/turno/[token]">) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-lg px-4 py-10 sm:py-14">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-card" />}>
          <AppointmentDetails params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

const STATUS = {
  upcoming: { label: "Confirmado", className: "bg-accent-soft text-accent" },
  past: { label: "Finalizado", className: "bg-background text-muted" },
  CANCELLED: { label: "Cancelado", className: "bg-danger-soft text-danger" },
  COMPLETED: { label: "Realizado", className: "bg-background text-muted" },
  NO_SHOW: { label: "Ausente", className: "bg-background text-muted" },
} as const;

async function AppointmentDetails({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const { reservado } = await searchParams;
  await connection();
  const now = new Date();

  const appointment = await findAppointmentByToken(token);
  if (!appointment) notFound();

  const { business, service, startsAt, endsAt } = appointment;
  const isUpcoming = appointment.status === "CONFIRMED" && startsAt > now;
  const status =
    appointment.status === "CONFIRMED" ? STATUS[isUpcoming ? "upcoming" : "past"] : STATUS[appointment.status];
  const justBooked = reservado === "1" && isUpcoming;

  return (
    <div className="space-y-6">
      {justBooked && (
        <div role="status" className="text-center">
          <p className="eyebrow text-accent">◂ Turno reservado ▸</p>
          <p className="display-type mt-3 text-[clamp(3.5rem,16vw,6rem)] text-accent">
            ¡Listo, {appointment.customerName.split(" ")[0]}!
          </p>
          <p className="mx-auto mt-4 max-w-sm text-muted">
            Te mandamos la confirmación a <span className="text-soft">{appointment.customerEmail}</span>.
            Con el enlace de ese email podés volver a ver tu turno o cancelarlo.
          </p>
        </div>
      )}

      {isDemoMode() && (
        <p className="rounded-xl border border-dashed border-line px-5 py-4 text-sm">
          <span className="font-medium">Esto es una demo:</span>{" "}
          <span className="text-muted">los emails no se envían de verdad.</span>{" "}
          <Link href={`/turno/${token}/emails`} className="font-medium text-accent hover:underline">
            Ver los emails que te habrían llegado →
          </Link>
        </p>
      )}

      <article className="rounded-xl border border-border bg-card p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted">{business.name}</p>
            <h1 className="display-type mt-2 text-4xl text-foreground">{service.name}</h1>
          </div>
          <span className={`eyebrow shrink-0 rounded-[15px] px-3 py-1 !text-[0.6875rem] ${status.className}`}>
            {status.label}
          </span>
        </header>

        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          <dt className="text-muted">Día</dt>
          <dd className="font-medium first-letter:uppercase">
            {formatDateLong(localDateOf(startsAt, business.timezone))}
          </dd>
          <dt className="text-muted">Horario</dt>
          <dd className="font-medium tabular-nums">
            {formatTime(startsAt, business.timezone)} a {formatTime(endsAt, business.timezone)}{" "}
            <span className="font-normal text-muted">({formatDuration(service.durationMinutes)})</span>
          </dd>
          <dt className="text-muted">Precio</dt>
          <dd className="font-medium">{formatPrice(service.priceCents)}</dd>
          {business.address && (
            <>
              <dt className="text-muted">Dirección</dt>
              <dd className="font-medium">{business.address}</dd>
            </>
          )}
          {business.phone && (
            <>
              <dt className="text-muted">Teléfono</dt>
              <dd className="font-medium">{business.phone}</dd>
            </>
          )}
          <dt className="text-muted">A nombre de</dt>
          <dd className="font-medium">{appointment.customerName}</dd>
        </dl>

        {isUpcoming && (
          <>
            <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="text-muted">Agregar al calendario:</span>
              <a
                href={googleCalendarUrl({
                  uid: appointment.id,
                  title: `${service.name} en ${business.name}`,
                  start: startsAt,
                  end: endsAt,
                  location: business.address,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent hover:underline"
              >
                Google
              </a>
              <a href={`/turno/${token}/calendario.ics`} className="font-medium text-accent hover:underline">
                Apple, Outlook y otros (.ics)
              </a>
            </p>
            <div className="mt-5 border-t border-border pt-5">
              <CancelForm token={token} />
            </div>
          </>
        )}
      </article>

      <Link
        href={`/reservar/${business.slug}`}
        className="block text-center text-sm font-medium text-accent underline-offset-4 hover:underline"
      >
        Reservar otro turno en {business.name}
      </Link>
    </div>
  );
}
