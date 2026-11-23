import { apiError, apiOk } from "@/lib/api";
import { openReceiveAccount } from "@/lib/services/profiles";
import { requireUser } from "@/lib/session";
import { virtualAccountRequestSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const session = await requireUser();
    const data = virtualAccountRequestSchema.parse(await request.json());
    const account = await openReceiveAccount(session.sub, data);
    return apiOk({ ok: true, id: account.id });
  } catch (error) {
    return apiError(error);
  }
}