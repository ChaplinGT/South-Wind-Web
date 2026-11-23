import { apiError, apiOk } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import { setRouteFees, setSouthWindWallet } from "@/lib/settings";
import { requireAdmin } from "@/lib/session";
import { routeFeeSchema } from "@/lib/validation";
import { z } from "zod";

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = await request.json();
    if (body.kind === "wallet") {
      const data = z.object({ chain: z.string().min(2), address: z.string().trim().min(8) }).parse(body);
      await setSouthWindWallet(data.chain, data.address);
      await audit({
        actorId: session.sub,
        action: "fee.update",
        entityType: "setting",
        entityId: `swWallet:${data.chain}`,
        ip: clientIp(request),
        metadata: { chain: data.chain },
      });
      return apiOk({ ok: true });
    }
    const data = routeFeeSchema.parse(body);
    await setRouteFees(data.payoutDirectFeePercent, data.payoutWalletFeePercent, data.vaDeveloperFeePercent);
    await audit({
      actorId: session.sub,
      action: "fee.update",
      entityType: "setting",
      entityId: "routeFees",
      ip: clientIp(request),
      metadata: data,
    });
    return apiOk({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
