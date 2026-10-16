// Prepara la base de los tests de integración: la crea si no existe y le
// aplica las migraciones pendientes. Cada test limpia sus propios datos.

import { execSync } from "node:child_process";
import { Client } from "pg";
import type { TestProject } from "vitest/node";

export default async function setup(project: TestProject) {
  const { testDatabaseUrl } = project.config.provide;
  if (!testDatabaseUrl) throw new Error("Falta testDatabaseUrl en vitest.config.mts");
  const url = new URL(testDatabaseUrl);
  const dbName = url.pathname.slice(1);

  // Salvaguarda: los tests borran datos. Nunca contra una base que no sea de tests.
  if (!/^\w+_test$/.test(dbName)) {
    throw new Error(`La base de tests debe terminar en "_test" (recibida: "${dbName}").`);
  }

  // CREATE DATABASE no admite IF NOT EXISTS: se consulta antes desde la base "postgres".
  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  adminUrl.search = "";
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (!rowCount) await admin.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await admin.end();
  }

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: "pipe",
  });
}

declare module "vitest" {
  export interface ProvidedContext {
    testDatabaseUrl: string;
  }
}
