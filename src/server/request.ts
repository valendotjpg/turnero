import "server-only";
import { headers } from "next/headers";

/**
 * IP del cliente, para el rate limiting. Sólo es confiable detrás de una
 * plataforma que sobrescribe x-forwarded-for (como Vercel); sin proxy, el
 * cliente podría falsificarla. En desarrollo suele faltar: se usa "local".
 */
export async function clientIp(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headerList.get("x-real-ip") || "local";
}
