// Datos del negocio de demostración. Lo usan el seed (`npm run db:seed`) y el
// reinicio diario de la demo pública. Recibe el cliente de Prisma como
// parámetro para poder correr tanto desde un script como desde la app.

import type { PrismaClient } from "@/generated/prisma/client";
import { weekdayOf, zonedInstant } from "./availability";
import { addDays, localDateOf, parseTimeOfDay } from "./dates";
import { DEMO_BUSINESS_SLUG, DEMO_OWNER_EMAIL, DEMO_OWNER_PASSWORD } from "./demo";
import { hashPassword } from "./password";

const SERVICES = {
  corte: { name: "Corte de pelo", durationMinutes: 30, priceCents: 1_200_000 },
  corteBarba: { name: "Corte + barba", durationMinutes: 45, priceCents: 1_800_000 },
  barba: { name: "Arreglo de barba", durationMinutes: 20, priceCents: 800_000 },
  color: {
    name: "Coloración",
    description: "Incluye lavado y secado.",
    durationMinutes: 90,
    priceCents: 3_500_000,
  },
} as const;
type ServiceKey = keyof typeof SERVICES;

// Agendas de muestra, armadas a mano para que no se superpongan y entren en
// el horario de atención. Dejan huecos libres para probar la reserva.
const WEEKDAY_PATTERNS: [time: string, service: ServiceKey][][] = [
  [["09:30", "corte"], ["10:15", "barba"], ["11:00", "color"], ["16:30", "corteBarba"], ["18:00", "corte"]],
  [["09:00", "corteBarba"], ["10:00", "corte"], ["12:00", "barba"], ["17:00", "corte"], ["19:00", "corteBarba"]],
  [["10:30", "corte"], ["16:00", "color"], ["18:30", "barba"]],
];
const SATURDAY_PATTERN: [string, ServiceKey][] = [
  ["09:00", "corte"], ["09:45", "barba"], ["10:30", "corteBarba"], ["12:00", "color"], ["15:00", "corte"],
];

const CUSTOMERS = [
  ["Martín Ruiz", "+54 11 4444-1111"], ["Lucía Fernández", null], ["Sebastián Ortiz", "+54 11 4444-2222"],
  ["Valeria Domínguez", "+54 11 4444-3333"], ["Diego Sosa", null], ["Camila Herrera", "+54 11 4444-4444"],
  ["Nicolás Paz", null], ["Florencia Acosta", "+54 11 4444-5555"], ["Tomás Medina", null],
  ["Julieta Romero", "+54 11 4444-6666"], ["Pablo Gómez", null], ["Agustina Vera", null],
] as const;
const NOTES = ["Prefiere tijera, sin máquina.", "Trae foto del color que quiere.", "Primera vez que viene."];

const minutes = (hhmm: string) => parseTimeOfDay(hhmm)!;
const slug = (name: string) => name.normalize("NFD").replace(/[^\w ]/g, "").toLowerCase().replace(/ /g, ".");

/** Borra y vuelve a crear el negocio de demostración, con turnos alrededor de `now`. */
export async function resetDemoBusiness(db: PrismaClient, now: Date = new Date()) {
  await db.business.deleteMany({ where: { slug: DEMO_BUSINESS_SLUG } });

  const business = await db.business.create({
    data: {
      name: "Barbería Demo",
      slug: DEMO_BUSINESS_SLUG,
      phone: "+54 11 5555-0000",
      address: "Av. Siempreviva 742, CABA",
      services: { create: Object.values(SERVICES) },
      users: {
        create: { name: "Julio", email: DEMO_OWNER_EMAIL, passwordHash: await hashPassword(DEMO_OWNER_PASSWORD) },
      },
      // Martes a viernes con horario cortado, sábado de corrido.
      workingHours: {
        create: [
          ...[2, 3, 4, 5].flatMap((weekday) => [
            { weekday, startMinute: minutes("09:00"), endMinute: minutes("13:00") },
            { weekday, startMinute: minutes("16:00"), endMinute: minutes("20:00") },
          ]),
          { weekday: 6, startMinute: minutes("09:00"), endMinute: minutes("17:00") },
        ],
      },
    },
    include: { services: true },
  });

  const serviceIds = Object.fromEntries(
    (Object.keys(SERVICES) as ServiceKey[]).map((key) => [
      key,
      business.services.find((s) => s.name === SERVICES[key].name)!,
    ]),
  ) as Record<ServiceKey, (typeof business.services)[number]>;

  const tz = business.timezone;
  const today = localDateOf(now, tz);

  // Un bloqueo en la semana que viene, a la tarde del primer día hábil desde
  // dentro de 4. Los turnos de muestra no lo pisan.
  const blockDate = [4, 5, 6, 7].map((o) => addDays(today, o)).find((d) => [2, 3, 4, 5].includes(weekdayOf(d)));
  const block = blockDate && {
    startsAt: zonedInstant(blockDate, minutes("16:00"), tz),
    endsAt: zonedInstant(blockDate, minutes("20:00"), tz),
  };

  const rows = [];
  let n = 0;

  // De hace 3 días a dentro de 7.
  for (let offset = -3; offset <= 7; offset++) {
    const date = addDays(today, offset);
    const weekday = weekdayOf(date);
    const pattern =
      weekday === 6 ? SATURDAY_PATTERN : weekday >= 2 && weekday <= 5 ? WEEKDAY_PATTERNS[(offset + 3) % 3] : [];

    for (const [time, key] of pattern) {
      const service = serviceIds[key];
      const startsAt = zonedInstant(date, minutes(time), tz);
      const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
      if (block && startsAt < block.endsAt && block.startsAt < endsAt) continue;
      const [customerName, customerPhone] = CUSTOMERS[n % CUSTOMERS.length];
      const isPast = endsAt <= now;
      // Los turnos de días anteriores ya están resueltos; los de hoy quedan
      // confirmados, para poder probar "Realizado" y "Ausente" en el panel.
      const status = offset < 0 ? (n % 7 === 3 ? "NO_SHOW" : "COMPLETED") : n % 11 === 5 && !isPast ? "CANCELLED" : "CONFIRMED";

      rows.push({
        businessId: business.id,
        serviceId: service.id,
        startsAt,
        endsAt,
        status,
        customerName,
        customerEmail: `${slug(customerName)}@example.com`,
        customerPhone,
        notes: n % 6 === 1 ? NOTES[(n / 6) % NOTES.length | 0] : null,
        cancelToken: `demo${String(n).padStart(28, "0")}`,
        // Reservados con algunos días de anticipación; el recordatorio se
        // marca como ya resuelto para no generar una tanda de emails.
        createdAt: new Date(startsAt.getTime() - (2 + (n % 4)) * 86_400_000),
        reminderQueuedAt: now,
      } as const);
      n++;
    }
  }
  await db.appointment.createMany({ data: rows });

  if (block) {
    await db.timeOff.create({ data: { businessId: business.id, ...block, reason: "Capacitación" } });
  }

  return { business, appointments: rows.length };
}
