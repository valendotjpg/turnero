// Datos de prueba compartidos por los tests de integración.

import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export const TEST_PASSWORD = "clave-de-prueba-123";

let passwordHash: Promise<string> | undefined;

/** Borra todo: los negocios arrastran en cascada al resto de las tablas. */
export async function resetDatabase() {
  await prisma.business.deleteMany();
}

/**
 * Negocio en Buenos Aires con un servicio de 30 minutos, atención los martes
 * de 09:00 a 13:00 y un usuario dueño.
 */
export async function createTestBusiness(slug = "negocio-test") {
  const business = await prisma.business.create({
    data: {
      name: `Negocio ${slug}`,
      slug,
      timezone: "America/Argentina/Buenos_Aires",
      workingHours: { create: { weekday: 2, startMinute: 540, endMinute: 780 } },
      services: { create: { name: "Corte", durationMinutes: 30, priceCents: 1_000_000 } },
      users: {
        create: {
          name: "Dueño",
          email: `duenio@${slug}.test`,
          passwordHash: await (passwordHash ??= hashPassword(TEST_PASSWORD)),
        },
      },
    },
    include: { services: true, users: true },
  });
  return { business, service: business.services[0], user: business.users[0] };
}

/** Turno confirmado insertado directamente, sin pasar por las reglas de reserva. */
export function createTestAppointment(
  businessId: string,
  serviceId: string,
  startsAt: string,
  endsAt: string,
) {
  return prisma.appointment.create({
    data: {
      businessId,
      serviceId,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      customerName: "Cliente",
      customerEmail: "cliente@example.com",
      cancelToken: crypto.randomUUID().replaceAll("-", "").padEnd(32, "x"),
    },
  });
}
