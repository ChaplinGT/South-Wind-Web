import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireAdmin } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const conversion = await prisma.conversionRequest.findUnique({ where: { id } });
    if (!conversion?.receiptFile) throw new AppError("Esta solicitud no tiene un comprobante adjunto.", 404);
    const filePath = path.join(process.cwd(), "storage", "receipts", path.basename(conversion.receiptFile));
    if (!fs.existsSync(filePath)) throw new AppError("No encontramos el archivo del comprobante.", 404);
    const body = fs.readFileSync(filePath);
    const type = filePath.endsWith(".pdf") ? "application/pdf" : filePath.endsWith(".png") ? "image/png" : "image/jpeg";
    return new NextResponse(new Uint8Array(body), { headers: { "Content-Type": type } });
  } catch (error) {
    return apiError(error);
  }
}
