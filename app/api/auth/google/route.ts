import { NextResponse } from "next/server";
import { googleAuthUrl, googleEnabled, newOAuthState } from "@/lib/google";

export async function GET(request: Request) {
  if (!googleEnabled()) {
    return NextResponse.redirect(new URL("/ingresar?google=no", request.url));
  }
  const { state, signature } = newOAuthState();
  const response = NextResponse.redirect(googleAuthUrl(state));
  response.cookies.set("sw_google", `${state}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return response;
}
