import { prisma } from "../db";
import { audit } from "../audit";
import { AppError } from "../errors";
import { formatAmount } from "../format";
import { canTransact } from "../kyb";
import { isMockMode } from "../env";
import { getMockBridge } from "../bridge/mock";
import { add, cmp, sub } from "../money";
import { companyBalance } from "./ledger";

export async function createConversion(input: {
  companyId: string;
  actorId: string;
  direction: "usdc_to_bob" | "bob_to_usdc";
  amount: string;
  bolivianAccountId: string;
  note?: string;
  ip?: string | null;
}) {
  const company = await prisma.company.findUnique({ where: { id: input.companyId } });
  if (!company) throw new AppError("No encontramos la empresa.", 404);
  if (!canTransact(company.kybStatus)) {
    throw new AppError("Su verificación todavía no está aprobada para solicitar conversiones.", 403);
  }
  const account = await prisma.bolivianAccount.findFirst({
    where: { id: input.bolivianAccountId, companyId: company.id },
  });
  if (!account) throw new AppError("Seleccione una cuenta bancaria en Bolivia.", 422);
  if (input.direction === "usdc_to_bob") {
    const balance = await companyBalance(company.id);
    const open = await prisma.conversionRequest.findMany({
      where: { companyId: company.id, direction: "usdc_to_bob", status: { in: ["pendiente", "en_proceso"] } },
    });
    const reserved = open.reduce((total, item) => add(total, item.amount), "0.00");
    if (cmp(balance, add(reserved, input.amount)) < 0) {
      throw new AppError(
        `Saldo insuficiente. Disponible: ${formatAmount(balance)}. Ya hay ${formatAmount(reserved)} en solicitudes abiertas.`,
        422,
      );
    }
  }
  const snapshot = `${account.bankName} · ${account.accountType === "ahorro" ? "Caja de ahorro" : "Cuenta corriente"} · ${account.accountNumber} · ${account.accountHolder}`;
  const conversion = await prisma.conversionRequest.create({
    data: {
      companyId: company.id,
      direction: input.direction,
      amount: input.amount,
      sourceCurrency: input.direction === "usdc_to_bob" ? "usdc" : "bob",
      targetCurrency: input.direction === "usdc_to_bob" ? "bob" : "usdc",
      bolivianAccountId: account.id,
      bankSnapshot: snapshot,
      status: "pendiente",
      adminNote: input.note || null,
    },
  });
  await audit({
    actorId: input.actorId,
    companyId: company.id,
    action: "conversion.create",
    entityType: "conversion",
    entityId: conversion.id,
    ip: input.ip,
    metadata: { direction: input.direction, amount: input.amount },
  });
  return conversion;
}

export async function updateConversion(input: {
  id: string;
  actorId: string;
  status: "pendiente" | "en_proceso" | "pagado";
  reference?: string;
  adminNote?: string;
  settledAmount?: string;
  receiptFile?: string | null;
  ip?: string | null;
}) {
  const conversion = await prisma.conversionRequest.findUnique({ where: { id: input.id } });
  if (!conversion) throw new AppError("No encontramos la solicitud.", 404);
  const wasPaid = conversion.status === "pagado";
  let creditAmount = conversion.amount;
  if (input.status === "pagado" && !wasPaid && conversion.direction === "usdc_to_bob") {
    const balance = await companyBalance(conversion.companyId);
    if (cmp(balance, conversion.amount) < 0) {
      throw new AppError("La empresa no tiene saldo USDC suficiente para marcar esta conversión como pagada.", 422);
    }
  }
  if (input.status === "pagado" && !wasPaid && conversion.direction === "bob_to_usdc") {
    if (!input.settledAmount || !/^\d+(\.\d{1,2})?$/.test(input.settledAmount) || Number(input.settledAmount) <= 0) {
      throw new AppError("Indique los USDC acreditados al marcar la conversión como pagada.", 422);
    }
    creditAmount = input.settledAmount;
  }
  const updated = await prisma.conversionRequest.update({
    where: { id: conversion.id },
    data: {
      status: input.status,
      reference: input.reference || conversion.reference,
      adminNote: input.adminNote ?? conversion.adminNote,
      receiptFile: input.receiptFile ?? conversion.receiptFile,
    },
  });
  if (input.status === "pagado" && !wasPaid) {
    const reference = updated.reference || `CONV-${updated.id.slice(-6).toUpperCase()}`;
    if (!updated.reference) {
      await prisma.conversionRequest.update({ where: { id: updated.id }, data: { reference } });
    }
    const existing = await prisma.ledgerEntry.findFirst({ where: { conversionId: updated.id } });
    if (!existing) {
      const outgoing = updated.direction === "usdc_to_bob";
      await prisma.ledgerEntry.create({
        data: {
          companyId: updated.companyId,
          postedAt: new Date(),
          reference,
          description: outgoing
            ? `Conversión de USDC a bolivianos · solicitud ${reference}`
            : `Conversión de bolivianos a USDC · solicitud ${reference}`,
          debit: outgoing ? updated.amount : "0.00",
          credit: outgoing ? "0.00" : creditAmount,
          kind: outgoing ? "conversion_out" : "conversion_in",
          conversionId: updated.id,
        },
      });
      if (isMockMode()) {
        const company = await prisma.company.findUnique({ where: { id: updated.companyId } });
        if (company?.bridgeCustomerId) {
          const delta = outgoing ? sub("0.00", updated.amount) : creditAmount;
          getMockBridge().adjustUsdc(company.bridgeCustomerId, delta);
        }
      }
    }
  }
  await audit({
    actorId: input.actorId,
    companyId: conversion.companyId,
    action: "conversion.update",
    entityType: "conversion",
    entityId: conversion.id,
    ip: input.ip,
    metadata: { status: input.status, reference: input.reference },
  });
  return updated;
}
