import { apiError, apiOk } from "@/lib/api";
import { clientIp } from "@/lib/audit";
import { linkExistingCustomer } from "@/lib/services/onboarding";
import { requireAdmin } from "@/lib/session";
import { inviteSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const data = inviteSchema.parse(await request.json());
    const result = await linkExistingCustomer({ ...data, actorId: session.sub, ip: clientIp(request) });
    return apiOk({
      ok: true,
      message: `${result.company.legalName} quedó vinculada. Estado en Bridge: ${result.bridgeStatus}. El contacto ya puede ingresar con el correo indicado.`,
    });
  } catch (error) {
    return apiError(error);
  }
}
