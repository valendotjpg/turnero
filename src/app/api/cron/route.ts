// Tarea periódica: encola recordatorios, envía (o reintenta) los emails
// pendientes y limpia contadores viejos del rate limiting. En producción la
// invoca un workflow programado de GitHub Actions; en desarrollo, `npm run cron`.

import { isAuthorizedCron, unauthorized } from "@/server/cron-auth";
import { enqueueReminders, processOutbox } from "@/server/email/outbox";
import { pruneRateLimits } from "@/server/rate-limit";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return unauthorized();

  const now = new Date();
  const reminders = await enqueueReminders(now);
  const delivery = await processOutbox({ now });
  const prunedRateLimits = await pruneRateLimits(now);
  return Response.json({ reminders, ...delivery, prunedRateLimits });
}
