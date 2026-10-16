// Descarga del turno como archivo .ics, para Apple Calendar, Outlook, etc.

import { buildIcs } from "@/lib/calendar";
import { findAppointmentByToken } from "@/server/booking";

export async function GET(_request: Request, { params }: RouteContext<"/turno/[token]/calendario.ics">) {
  const { token } = await params;
  const appointment = await findAppointmentByToken(token);
  if (!appointment || appointment.status === "CANCELLED") {
    return new Response("Turno no encontrado", { status: 404 });
  }

  const { business, service } = appointment;
  const ics = buildIcs({
    uid: `${appointment.id}@turnero`,
    title: `${service.name} en ${business.name}`,
    start: appointment.startsAt,
    end: appointment.endsAt,
    location: business.address,
    description: business.phone ? `Teléfono del negocio: ${business.phone}` : undefined,
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="turno.ics"',
      // El enlace es secreto: que ningún proxy intermedio lo guarde.
      "Cache-Control": "private, no-store",
    },
  });
}
