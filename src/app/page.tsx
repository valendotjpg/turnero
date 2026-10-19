import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { button, card } from "@/components/styles";

const STEPS = [
  { title: "Elegí el servicio", body: "Con su duración y su precio a la vista." },
  { title: "Elegí el día", body: "Sólo aparecen los días en que el negocio atiende." },
  { title: "Elegí el horario", body: "Los que están libres de verdad, sin consultar a nadie." },
];

const FEATURES = [
  {
    title: "Sin turnos pisados",
    body: "La base de datos impide que dos personas reserven el mismo horario, aunque lo hagan en el mismo instante.",
  },
  {
    title: "Sin cuentas ni contraseñas",
    body: "Para reservar alcanza con nombre y email. Cada turno tiene un enlace privado para verlo o cancelarlo.",
  },
  {
    title: "Avisos por email",
    body: "Confirmación, recordatorio 24 horas antes y aviso al negocio por cada turno nuevo o cancelado.",
  },
];

export default function Home() {
  return (
    <>
      <SiteHeader>
        <Link href="/panel" className={`${button.secondary} ${button.small}`}>
          Panel
        </Link>
        <Link href="/reservar/barberia-demo" className={`${button.primary} ${button.small}`}>
          Probar ▸
        </Link>
      </SiteHeader>

      <main className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-4 pt-16 pb-20 text-center sm:pt-24 sm:pb-28">
          <p className="eyebrow text-accent">◂ Turnos online para negocios locales ▸</p>
          <h1 className="display-type mt-6 text-[clamp(3.25rem,13vw,10rem)] text-accent">
            Tu agenda
            <span className="block text-soft">(sin mensajes)</span>
          </h1>
          <p className="mx-auto mt-8 max-w-xl text-lg text-muted">
            Tus clientes eligen servicio, día y horario y reservan solos. Vos dejás de coordinar
            turnos por mensaje y mirás todo en un panel.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/reservar/barberia-demo" className={button.primary}>
              Probar la reserva ▸
            </Link>
            <Link href="/panel" className={button.secondary}>
              Entrar al panel
            </Link>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:pb-28">
          <p className="eyebrow text-center text-accent">◂ Cómo reserva un cliente ▸</p>
          <h2 className="display-type mt-4 text-center text-[clamp(2.75rem,8vw,6.5rem)] text-accent">
            Tres toques
          </h2>
          <ol className="mt-10 grid gap-3 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className={card}>
                <span className="display-type text-5xl text-accent">{i + 1}</span>
                <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
                <p className="mt-1 text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-24">
          <p className="eyebrow text-center text-accent">◂ Para el negocio ▸</p>
          <h2 className="display-type mt-4 text-center text-[clamp(2.75rem,8vw,6.5rem)] text-accent">
            Menos ida y vuelta
          </h2>
          <ul className="mt-10 grid gap-3 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title} className={card}>
                <h3 className="text-lg font-semibold text-soft">{f.title}</h3>
                <p className="mt-2 text-muted">{f.body}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="bg-nav">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted">
          <span className="display-type text-lg text-accent">Turnero</span>
          <a
            href="https://github.com/valendotjpg/turnero"
            className="underline-offset-4 hover:text-soft hover:underline"
          >
            Proyecto de portfolio · código en GitHub ↗
          </a>
        </div>
      </footer>
    </>
  );
}
