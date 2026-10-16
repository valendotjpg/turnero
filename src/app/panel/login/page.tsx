import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { card } from "@/components/styles";
import { DEMO_OWNER_EMAIL, DEMO_OWNER_PASSWORD, showDemoCredentials } from "@/lib/demo";
import { getCurrentUser } from "@/server/dal";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Ingresar al panel",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      {/* Con una sesión válida no tiene sentido mostrar el login. */}
      <Suspense>
        <RedirectIfLoggedIn />
      </Suspense>

      <Link href="/" className="text-sm font-semibold tracking-wide text-accent uppercase">
        Turnero
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Panel del negocio</h1>
      <p className="mt-1 text-muted">Ingresá para ver tu agenda.</p>

      <div className={`${card} mt-6`}>
        <LoginForm />
      </div>

      {showDemoCredentials() && (
        <aside className="mt-6 rounded-2xl border border-dashed border-border p-4 text-sm">
          <p className="font-medium">¿Querés probarlo?</p>
          <p className="mt-1 text-muted">
            Usá la cuenta de la barbería de demostración:
            <br />
            <span className="font-mono text-foreground">{DEMO_OWNER_EMAIL}</span>
            <br />
            <span className="font-mono text-foreground">{DEMO_OWNER_PASSWORD}</span>
          </p>
        </aside>
      )}
    </main>
  );
}

async function RedirectIfLoggedIn() {
  if (await getCurrentUser()) redirect("/panel");
  return null;
}
