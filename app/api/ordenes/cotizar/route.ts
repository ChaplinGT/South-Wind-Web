import { apiError, apiOk } from "@/lib/api";
import { priceDirectOrder } from "@/lib/services/orders";
import { requireClient } from "@/lib/session";
import { paymentOrderSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    await requireClient();
    const data = paymentOrderSchema.parse(await request.json());
    const quote = await priceDirectOrder(data.usdcAmount);
    return apiOk({ ok: true, ...quote });
  } catch (error) {
    return apiError(error);
  }
}
