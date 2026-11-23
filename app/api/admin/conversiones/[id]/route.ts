import { apiError, apiOk } from "@/lib/api";
import { clientIp } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { updateConversion } from "@/lib/services/conversions";
import { requireAdmin } from "@/lib/session";
import { conversionUpdateSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await context.params;
    const form = await request.formData();
    const data = conversionUpdateSchema.parse({
      status: form.get("status"),
      reference: form.get("reference") || "",
      adminNote: form.get("adminNote") || "",
      settledAmount: form.get("settledAmount") || "",
    });
    await updateConversion({
      id,
      actorId: session.sub,
      status: data.status,
      reference: data.reference,
      adminNote: data.adminNote,
      settledAmount: data.settledAmount,
      ip: clientIp(request),
    });
    const file = form.get("receipt");
    if (file instanceof File && file.size > 0) {
      if (file.size > 5_000_000) throw new AppError("El comprobante no puede superar 5 MB.", 422);
      if (!["application/pdf", "image/png", "image/jpeg"].includes(file.type)) {
        throw new AppError("Adjunte un PDF, PNG o JPG.", 422);
      }
      const dataBytes = Buffer.from(await file.arrayBuffer());
      await prisma.conversionReceipt.upsert({
        where: { conversionId: id },
        update: { fileName: file.name || "comprobante", mime: file.type, data: dataBytes },
        create: { conversionId: id, fileName: file.name || "comprobante", mime: file.type, data: dataBytes },
      });
    }
    return apiOk({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
