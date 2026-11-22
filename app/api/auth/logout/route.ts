import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session-token";

function clearSession(request: Request, to: string) {
  const response = NextResponse.redirect(new URL(to, request.url), 303);
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}

export async function POST(request: Request) {
  return clearSession(request, "/");
}

export async function GET(request: Request) {
  return clearSession(request, "/ingresar");
}
