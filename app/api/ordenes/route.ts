import { apiError, apiOk } from "@/lib/api";
import { clientIp } from "@/lib/audit";
import { createPaymentOrder } from "@/lib/services/orders";
import { requireClient } from "@/lib/session";
import { paymentOrderSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const session = await requireClient();
    const data = paymentOrderSchema.parse(await request.json());
    const order = await createPaymentOrder({
      companyId: session.companyId,
      actorId: session.sub,
      beneficiaryId: data.beneficiaryId,
      usdcAmount: data.usdcAmount,
      ip: clientIp(request),
    });
    return apiOk(
      {
        ok: true,
        id: order.id,
        rate: order.rate,
        usdcAmount: order.usdcAmount,
        principalBob: order.principalBob,
        fixedFeeUsd: order.fixedFeeUsd,
        fixedFeeBob: order.fixedFeeBob,
        bobAmount: order.bobAmount,
        sendFeeUsdc: order.sendFeeUsdc,
        beneficiaryUsdc: order.beneficiaryUsdc,
      },
      201,
    );
  } catch (error) {
    return apiError(error);
  }
}
