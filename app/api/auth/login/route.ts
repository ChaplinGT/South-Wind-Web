import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session-token";
import { loginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const type = request.headers.get("content-type") || "";
    const raw = type.includes("application/json")
      ? await request.json()
      : Object.fromEntries((await request.formData()).entries());
    const data = loginSchema.parse(raw);
    const user = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (!user || !user.active || !bcrypt.compareSync(data.password, user.passwordHash)) {
      throw new AppError(
        user && !user.active ? "Esta cuenta está desactivada." : "Correo o contraseña incorrectos.",
        401,
      );
    }
    const token = await signSession({
      sub: user.id,
      role: user.role === "admin" ? "admin" : "client",
      companyId: user.companyId,
      email: user.email,
      name: user.name,
    });
    const dest = user.role === "admin" ? "/admin" : "/app";
    if (!type.includes("application/json")) {
      const response = NextResponse.redirect(new URL(dest, request.url), 303);
      response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
      return response;
    }
    const response = NextResponse.json({ ok: true, redirect: dest });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    return apiError(error);
  }
}
