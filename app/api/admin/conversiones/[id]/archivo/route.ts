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
    const receipt = await prisma.conversionReceipt.findUnique({ where: { conversionId: id } });
    if (!receipt) throw new AppError("Esta solicitud no tiene un comprobante adjunto.", 404);
    return new NextResponse(new Uint8Array(receipt.data), {
      headers: {
        "Content-Type": receipt.mime,
        "Content-Disposition": `inline; filename="${receipt.fileName.replace(/"/g, "")}"`,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
