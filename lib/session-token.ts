import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "sw_session";

export type SessionPayload = {
  sub: string;
  role: "admin" | "client";
  companyId: string | null;
  email: string;
  name: string;
};

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET no está configurada.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(session: SessionPayload): Promise<string> {
  return new SignJWT({
    role: session.role,
    companyId: session.companyId,
    email: session.email,
    name: session.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub || (payload.role !== "admin" && payload.role !== "client")) return null;
    return {
      sub: payload.sub,
      role: payload.role,
      companyId: typeof payload.companyId === "string" ? payload.companyId : null,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
    };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}
