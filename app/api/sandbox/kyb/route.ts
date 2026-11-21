import { apiError, apiOk } from "@/lib/api";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { approveMockKyb } from "@/lib/services/onboarding";
import { requireUser } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const session = await requireUser();
    const body = (await request.json()) as { customerId?: string };
    if (!body.customerId) throw new AppError("Falta el identificador del cliente.", 400);
    const company = await prisma.company.findUnique({ where: { bridgeCustomerId: body.customerId } });
    if (!company) throw new AppError("No encontramos la empresa de esta verificación.", 404);
    if (session.role !== "admin" && session.companyId !== company.id) {
      throw new AppError("Esta verificación corresponde a otra empresa.", 403);
    }
    await approveMockKyb(body.customerId, session.sub);
    return apiOk({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
