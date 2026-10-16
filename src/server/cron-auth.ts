import "server-only";
import { timingSafeEqual } from "node:crypto";

/** ¿El pedido trae `Authorization: Bearer <CRON_SECRET>`? */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  // Comparación en tiempo constante: no revela cuántos caracteres coinciden.
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export const unauthorized = () => Response.json({ error: "No autorizado" }, { status: 401 });
