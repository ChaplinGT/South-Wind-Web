import { apiError, apiOk } from "@/lib/api";
import { clientIp } from "@/lib/audit";
import { startKyb } from "@/lib/services/onboarding";
import { requireClient } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const session = await requireClient();
    const company = await startKyb(session.companyId, session.sub, clientIp(request));
    return apiOk({ ok: true, url: company?.kybLinkUrl ?? null });
  } catch (error) {
    return apiError(error);
  }
}
