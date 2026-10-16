// Hash de contraseñas con scrypt (incluido en Node, sin dependencias nativas).
//
// Formato guardado: scrypt$<N>$<r>$<p>$<sal base64>$<hash base64>. Los
// parámetros viajan con cada hash, así se pueden endurecer en el futuro sin
// invalidar las contraseñas existentes.

import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Una de las configuraciones recomendadas por OWASP (N=2^15, r=8, p=3):
// usa 32 MiB de memoria por hash, lo que encarece los ataques por GPU.
const PARAMS = { N: 2 ** 15, r: 8, p: 3 };
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

function deriveKey(password: string, salt: Buffer, { N, r, p }: typeof PARAMS) {
  // maxmem por defecto (32 MiB) queda justo; se deja margen para 128·N·r.
  const options: ScryptOptions = { N, r, p, maxmem: 256 * N * r };
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, options, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveKey(password, salt, PARAMS);
  const { N, r, p } = PARAMS;
  return ["scrypt", N, r, p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, N, r, p, salt, hash] = stored.split("$");
  if (algorithm !== "scrypt" || !hash) return false;

  const expected = Buffer.from(hash, "base64");
  const actual = await deriveKey(password, Buffer.from(salt, "base64"), {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });
  // Comparación en tiempo constante: no revela cuántos bytes coinciden.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
