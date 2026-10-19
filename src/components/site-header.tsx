import Link from "next/link";
import type { ReactNode } from "react";

/** Logotipo: TURNERO en la condensada, en cobre. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`display-type text-2xl text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${className}`}
    >
      Turnero
    </Link>
  );
}

/** Barra superior negra y fija de las páginas públicas. */
export function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 bg-nav">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <Wordmark />
        {children && <nav className="flex items-center gap-2">{children}</nav>}
      </div>
    </header>
  );
}
