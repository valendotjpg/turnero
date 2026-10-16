// Carga el negocio de demostración. Es idempotente: si ya existe, lo borra
// (en cascada) y lo vuelve a crear con turnos alrededor de la fecha actual.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { DEMO_OWNER_EMAIL, DEMO_OWNER_PASSWORD } from "../src/lib/demo";
import { resetDemoBusiness } from "../src/lib/demo-data";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const { business, appointments } = await resetDemoBusiness(prisma);
  console.log(`Negocio de demo creado: ${business.name} (/reservar/${business.slug}), ${appointments} turnos`);
  console.log(`Panel: /panel · ${DEMO_OWNER_EMAIL} / ${DEMO_OWNER_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
