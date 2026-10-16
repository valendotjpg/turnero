import path from "node:path";
import { defineConfig } from "vitest/config";

// Base exclusiva para los tests de integración: se borra y se recrea en cada corrida.
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://turnero:turnero@localhost:5433/turnero_test?schema=public";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.int.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["src/**/*.int.test.ts"],
          env: { DATABASE_URL: TEST_DATABASE_URL },
          provide: { testDatabaseUrl: TEST_DATABASE_URL },
          globalSetup: ["src/test/integration-setup.ts"],
          // Comparten la base: un archivo a la vez.
          fileParallelism: false,
        },
      },
    ],
  },
});
