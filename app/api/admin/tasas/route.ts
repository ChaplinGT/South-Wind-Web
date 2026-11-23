import { apiError, apiOk } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import { setMarkups } from "@/lib/settings";
import { requireAdmin } from "@/lib/session";
import { markupSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const data = markupSchema.parse(await request.json());
    await setMarkups(data.bobMarkupPercent, data.fxMarkupPercent);
    await audit({
      actorId: session.sub,
      action: "markup.update",
      entityType: "setting",
      entityId: "markups",
      ip: clientIp(request),
      metadata: {
        bobMarkupPercent: data.bobMarkupPercent,
        fxMarkupPercent: data.fxMarkupPercent,
        at: new Date().toISOString(),
      },
    });
    return apiOk({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
