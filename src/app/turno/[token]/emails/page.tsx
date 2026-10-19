// Sólo en la demo pública: los emails que habría recibido el cliente de este
// turno. Fuera de la demo, la página no existe.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmailPreview } from "@/components/email-preview";
import { SiteHeader } from "@/components/site-header";
import { isDemoMode } from "@/lib/demo";
import { findCustomerEmailsByToken } from "@/server/panel/emails";

export const metadata: Metadata = {
  title: "Tus emails",
  robots: { index: false, follow: false },
};

export default function AppointmentEmailsPage({ params }: PageProps<"/turno/[token]/emails">) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-10 sm:py-14">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-card" />}>
          <Emails params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function Emails({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isDemoMode()) notFound();

  const emails = await findCustomerEmailsByToken(token);

  return (
    <>
      <header>
        <Link href={`/turno/${token}`} className="text-sm font-medium text-accent hover:underline">
          ← Volver al turno
        </Link>
        <h1 className="display-type mt-4 text-5xl text-accent">Tus emails</h1>
        <p className="mt-1 text-muted">
          Esto es una demo: los emails no se envían a nadie, pero se generan igual que en un negocio real.
        </p>
      </header>
      {emails.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-6 py-12 text-center text-muted">
          Todavía no hay emails para este turno.
        </p>
      ) : (
        emails.map((e) => <EmailPreview key={e.id} subject={e.subject} to={e.to} html={e.html} />)
      )}
    </>
  );
}
