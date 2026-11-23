import { apiError, apiOk } from "@/lib/api";
import { clientIp } from "@/lib/audit";
import { updatePaymentOrder } from "@/lib/services/orders";
import { requireAdmin } from "@/lib/session";
import { z } from "zod";

const schema = z.object({
  status: z.enum(["pendiente", "en_proceso", "pagado"]),
  txHash: z.string().trim().optional().default(""),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await context.params;
    const data = schema.parse(await request.json());
    await updatePaymentOrder({ id, actorId: session.sub, status: data.status, txHash: data.txHash, ip: clientIp(request) });
    return apiOk({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
