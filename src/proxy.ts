// Filtro optimista del panel: sin cookie de sesión, redirige al login antes de
// renderizar nada. No consulta la base (corre en cada request, incluidos los
// prefetch), así que no valida la sesión: eso lo hace la DAL (src/server/dal.ts).

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

export function proxy(request: NextRequest) {
  const isLogin = request.nextUrl.pathname === "/panel/login";
  if (!isLogin && !request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/panel/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/panel/:path*"],
};
