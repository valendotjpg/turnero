import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { button } from "@/components/styles";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <p className="display-type text-[clamp(6rem,30vw,10rem)] text-accent">404</p>
        <h1 className="display-type mt-4 text-4xl text-foreground">No encontramos esta página</h1>
        <p className="mt-2 text-muted">
          Puede que el enlace esté mal escrito o que el negocio ya no tome reservas online.
        </p>
        <Link href="/" className={`${button.primary} mt-8`}>
          Volver al inicio ▸
        </Link>
      </main>
    </>
  );
}
