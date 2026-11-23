import { apiError, apiOk } from "@/lib/api";
import { clientIp } from "@/lib/audit";
import { createBeneficiary } from "@/lib/services/beneficiaries";
import { requireClient } from "@/lib/session";
import { beneficiarySchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const session = await requireClient();
    const data = beneficiarySchema.parse(await request.json());
    const beneficiary = await createBeneficiary({
      companyId: session.companyId,
      actorId: session.sub,
      data,
      ip: clientIp(request),
    });
    return apiOk({ ok: true, id: beneficiary.id }, 201);
  } catch (error) {
    return apiError(error);
  }
}
