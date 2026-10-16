// Estructura común de las páginas del panel. Es estática: la sesión se lee
// dentro de <Suspense> (en el menú de usuario y en cada página), así el
// armazón se muestra al instante.

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { button } from "@/components/styles";
import { requireUser } from "@/server/dal";
import { logout } from "../actions";
import { PanelNav } from "./panel-nav";

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Panel" },
  robots: { index: false, follow: false },
};

export default function PanelLayout({ children }: LayoutProps<"/panel">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 pt-4">
          <Link href="/panel" className="text-sm font-semibold tracking-wide text-accent uppercase">
            Turnero
          </Link>
          <Suspense fallback={<div className="h-8 w-40 animate-pulse rounded-lg bg-border/60" />}>
            <UserMenu />
          </Suspense>
        </div>
        <PanelNav />
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}

async function UserMenu() {
  const user = await requireUser();
  return (
    <div className="flex min-w-0 items-center gap-3 text-sm">
      <Link
        href={`/reservar/${user.business.slug}`}
        target="_blank"
        className="max-w-[9rem] truncate text-muted underline-offset-4 hover:text-foreground hover:underline sm:max-w-xs"
        title="Abre la página que ven tus clientes"
      >
        {user.business.name} ↗
      </Link>
      <form action={logout}>
        <button type="submit" className={`${button.secondary} ${button.small}`}>
          Salir
        </button>
      </form>
    </div>
  );
}
