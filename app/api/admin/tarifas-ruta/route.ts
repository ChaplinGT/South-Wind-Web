import { apiError, apiOk } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import { syncPricingToBridge } from "@/lib/services/pricing-sync";
import { setPricing, setSouthWindWallet } from "@/lib/settings";
import { requireAdmin } from "@/lib/session";
import { pricingSchema } from "@/lib/validation";
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
    const data = pricingSchema.parse(body);
    await setPricing({ ...data, feeConfigEnabled: data.feeConfigEnabled === "true" });
    const sync = await syncPricingToBridge();
    await audit({
      actorId: session.sub,
      action: "fee.update",
      entityType: "setting",
      entityId: "pricing",
      ip: clientIp(request),
      metadata: { ...data, ...sync },
    });
    return apiOk({ ok: true, ...sync });
  } catch (error) {
    return apiError(error);
  }
}
