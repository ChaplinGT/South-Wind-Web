import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { googleEnabled, googleRedirectUri, signOAuthState } from "@/lib/google";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session-token";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = request.headers.get("cookie") || "";
  const stored = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("sw_google="))?.slice("sw_google=".length);
  const [savedState, signature] = decodeURIComponent(stored || "").split(".");
  if (!googleEnabled() || !code || !state || state !== savedState || signature !== signOAuthState(state)) {
    return NextResponse.redirect(new URL("/ingresar?google=error", request.url));
  }
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) return NextResponse.redirect(new URL("/ingresar?google=error", request.url));
  const token = (await tokenResponse.json()) as { access_token?: string };
  const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!profileResponse.ok) return NextResponse.redirect(new URL("/ingresar?google=error", request.url));
  const profile = (await profileResponse.json()) as { sub?: string; email?: string; name?: string };
  if (!profile.email || !profile.sub) return NextResponse.redirect(new URL("/ingresar?google=error", request.url));
  const email = profile.email.toLowerCase();
  let user = await prisma.user.findFirst({ where: { OR: [{ googleSub: profile.sub }, { email }] } });
  if (!user) {
    user = await prisma.user.create({
      data: { email, name: profile.name || email, googleSub: profile.sub, role: "client", active: true },
    });
  } else if (!user.googleSub) {
    user = await prisma.user.update({ where: { id: user.id }, data: { googleSub: profile.sub } });
  }
  if (!user.active) return NextResponse.redirect(new URL("/ingresar?google=inactiva", request.url));
  const session = await signSession({
    sub: user.id,
    role: user.role === "admin" ? "admin" : "client",
    companyId: user.companyId,
    email: user.email,
    name: user.name,
  });
  const response = NextResponse.redirect(new URL(user.role === "admin" ? "/admin" : "/app", request.url));
  response.cookies.set(SESSION_COOKIE, session, sessionCookieOptions());
  response.cookies.set("sw_google", "", { path: "/", maxAge: 0 });
  return response;
}
