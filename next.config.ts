import type { NextConfig } from "next";

// Headers de seguridad básicos para todas las respuestas.
const securityHeaders = [
  // Nadie puede embeber la app en un iframe (evita clickjacking en el panel).
  { key: "X-Frame-Options", value: "DENY" },
  // El navegador no "adivina" tipos de archivo.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // A otros sitios sólo les llega el origen, nunca la ruta (que en /turno/… es secreta).
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
