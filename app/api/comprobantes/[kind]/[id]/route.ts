import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { isMockMode } from "@/lib/env";
import { formatAmount, formatDateTime } from "@/lib/format";
import { directionLabel, labelOf, transferStateLabel } from "@/lib/labels";
import { railLabel } from "@/lib/rails";
import { renderReceiptPdf } from "@/lib/statements/pdf";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ kind: string; id: string }> }) {
  try {
    const session = await requireUser();
    const { kind, id } = await context.params;
    const companyId = session.role === "admin" ? undefined : session.companyId;
    if (kind === "pago") {
      const transfer = await prisma.transfer.findFirst({
        where: { id, ...(companyId ? { companyId } : {}) },
        include: { company: true },
      });
      if (!transfer) throw new AppError("No encontramos el pago.", 404);
      const pdf = await renderReceiptPdf({
        mock: isMockMode(),
        title: "Comprobante de pago",
        number: transfer.reference,
        issuedAt: transfer.createdAt,
        company: { legalName: transfer.company.legalName, nit: transfer.company.nit || "—" },
        amountLabel: "Total debitado de USDC",
        amount: formatAmount(transfer.totalDebit),
        rows: [
          { label: "Beneficiario", value: transfer.beneficiaryName },
          { label: "Riel", value: railLabel(transfer.rail) },
          { label: "Monto", value: formatAmount(transfer.amount) },
          { label: "Comisión South Wind", value: formatAmount(transfer.developerFee) },
          { label: "Estado", value: labelOf(transferStateLabel, transfer.state) },
          { label: "Referencia Bridge", value: transfer.bridgeTransferId || "—" },
          { label: "Fecha", value: formatDateTime(transfer.createdAt) },
        ],
      });
      return pdfResponse(pdf, `comprobante-${transfer.reference}.pdf`);
    }
    if (kind === "conversion") {
      const conversion = await prisma.conversionRequest.findFirst({
        where: { id, ...(companyId ? { companyId } : {}) },
        include: { company: true },
      });
      if (!conversion) throw new AppError("No encontramos la conversión.", 404);
      const pdf = await renderReceiptPdf({
        mock: isMockMode(),
        title: "Comprobante de conversión",
        number: conversion.reference || conversion.id.slice(-8).toUpperCase(),
        issuedAt: conversion.updatedAt,
        company: { legalName: conversion.company.legalName, nit: conversion.company.nit || "—" },
        amountLabel: "Monto de la solicitud",
        amount: formatAmount(conversion.amount, conversion.sourceCurrency),
        rows: [
          { label: "Dirección", value: labelOf(directionLabel, conversion.direction) },
          { label: "Cuenta en Bolivia", value: conversion.bankSnapshot },
          { label: "Estado", value: conversion.status },
          { label: "Referencia", value: conversion.reference || "—" },
          { label: "Fecha", value: formatDateTime(conversion.updatedAt) },
        ],
      });
      return pdfResponse(pdf, `comprobante-${conversion.reference || conversion.id}.pdf`);
    }
    throw new AppError("Tipo de comprobante no reconocido.", 404);
  } catch (error) {
    return apiError(error);
  }
}

function pdfResponse(pdf: Buffer, filename: string) {
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
