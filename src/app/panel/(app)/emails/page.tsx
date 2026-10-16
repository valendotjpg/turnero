import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmailPreview } from "@/components/email-preview";
import { card } from "@/components/styles";
import { isDemoMode } from "@/lib/demo";
import { formatDayMonth, formatTime, localDateOf } from "@/lib/dates";
import { requireUser } from "@/server/dal";
import { EMAIL_KIND_LABELS, findEmail, listEmails } from "@/server/panel/emails";

export const metadata: Metadata = { title: "Emails" };

export default function EmailsPage({ searchParams }: PageProps<"/panel/emails">) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Emails</h1>
        <p className="mt-1 max-w-2xl text-muted">
          Los avisos que mandó Turnero a tus clientes y a vos. Si un envío falla, se reintenta solo
          durante un rato.
        </p>
      </header>
      {isDemoMode() && (
        <p className="rounded-xl bg-accent-soft px-4 py-3 text-sm">
          En la demo los emails no se envían a nadie: quedan acá para que veas cómo son.
        </p>
      )}
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-border/60" />}>
        <Emails searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const STATUS = {
  PENDING: { label: "Pendiente", className: "bg-border text-muted" },
  SENDING: { label: "Enviando", className: "bg-border text-muted" },
  SENT: { label: "Enviado", className: "bg-accent-soft text-accent" },
  FAILED: { label: "Falló", className: "bg-danger-soft text-danger" },
} as const;

async function Emails({ searchParams }: { searchParams: PageProps<"/panel/emails">["searchParams"] }) {
  const { id } = await searchParams;
  const user = await requireUser();
  const { timezone } = user.business;

  const [emails, selected] = await Promise.all([
    listEmails(user.businessId),
    typeof id === "string" ? findEmail(user.businessId, id) : null,
  ]);

  if (emails.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-muted">
        Todavía no se mandó ningún email.
      </p>
    );
  }

  const when = (date: Date) => `${formatDayMonth(localDateOf(date, timezone))} ${formatTime(date, timezone)}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
      <ul className={`${card} !p-0 divide-y divide-border overflow-hidden`}>
        {emails.map((e) => {
          const status = STATUS[e.status];
          const isSelected = e.id === selected?.id;
          return (
            <li key={e.id}>
              <Link
                href={`/panel/emails?id=${e.id}`}
                scroll={false}
                aria-current={isSelected ? "true" : undefined}
                className={`block px-4 py-3 transition-colors ${isSelected ? "bg-accent-soft" : "hover:bg-background"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium">{EMAIL_KIND_LABELS[e.kind]}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>
                    {status.label}
                  </span>
                </div>
                <p className="truncate text-sm text-muted">{e.subject}</p>
                <p className="mt-0.5 flex justify-between gap-3 text-xs text-muted">
                  <span className="truncate">{e.to}</span>
                  <span className="shrink-0 tabular-nums">{when(e.createdAt)}</span>
                </p>
                {e.status !== "SENT" && e.lastError && (
                  <p className="mt-1 text-xs text-danger">
                    Intento {e.attempts}: {e.lastError}
                  </p>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="lg:sticky lg:top-6">
        {selected ? (
          <EmailPreview subject={selected.subject} to={selected.to} html={selected.html} />
        ) : (
          <p className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-muted">
            Elegí un email para ver cómo le llegó.
          </p>
        )}
      </div>
    </div>
  );
}
