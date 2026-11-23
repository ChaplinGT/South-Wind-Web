import { apiError, apiOk } from "@/lib/api";
import { priceDirectOrder, quoteSelfSend } from "@/lib/services/orders";
import { requireClient } from "@/lib/session";
import { paymentOrderSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const session = await requireClient();
    const data = paymentOrderSchema.parse(await request.json());
    if (data.kind === "wallet") {
      const quote = await quoteSelfSend({
        companyId: session.companyId,
        beneficiaryId: data.beneficiaryId,
        usdcAmount: data.usdcAmount,
      });
      return apiOk({ ok: true, kind: "wallet", ...quote });
    }
    const quote = await priceDirectOrder(data.usdcAmount);
    return apiOk({ ok: true, kind: "bob", ...quote });
  } catch (error) {
    return apiError(error);
  }
}
