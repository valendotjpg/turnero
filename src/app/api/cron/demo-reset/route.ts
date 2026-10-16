// Reinicio diario de la demo pública: como la cuenta del panel es pública,
// cualquiera puede cambiar los datos. Fuera del modo demo no existe.

import { isDemoMode } from "@/lib/demo";
import { resetDemoBusiness } from "@/lib/demo-data";
import { prisma } from "@/lib/prisma";
import { isAuthorizedCron, unauthorized } from "@/server/cron-auth";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return unauthorized();
  if (!isDemoMode()) return Response.json({ error: "Sólo disponible en modo demo" }, { status: 404 });

  const { appointments } = await resetDemoBusiness(prisma, new Date());
  return Response.json({ reset: true, appointments });
}
