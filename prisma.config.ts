import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Las migraciones necesitan una conexión directa (sin pooler): por el
    // pooler fallan con errores como "prepared statement already exists".
    // Neon (y su integración con Vercel) la entrega como DATABASE_URL_UNPOOLED;
    // DIRECT_URL permite definirla con otro proveedor.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"],
  },
});
