import { apiError, apiOk } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/session";
import { bolivianAccountSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const session = await requireClient();
    const data = bolivianAccountSchema.parse(await request.json());
    await prisma.bolivianAccount.updateMany({ where: { companyId: session.companyId }, data: { isDefault: false } });
    const account = await prisma.bolivianAccount.create({
      data: { companyId: session.companyId, ...data, isDefault: true },
    });
    return apiOk({ ok: true, id: account.id }, 201);
  } catch (error) {
    return apiError(error);
  }
}
