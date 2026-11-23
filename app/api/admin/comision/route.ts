import { apiError, apiOk } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import { setFeePercent } from "@/lib/settings";
import { requireAdmin } from "@/lib/session";
import { feeSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const data = feeSchema.parse(await request.json());
    await setFeePercent(data.feePercent);
    await audit({
      actorId: session.sub,
      action: "fee.update",
      entityType: "setting",
      entityId: "feePercent",
      ip: clientIp(request),
      metadata: { feePercent: data.feePercent },
    });
    return apiOk({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
