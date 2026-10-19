// Página pública de reservas de un negocio.
//
// El progreso de la reserva vive en la URL (?servicio=…&fecha=…&hora=…): cada
// paso es un enlace, así funciona sin JavaScript, el botón "atrás" del
// navegador deshace el último paso y el enlace se puede compartir. Los
// parámetros se validan contra los datos reales; uno inválido se ignora.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { weekdayOf, type Interval } from "@/lib/availability";
import {
  dateRange,
  formatDateLong,
  formatDayMonth,
  formatDuration,
  formatPrice,
  formatTime,
  formatWeekdayShort,
} from "@/lib/dates";
import { BOOKING_WINDOW_DAYS, bookingWindow, computeSlots } from "@/server/availability";
import { findPublicBusiness, type PublicBusiness } from "@/server/business";
import { SiteHeader } from "@/components/site-header";
import { pill } from "@/components/styles";
import { BookingForm } from "./booking-form";

export const metadata: Metadata = { title: "Reservar turno" };

export default function BookingPage({ params, searchParams }: PageProps<"/reservar/[slug]">) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
        <Suspense fallback={<BookingSkeleton />}>
          <Booking params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

type SearchParams = Awaited<PageProps<"/reservar/[slug]">["searchParams"]>;

/** Un parámetro de búsqueda repetido (?a=1&a=2) se toma como ausente. */
const single = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : undefined;

async function Booking({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  await connection();
  const now = new Date();

  const business = await findPublicBusiness(slug);
  if (!business) notFound();

  const service = business.services.find((s) => s.id === single(query.servicio));
  const days = dateRange(bookingWindow(business.timezone, now).first, BOOKING_WINDOW_DAYS);
  const date = service ? days.find((d) => d === single(query.fecha)) : undefined;

  const slots =
    service && date
      ? await computeSlots(
          {
            businessId: business.id,
            timezone: business.timezone,
            durationMinutes: service.durationMinutes,
          },
          date,
          now,
        )
      : [];
  const requestedTime = date ? single(query.hora) : undefined;
  const slot = slots.find((s) => s.start.toISOString() === requestedTime);

  const href = (next: { servicio?: string; fecha?: string; hora?: string }, anchor: string) =>
    `/reservar/${business.slug}?${new URLSearchParams(next)}#${anchor}`;

  return (
    <div className="space-y-6">
      <BusinessHeader business={business} />

      <Step number={1} title="El servicio" id="servicio">
        {business.services.length === 0 ? (
          <p className="text-muted">Este negocio todavía no ofrece servicios online.</p>
        ) : (
          <ul className="grid gap-2">
            {business.services.map((s) => (
              <li key={s.id}>
                <Option
                  href={href({ servicio: s.id }, "dia")}
                  selected={s.id === service?.id}
                  className="flex items-center justify-between gap-4 px-4 py-3 text-left"
                >
                  <span>
                    <span className="block font-medium">{s.name}</span>
                    {s.description && (
                      <span className="block text-sm text-muted">{s.description}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-right text-sm">
                    <span className="block font-medium">{formatPrice(s.priceCents)}</span>
                    <span className="block text-muted">{formatDuration(s.durationMinutes)}</span>
                  </span>
                </Option>
              </li>
            ))}
          </ul>
        )}
      </Step>

      {service && (
        <Step number={2} title="El día" id="dia">
          <ul className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2">
            {days.map((d) => {
              const open = business.openWeekdays.has(weekdayOf(d));
              const content = (
                <>
                  <span className="text-xs uppercase tracking-wide">{formatWeekdayShort(d)}</span>
                  <span className="text-lg font-semibold leading-tight">{d.slice(8)}</span>
                  <span className="text-xs">{formatDayMonth(d).split(" ")[1]}</span>
                </>
              );
              return (
                <li key={d} className="snap-start">
                  {open ? (
                    <Option
                      href={href({ servicio: service.id, fecha: d }, "horario")}
                      selected={d === date}
                      className="flex w-16 flex-col items-center py-2"
                    >
                      {content}
                    </Option>
                  ) : (
                    <span
                      className="flex w-16 cursor-not-allowed flex-col items-center rounded-[15px] border border-dashed border-line/60 py-2 text-muted opacity-50"
                      title="Cerrado"
                    >
                      {content}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Step>
      )}

      {service && date && (
        <Step number={3} title="El horario" subtitle={formatDateLong(date)} id="horario">
          {requestedTime && !slot && (
            <Notice tone="danger">Ese horario ya no está disponible. Elegí otro.</Notice>
          )}
          {slots.length === 0 ? (
            <p className="text-muted">No quedan horarios libres este día. Probá con otro.</p>
          ) : (
            <SlotGrid
              slots={slots}
              timezone={business.timezone}
              selected={slot}
              hrefFor={(s) => href({ servicio: service.id, fecha: date, hora: s.start.toISOString() }, "datos")}
            />
          )}
        </Step>
      )}

      {service && date && slot && (
        <Step number={4} title="Tus datos" id="datos">
          <dl className="mb-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl border border-accent/40 bg-accent-soft p-4 text-sm">
            <dt className="text-muted">Servicio</dt>
            <dd className="font-medium">{service.name}</dd>
            <dt className="text-muted">Cuándo</dt>
            <dd className="font-medium first-letter:uppercase">
              {formatDateLong(date)}, {formatTime(slot.start, business.timezone)} a{" "}
              {formatTime(slot.end, business.timezone)}
            </dd>
            <dt className="text-muted">Precio</dt>
            <dd className="font-medium">{formatPrice(service.priceCents)}</dd>
          </dl>
          <BookingForm
            businessSlug={business.slug}
            serviceId={service.id}
            startsAt={slot.start.toISOString()}
            backHref={href({ servicio: service.id, fecha: date }, "horario")}
          />
        </Step>
      )}
    </div>
  );
}

function BusinessHeader({ business }: { business: PublicBusiness }) {
  return (
    <header className="pb-2">
      <p className="eyebrow text-accent">◂ Reservá tu turno online ▸</p>
      <h1 className="display-type mt-4 text-[clamp(3rem,11vw,6.5rem)] text-accent">{business.name}</h1>
      {(business.address || business.phone) && (
        <p className="mt-4 flex flex-wrap gap-x-3 text-muted">
          {/* Cada dato entero en una línea: un teléfono partido al medio no se lee. */}
          {[business.address, business.phone].filter(Boolean).map((item) => (
            <span key={item} className="whitespace-nowrap">
              {item}
            </span>
          ))}
        </p>
      )}
    </header>
  );
}

function Step({
  number,
  title,
  subtitle,
  id,
  children,
}: {
  number: number;
  title: string;
  subtitle?: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <header className="mb-5">
        <p className="eyebrow text-accent">Paso {number} de 4</p>
        <h2 className="display-type mt-2 text-4xl text-foreground">{title}</h2>
        {subtitle && <p className="mt-2 text-soft first-letter:uppercase">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

/** Opción elegible de un paso: un enlace que se resalta cuando está elegido. */
function Option({
  href,
  selected,
  className = "",
  children,
}: {
  href: string;
  selected: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={selected ? "true" : undefined}
      className={`${pill(selected)} ${selected ? "[&_.text-muted]:text-accent-foreground/80" : ""} ${className}`}
    >
      {children}
    </Link>
  );
}

function SlotGrid({
  slots,
  timezone,
  selected,
  hrefFor,
}: {
  slots: Interval[];
  timezone: string;
  selected?: Interval;
  hrefFor: (slot: Interval) => string;
}) {
  return (
    <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
      {slots.map((s) => (
        <li key={s.start.toISOString()}>
          <Option
            href={hrefFor(s)}
            selected={s.start.getTime() === selected?.start.getTime()}
            className="block py-2 text-center text-sm font-medium tabular-nums"
          >
            {formatTime(s.start, timezone)}
          </Option>
        </li>
      ))}
    </ul>
  );
}

function Notice({ tone, children }: { tone: "danger"; children: ReactNode }) {
  const styles = { danger: "bg-danger-soft text-danger" };
  return (
    <p role="alert" className={`mb-4 rounded-xl px-4 py-3 text-sm ${styles[tone]}`}>
      {children}
    </p>
  );
}

function BookingSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-label="Cargando">
      <div className="space-y-3">
        <div className="h-4 w-48 rounded bg-card" />
        <div className="h-20 w-72 rounded bg-card" />
      </div>
      <div className="h-64 rounded-xl bg-card" />
    </div>
  );
}
