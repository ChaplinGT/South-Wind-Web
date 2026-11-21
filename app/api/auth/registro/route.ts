import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { clientIp } from "@/lib/audit";
import { registerCompany } from "@/lib/services/onboarding";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session-token";
import { registerSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const data = registerSchema.parse(await request.json());
    const { user } = await registerCompany(data, clientIp(request));
    const token = await signSession({
      sub: user.id,
      role: "client",
      companyId: user.companyId,
      email: user.email,
      name: user.name,
    });
    const response = NextResponse.json({ ok: true, redirect: "/app/verificacion" });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    return apiError(error);
  }
}
