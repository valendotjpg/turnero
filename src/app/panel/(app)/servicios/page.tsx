import type { Metadata } from "next";
import { Suspense } from "react";
import { button, card } from "@/components/styles";
import { SubmitButton } from "@/components/submit-button";
import { formatDuration, formatPrice } from "@/lib/dates";
import { requireUser } from "@/server/dal";
import { listServices } from "@/server/panel/services";
import { toggleService } from "./actions";
import { ServiceForm } from "./service-form";

export const metadata: Metadata = { title: "Servicios" };

export default function ServicesPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Servicios</h1>
        <p className="mt-1 text-muted">Lo que tus clientes pueden reservar online, con su duración y precio.</p>
      </header>
      <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-border/60" />}>
        <Services />
      </Suspense>
    </div>
  );
}

async function Services() {
  const user = await requireUser();
  const services = await listServices(user.businessId);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
      <ul className="space-y-3">
        {services.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-muted">
            Todavía no cargaste servicios.
          </li>
        )}
        {services.map((s) => (
          <li key={s.id} className={`${card} !p-4 sm:!p-5`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className={s.active ? "" : "opacity-60"}>
                <p className="font-semibold">
                  {s.name}
                  {!s.active && (
                    <span className="ml-2 rounded-full bg-border px-2 py-0.5 text-xs font-semibold text-muted">
                      Pausado
                    </span>
                  )}
                </p>
                {s.description && <p className="text-sm text-muted">{s.description}</p>}
                <p className="mt-1 text-sm">
                  {formatDuration(s.durationMinutes)} · {formatPrice(s.priceCents)}
                </p>
              </div>
              <form action={toggleService}>
                <input type="hidden" name="serviceId" value={s.id} />
                <input type="hidden" name="active" value={String(!s.active)} />
                <SubmitButton className={`${button.secondary} ${button.small}`}>
                  {s.active ? "Pausar" : "Reactivar"}
                </SubmitButton>
              </form>
            </div>
            <details className="mt-3 group">
              <summary className="cursor-pointer text-sm font-medium text-accent">Editar</summary>
              <div className="mt-4">
                <ServiceForm service={s} />
              </div>
            </details>
          </li>
        ))}
      </ul>

      <section className={card}>
        <h2 className="mb-4 font-semibold">Nuevo servicio</h2>
        <ServiceForm />
      </section>
    </div>
  );
}
