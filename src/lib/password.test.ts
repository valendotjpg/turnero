import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("hashPassword / verifyPassword", () => {
  it("verifica la contraseña correcta y rechaza otra", async () => {
    const hash = await hashPassword("caballo-bateria-grapa");
    expect(await verifyPassword("caballo-bateria-grapa", hash)).toBe(true);
    expect(await verifyPassword("caballo-bateria-grapa ", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("guarda el algoritmo y sus parámetros, y nunca la contraseña", async () => {
    const hash = await hashPassword("secreto");
    expect(hash).toMatch(/^scrypt\$32768\$8\$3\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(hash).not.toContain("secreto");
  });

  it("usa una sal distinta en cada hash", async () => {
    expect(await hashPassword("igual")).not.toBe(await hashPassword("igual"));
  });

  it("trata igual las formas Unicode equivalentes de una contraseña", async () => {
    const composed = "contraseña"; // ñ como un solo carácter
    const decomposed = "contraseña"; // n + tilde combinable
    expect(await verifyPassword(decomposed, await hashPassword(composed))).toBe(true);
  });

  it.each(["", "texto-plano", "bcrypt$10$abc", "scrypt$1$2$3$sal"])(
    "rechaza un hash guardado mal formado: %j",
    async (stored) => {
      expect(await verifyPassword("lo-que-sea", stored)).toBe(false);
    },
  );
});
