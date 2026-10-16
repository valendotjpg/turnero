import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

// En desarrollo, el hot reload de Next.js re-evalúa los módulos y crearía un
// cliente (y un pool de conexiones) nuevo en cada cambio. Se guarda una única
// instancia en globalThis para reutilizarla.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  // DATABASE_URL es la conexión con pooler (en Neon, el host termina en
  // "-pooler"): la indicada para tráfico serverless. Las migraciones usan la
  // directa (ver prisma.config.ts).
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // attachDatabasePool sólo engancha el pool si este valor está definido.
    idleTimeoutMillis: 5_000,
  });
  // En Vercel (Fluid compute), mantiene viva la función hasta que el pool
  // libera sus conexiones ociosas, en vez de dejarlas colgadas al suspenderla.
  // Fuera de Vercel no hace nada.
  attachDatabasePool(pool);
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
