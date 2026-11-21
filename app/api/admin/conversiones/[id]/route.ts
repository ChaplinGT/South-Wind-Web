import fs from "fs";
import path from "path";
import { apiError, apiOk } from "@/lib/api";
import { clientIp } from "@/lib/audit";
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
    const file = form.get("receipt");
    let receiptFile: string | undefined;
    if (file instanceof File && file.size > 0) {
      if (file.size > 5_000_000) throw new AppError("El comprobante no puede superar 5 MB.", 422);
      if (!["application/pdf", "image/png", "image/jpeg"].includes(file.type)) {
        throw new AppError("Adjunte un PDF, PNG o JPG.", 422);
      }
      const extension = file.type === "application/pdf" ? ".pdf" : file.type === "image/png" ? ".png" : ".jpg";
      receiptFile = `${id}-${Date.now()}${extension}`;
      const directory = path.join(process.cwd(), "storage", "receipts");
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, receiptFile), Buffer.from(await file.arrayBuffer()));
    }
    await updateConversion({
      id,
      actorId: session.sub,
      status: data.status,
      reference: data.reference,
      adminNote: data.adminNote,
      settledAmount: data.settledAmount,
      receiptFile,
      ip: clientIp(request),
    });
    return apiOk({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
