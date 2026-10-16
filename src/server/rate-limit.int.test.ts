import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, formatRetryAfter, pruneRateLimits } from "./rate-limit";

const RULE = { limit: 3, windowMs: 60_000 };
const NOW = new Date("2026-10-16T12:00:00Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);

beforeEach(() => prisma.rateLimit.deleteMany());
afterAll(() => prisma.$disconnect());

describe("consumeRateLimit", () => {
  it("permite hasta el límite y después rechaza, diciendo cuánto falta", async () => {
    for (let i = 0; i < 3; i++) {
      expect(await consumeRateLimit("login:ip", RULE, later(i * 1000))).toEqual({ allowed: true });
    }
    expect(await consumeRateLimit("login:ip", RULE, later(20_000))).toEqual({
      allowed: false,
      retryAfterMs: 40_000,
    });
  });

  it("reinicia el contador cuando vence la ventana", async () => {
    for (let i = 0; i < 4; i++) await consumeRateLimit("login:ip", RULE, NOW);
    expect(await consumeRateLimit("login:ip", RULE, later(60_000))).toEqual({ allowed: true });
  });

  it("cuenta cada clave por separado", async () => {
    for (let i = 0; i < 4; i++) await consumeRateLimit("login:a", RULE, NOW);
    expect(await consumeRateLimit("login:b", RULE, NOW)).toEqual({ allowed: true });
  });

  it("es atómico: con muchos pedidos simultáneos pasan exactamente `limit`", async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => consumeRateLimit("booking:ip", RULE, NOW)));
    expect(results.filter((r) => r.allowed)).toHaveLength(3);
  });
});

describe("pruneRateLimits", () => {
  it("borra los contadores de más de un día", async () => {
    await consumeRateLimit("viejo", RULE, NOW);
    await consumeRateLimit("nuevo", RULE, later(23 * 3_600_000));
    expect(await pruneRateLimits(later(25 * 3_600_000))).toBe(1);
    expect((await prisma.rateLimit.findMany()).map((r) => r.key)).toEqual(["nuevo"]);
  });
});

describe("formatRetryAfter", () => {
  it("redondea hacia arriba a minutos", () => {
    expect(formatRetryAfter(1)).toBe("1 minuto");
    expect(formatRetryAfter(61_000)).toBe("2 minutos");
  });
});
