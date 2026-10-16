import Link from "next/link";

const FEATURES = [
  {
    title: "Horarios reales",
    body: "El cliente sólo ve los horarios que de verdad están libres según la agenda, los horarios de atención y los feriados.",
  },
  {
    title: "Sin turnos pisados",
    body: "La base de datos impide que dos personas reserven el mismo horario, aunque lo hagan en el mismo instante.",
  },
  {
    title: "Sin cuentas ni contraseñas",
    body: "Para reservar alcanza con nombre y email. Cada turno tiene un enlace privado para verlo o cancelarlo.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-16">
      <p className="text-sm font-semibold tracking-wide text-accent uppercase">Turnero</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
        Turnos online para negocios locales.
      </h1>
      <p className="mt-4 max-w-xl text-lg text-muted">
        Tus clientes eligen servicio, día y horario y reservan solos. Vos dejás de coordinar turnos
        por mensaje.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/reservar/barberia-demo"
          className="rounded-xl bg-accent px-5 py-3 font-semibold text-accent-foreground transition-opacity hover:opacity-90"
        >
          Probar la reserva de demo
        </Link>
        <Link
          href="/panel"
          className="rounded-xl border border-border bg-card px-5 py-3 font-semibold transition-colors hover:border-accent"
        >
          Entrar al panel del negocio
        </Link>
      </div>

      <ul className="mt-14 grid gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <li key={f.title} className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-semibold">{f.title}</h2>
            <p className="mt-2 text-sm text-muted">{f.body}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
