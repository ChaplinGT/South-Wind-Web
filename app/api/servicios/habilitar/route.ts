import { apiError, apiOk } from "@/lib/api";
import { clientIp } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { enableProfile } from "@/lib/services/profiles";
import { requireUser } from "@/lib/session";
import { enableProfileSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const session = await requireUser();
    if (session.role !== "client") {
      throw new AppError("Esta acción es solo para clientes.", 403);
    }
    const data = enableProfileSchema.parse(await request.json());
    const company = await enableProfile(session.sub, data, clientIp(request));
    return apiOk({ ok: true, id: company.id, url: company.kybLinkUrl });
  } catch (error) {
    return apiError(error);
  }
}
