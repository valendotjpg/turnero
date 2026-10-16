// Límite de intentos por ventana fija de tiempo.
//
// Un único INSERT … ON CONFLICT DO UPDATE incrementa el contador (o lo
// reinicia si la ventana venció) y devuelve el valor nuevo. Es atómico: dos
// requests simultáneos nunca leen el mismo número.

import "server-only";
import { prisma } from "@/lib/prisma";

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export const RULES = {
  /** Intentos de login por IP. */
  login: { limit: 10, windowMs: 15 * 60_000 },
  /** Reservas (y errores de validación) por IP. */
  booking: { limit: 10, windowMs: 60 * 60_000 },
} satisfies Record<string, RateLimitRule>;

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterMs: number };

export async function consumeRateLimit(
  key: string,
  { limit, windowMs }: RateLimitRule,
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const windowExpiredBefore = new Date(now.getTime() - windowMs);

  const [row] = await prisma.$queryRaw<{ count: number; windowStart: Date }[]>`
    INSERT INTO "RateLimit" ("key", "windowStart", "count")
    VALUES (${key}, ${now}, 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" <= ${windowExpiredBefore}
                     THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" <= ${windowExpiredBefore}
                           THEN ${now} ELSE "RateLimit"."windowStart" END
    RETURNING "count", "windowStart"`;

  if (row.count <= limit) return { allowed: true };
  return { allowed: false, retryAfterMs: row.windowStart.getTime() + windowMs - now.getTime() };
}

/** Borra los contadores viejos. La llama el cron. */
export async function pruneRateLimits(now: Date = new Date()) {
  const { count } = await prisma.rateLimit.deleteMany({
    where: { windowStart: { lt: new Date(now.getTime() - 24 * 60 * 60_000) } },
  });
  return count;
}

/** "15 minutos", "1 minuto" */
export function formatRetryAfter(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  return `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
}
