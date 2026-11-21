import { cookies } from "next/headers";
import { prisma } from "./db";
import { AppError } from "./errors";
import { SESSION_COOKIE, verifySession, type SessionPayload } from "./session-token";

export async function readSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function requireUser(): Promise<SessionPayload> {
  const session = await readSession();
  if (!session) throw new AppError("Debe iniciar sesión para continuar.", 401);
  return session;
}

export async function requireClient(): Promise<SessionPayload & { companyId: string }> {
  const session = await requireUser();
  if (session.role !== "client" || !session.companyId) {
    throw new AppError("Esta acción es solo para empresas clientes.", 403);
  }
  return session as SessionPayload & { companyId: string };
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireUser();
  if (session.role !== "admin") {
    throw new AppError("Esta acción es solo para el equipo de South Wind.", 403);
  }
  return session;
}

export async function requireCompany(companyId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new AppError("No encontramos la empresa.", 404);
  return company;
}
