import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { renderPaymentInstructionsPdf } from "@/lib/statements/pdf";
import { requireClient } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireClient();
    const { id } = await context.params;
    const transfer = await prisma.transfer.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!transfer) throw new AppError("No encontramos las instrucciones.", 404);
    const parsed = JSON.parse(transfer.responseJson) as {
      clientInstructions?: {
        blockchain?: string;
        address?: string;
        amount?: string;
        currency?: string;
        bankName?: string;
        accountOwnerName?: string;
        railLabel?: string;
        destinationCurrency?: string;
        accountLast4?: string;
        destinationLines?: { label: string; value: string }[];
      };
    };
    const instructions = parsed.clientInstructions;
    if (!instructions?.address) throw new AppError("Este pago no tiene instrucciones para descargar.", 404);
    const pdf = await renderPaymentInstructionsPdf({
      blockchain: instructions.blockchain || "—",
      address: instructions.address,
      amount: instructions.amount || transfer.totalDebit,
      currency: instructions.currency || "USDC",
      bankName: instructions.bankName || "—",
      accountOwnerName: instructions.accountOwnerName || transfer.beneficiaryName,
      railLabel: instructions.railLabel || "—",
      destinationCurrency: instructions.destinationCurrency || transfer.currency.toUpperCase(),
      accountLast4: instructions.accountLast4 || "—",
      reference: transfer.reference,
      destinationLines: instructions.destinationLines,
    });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="instrucciones-${transfer.reference}.pdf"`,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
