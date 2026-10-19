"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/panel", label: "Agenda" },
  { href: "/panel/servicios", label: "Servicios" },
  { href: "/panel/horarios", label: "Horarios" },
  { href: "/panel/bloqueos", label: "Bloqueos" },
  { href: "/panel/emails", label: "Emails" },
] as const;

export function PanelNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones del panel" className="mx-auto w-full max-w-5xl px-2">
      <ul className="flex gap-1 overflow-x-auto">
        {LINKS.map(({ href, label }) => {
          const active = href === "/panel" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`eyebrow block border-b-2 px-3 py-3 transition-colors ${
                  active
                    ? "border-accent text-foreground"
                    : "border-transparent text-soft/75 hover:text-soft"
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
