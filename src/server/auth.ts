// Autenticación del panel: verificación de credenciales y sesiones en base.
//
// El token de sesión es aleatorio (256 bits) y vive sólo en la cookie del
// navegador; la base guarda su SHA-256. Las sesiones tienen un vencimiento
// absoluto y se pueden revocar borrando la fila (cerrar sesión).

import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export const SESSION_DURATION_DAYS = 30;
const DAY_MS = 86_400_000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Usuario del panel tal como lo ve el resto de la aplicación. */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  businessId: string;
  business: { name: string; slug: string; timezone: string };
}

const sessionUserSelect = {
  id: true,
  name: true,
  email: true,
  businessId: true,
  business: { select: { name: true, slug: true, timezone: true } },
} as const;

// Hash de una contraseña cualquiera, para que un email inexistente tarde lo
// mismo que uno existente y no se pueda averiguar qué cuentas hay.
let dummyHash: Promise<string> | undefined;

/** Devuelve el id del usuario si email y contraseña coinciden. */
export async function authenticate(email: string, password: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, passwordHash: true },
  });

  if (!user) {
    await verifyPassword(password, await (dummyHash ??= hashPassword("contraseña-inexistente")));
    return null;
  }
  return (await verifyPassword(password, user.passwordHash)) ? user.id : null;
}

export async function createSession(userId: string, now: Date = new Date()) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_DAYS * DAY_MS);
  await prisma.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  return { token, expiresAt };
}

/** Usuario dueño del token, o `null` si el token no existe o venció. */
export async function validateSessionToken(
  token: string,
  now: Date = new Date(),
): Promise<SessionUser | null> {
  if (!TOKEN_PATTERN.test(token)) return null;

  const id = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { id },
    select: { expiresAt: true, user: { select: sessionUserSelect } },
  });
  if (!session) return null;

  if (session.expiresAt <= now) {
    await prisma.session.deleteMany({ where: { id } });
    return null;
  }
  return session.user;
}

export async function invalidateSession(token: string) {
  if (!TOKEN_PATTERN.test(token)) return;
  await prisma.session.deleteMany({ where: { id: hashToken(token) } });
}
