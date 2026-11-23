import { apiError, apiOk } from "@/lib/api";
import { clientIp } from "@/lib/audit";
import { createPayout } from "@/lib/services/payments";
import { requireClient } from "@/lib/session";
import { paymentSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const session = await requireClient();
    const data = paymentSchema.parse(await request.json());
    const result = await createPayout({
      companyId: session.companyId,
      actorId: session.sub,
      beneficiaryId: data.beneficiaryId,
      amount: data.amount,
      fiatAmount: data.fiatAmount,
      rail: data.rail,
      reference: data.reference,
      idempotencyKey: data.idempotencyKey,
      ip: clientIp(request),
    });
    return apiOk(result as Record<string, unknown>, 201);
  } catch (error) {
    return apiError(error);
  }
}
