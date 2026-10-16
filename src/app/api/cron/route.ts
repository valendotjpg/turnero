// Tarea periódica: encola recordatorios y envía (o reintenta) los emails
// pendientes. En producción la invoca el cron de la plataforma cada pocos
// minutos; en desarrollo, `npm run cron`.

import { timingSafeEqual } from "node:crypto";
import { enqueueReminders, processOutbox } from "@/server/email/outbox";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  // Comparación en tiempo constante: no revela cuántos caracteres coinciden.
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const now = new Date();
  const reminders = await enqueueReminders(now);
  const delivery = await processOutbox({ now });
  return Response.json({ reminders, ...delivery });
}
