import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session-token";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  const path = request.nextUrl.pathname;

  if (path.startsWith("/app")) {
    if (!session) return NextResponse.redirect(new URL("/ingresar", request.url));
    if (session.role !== "client") return NextResponse.redirect(new URL("/admin", request.url));
  }
  if (path.startsWith("/admin")) {
    if (!session) return NextResponse.redirect(new URL("/ingresar", request.url));
    if (session.role !== "admin") return NextResponse.redirect(new URL("/app", request.url));
  }
  if ((path === "/ingresar" || path === "/abrir-cuenta") && session) {
    return NextResponse.redirect(new URL(session.role === "admin" ? "/admin" : "/app", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*", "/ingresar", "/abrir-cuenta"],
};
