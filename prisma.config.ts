import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Las migraciones necesitan una conexión directa; la app puede usar una
    // con pooler (en Neon, DATABASE_URL es la "pooled" y DIRECT_URL la directa).
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
