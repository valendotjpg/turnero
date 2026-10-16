import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-semibold text-accent">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">No encontramos esta página</h1>
      <p className="mt-2 text-muted">
        Puede que el enlace esté mal escrito o que el negocio ya no tome reservas online.
      </p>
      <Link href="/" className="mt-6 font-medium text-accent underline-offset-4 hover:underline">
        Volver al inicio
      </Link>
    </main>
  );
}
