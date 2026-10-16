import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createTestBusiness, resetDatabase, TEST_PASSWORD } from "@/test/fixtures";
import {
  authenticate,
  createSession,
  invalidateSession,
  SESSION_DURATION_DAYS,
  validateSessionToken,
} from "./auth";

let userId: string;
let email: string;

beforeEach(async () => {
  await resetDatabase();
  const { user } = await createTestBusiness();
  userId = user.id;
  email = user.email;
});

afterAll(() => prisma.$disconnect());

describe("authenticate", () => {
  it("acepta las credenciales correctas, sin importar mayúsculas ni espacios en el email", async () => {
    expect(await authenticate(email, TEST_PASSWORD)).toBe(userId);
    expect(await authenticate(`  ${email.toUpperCase()} `, TEST_PASSWORD)).toBe(userId);
  });

  it("rechaza una contraseña incorrecta o un email inexistente", async () => {
    expect(await authenticate(email, "otra-clave")).toBeNull();
    expect(await authenticate("nadie@example.com", TEST_PASSWORD)).toBeNull();
  });
});

describe("sesiones", () => {
  const NOW = new Date("2026-10-16T12:00:00Z");

  it("crea una sesión que identifica al usuario y a su negocio", async () => {
    const { token, expiresAt } = await createSession(userId, NOW);

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(expiresAt.getTime() - NOW.getTime()).toBe(SESSION_DURATION_DAYS * 86_400_000);
    expect(await validateSessionToken(token, NOW)).toMatchObject({
      id: userId,
      email,
      business: { slug: "negocio-test", timezone: "America/Argentina/Buenos_Aires" },
    });
  });

  it("guarda en la base el hash del token, nunca el token", async () => {
    const { token } = await createSession(userId, NOW);
    const [session] = await prisma.session.findMany();

    expect(session.id).toMatch(/^[0-9a-f]{64}$/);
    expect(session.id).not.toContain(token);
  });

  it("rechaza y borra una sesión vencida", async () => {
    const { token, expiresAt } = await createSession(userId, NOW);

    expect(await validateSessionToken(token, expiresAt)).toBeNull();
    expect(await prisma.session.count()).toBe(0);
  });

  it("cerrar sesión revoca el token", async () => {
    const { token } = await createSession(userId, NOW);
    await invalidateSession(token);
    expect(await validateSessionToken(token, NOW)).toBeNull();
  });

  it("cada sesión es independiente: cerrar una no cierra las demás", async () => {
    const a = await createSession(userId, NOW);
    const b = await createSession(userId, NOW);
    await invalidateSession(a.token);
    expect(await validateSessionToken(b.token, NOW)).not.toBeNull();
  });

  it.each(["", "corto", "x".repeat(43), "a".repeat(200)])("rechaza el token %j", async (token) => {
    await createSession(userId, NOW);
    expect(await validateSessionToken(token, NOW)).toBeNull();
  });

  it("borrar el usuario borra sus sesiones", async () => {
    const { token } = await createSession(userId, NOW);
    await prisma.user.delete({ where: { id: userId } });
    expect(await validateSessionToken(token, NOW)).toBeNull();
  });
});
