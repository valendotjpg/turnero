// Capa de acceso a datos (DAL): el único lugar que lee la cookie de sesión.
// Toda página y toda Server Action del panel pasa por acá; proxy.ts es sólo un
// filtro optimista que redirige antes de renderizar.

import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { createSession, invalidateSession, validateSessionToken, type SessionUser } from "./auth";

/** Usuario con sesión válida, o `null`. Se resuelve una vez por request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  // Validar compara el vencimiento con la hora actual: eso sólo puede pasar
  // al atender un request, nunca durante el prerenderizado.
  await connection();
  return validateSessionToken(token, new Date());
});

/** Usuario con sesión válida; si no hay, redirige al login. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/panel/login");
  return user;
}

/** Crea la sesión y deja la cookie. Sólo desde una Server Action. */
export async function startSession(userId: string) {
  const { token, expiresAt } = await createSession(userId);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, // inaccesible desde JavaScript: un XSS no puede robarla
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // no viaja en requests de otros sitios (POST, iframes)
    path: "/",
    expires: expiresAt,
  });
}

/** Revoca la sesión en la base y borra la cookie. Sólo desde una Server Action. */
export async function endSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await invalidateSession(token);
  cookieStore.delete(SESSION_COOKIE);
}
