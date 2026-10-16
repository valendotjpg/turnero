/**
 * Texto legible de un error, para guardarlo o loguearlo. Contempla los
 * AggregateError de Node (por ejemplo, al fallar la conexión por IPv4 y por
 * IPv6), que llegan con `message` vacío y el detalle en `errors`.
 */
export function describeError(error: unknown): string {
  if (error instanceof AggregateError && error.errors.length > 0) {
    const inner = [...new Set(error.errors.map(describeError))].join(" / ");
    return error.message ? `${error.message}: ${inner}` : inner;
  }
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return error.message || (typeof code === "string" ? code : error.name);
  }
  return String(error);
}
