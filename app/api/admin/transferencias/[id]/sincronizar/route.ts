import { apiError, apiOk } from "@/lib/api";
import { audit, clientIp } from "@/lib/audit";
import { getBridge } from "@/lib/bridge";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { applyTransfer } from "@/lib/services/webhooks";
import { requireAdmin } from "@/lib/session";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await context.params;
    const transfer = await prisma.transfer.findUnique({ where: { id } });
    if (!transfer?.bridgeTransferId) throw new AppError("Esta transferencia no tiene identificador de Bridge.", 404);
    const remote = await getBridge().getTransfer(transfer.bridgeTransferId);
    await applyTransfer({
      event_id: `manual-${transfer.id}-${remote.updated_at}`,
      event_category: "transfer",
      event_type: "transfer.updated",
      event_object: remote as unknown as Record<string, unknown>,
      event_object_id: remote.id,
      event_object_status: remote.state,
    });
    await audit({
      actorId: session.sub,
      companyId: transfer.companyId,
      action: "transfer.update",
      entityType: "transfer",
      entityId: transfer.id,
      ip: clientIp(request),
      metadata: { state: remote.state },
    });
    return apiOk({ ok: true, state: remote.state });
  } catch (error) {
    return apiError(error);
  }
}
