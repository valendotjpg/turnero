// Carga un negocio de demostración. Es idempotente: si el negocio ya existe,
// lo borra (en cascada) y lo vuelve a crear.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { DEMO_BUSINESS_SLUG, DEMO_OWNER_EMAIL, DEMO_OWNER_PASSWORD } from "../src/lib/demo";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** "09:30" → 570 */
function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

async function main() {
  await prisma.business.deleteMany({ where: { slug: DEMO_BUSINESS_SLUG } });

  const business = await prisma.business.create({
    data: {
      name: "Barbería Demo",
      slug: DEMO_BUSINESS_SLUG,
      phone: "+54 11 5555-0000",
      address: "Av. Siempreviva 742, CABA",
      services: {
        create: [
          { name: "Corte de pelo", durationMinutes: 30, priceCents: 1_200_000 },
          { name: "Corte + barba", durationMinutes: 45, priceCents: 1_800_000 },
          { name: "Arreglo de barba", durationMinutes: 20, priceCents: 800_000 },
          {
            name: "Coloración",
            description: "Incluye lavado y secado.",
            durationMinutes: 90,
            priceCents: 3_500_000,
          },
        ],
      },
      users: {
        create: {
          name: "Julio",
          email: DEMO_OWNER_EMAIL,
          passwordHash: await hashPassword(DEMO_OWNER_PASSWORD),
        },
      },
      // Martes a viernes con horario cortado, sábado de corrido.
      workingHours: {
        create: [
          ...[2, 3, 4, 5].flatMap((weekday) => [
            { weekday, startMinute: toMinutes("09:00"), endMinute: toMinutes("13:00") },
            { weekday, startMinute: toMinutes("16:00"), endMinute: toMinutes("20:00") },
          ]),
          { weekday: 6, startMinute: toMinutes("09:00"), endMinute: toMinutes("17:00") },
        ],
      },
    },
  });

  console.log(`Negocio de demo creado: ${business.name} (/reservar/${business.slug})`);
  console.log(`Panel: /panel · ${DEMO_OWNER_EMAIL} / ${DEMO_OWNER_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
