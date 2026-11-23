import { prisma } from "../db";
import { audit } from "../audit";
import { AppError } from "../errors";
import { quoteBobProceeds, quoteDirectSend } from "../pricing";
import { bobReference } from "../rates";
import { getPricing } from "../settings";

async function freshBob(markup: string) {
  try {
    return await bobReference(Number(markup), 60_000);
  } catch {
    throw new AppError("No se pudo leer el tipo de cambio de Binance. Intente más tarde.", 503);
  }
}

export async function priceDirectOrder(usdcAmount: string) {
  const pricing = await getPricing();
  const quote = await freshBob(pricing.bobMarkupPercent);
  if (!quote.compra) throw new AppError("No hay un tipo de cambio de compra disponible. Intente más tarde.", 503);
  return quoteDirectSend({
    usdcAmount,
    buyRate: quote.compra,
    fixedFeeUsd: pricing.fixedSendFeeUsd,
    sendFeePercent: pricing.sendFeePercent,
  });
}

export async function createPaymentOrder(input: {
  companyId: string;
  actorId: string;
  beneficiaryId: string;
  usdcAmount: string;
  ip?: string | null;
}) {
  const beneficiary = await prisma.beneficiary.findFirst({
    where: { id: input.beneficiaryId, companyId: input.companyId, status: "active" },
  });
  if (!beneficiary?.liquidationAddress) {
    throw new AppError("Ese beneficiario todavía no tiene dirección de liquidación.", 409);
  }
  const priced = await priceDirectOrder(input.usdcAmount);
  const order = await prisma.paymentOrder.create({
    data: {
      companyId: input.companyId,
      beneficiaryId: beneficiary.id,
      bobAmount: priced.bobAmount,
      principalBob: priced.principalBob,
      fixedFeeUsd: priced.fixedFeeUsd,
      fixedFeeBob: priced.fixedFeeBob,
      rate: priced.rate,
      usdcAmount: priced.usdcAmount,
      feePercent: priced.sendFeePercent,
      status: "pendiente",
      reference: `ORD-${Date.now().toString().slice(-6)}`,
    },
  });
  await audit({
    actorId: input.actorId,
    companyId: input.companyId,
    action: "conversion.create",
    entityType: "payment_order",
    entityId: order.id,
    ip: input.ip,
    metadata: {
      bobAmount: priced.bobAmount,
      usdcAmount: priced.usdcAmount,
      rate: priced.rate,
      fixedFeeUsd: priced.fixedFeeUsd,
    },
  });
  return { ...order, sendFeeUsdc: priced.sendFeeUsdc, beneficiaryUsdc: priced.beneficiaryUsdc };
}

export async function updatePaymentOrder(input: {
  id: string;
  actorId: string;
  status: "pendiente" | "en_proceso" | "pagado";
  txHash?: string;
  ip?: string | null;
}) {
  const order = await prisma.paymentOrder.findUnique({ where: { id: input.id } });
  if (!order) throw new AppError("No encontramos la orden de pago.", 404);
  if (input.status === "pagado" && !input.txHash?.trim()) {
    throw new AppError("Indique el hash de la transacción al marcar la orden como pagada.", 422);
  }
  const updated = await prisma.paymentOrder.update({
    where: { id: order.id },
    data: { status: input.status, txHash: input.txHash?.trim() || order.txHash },
  });
  await audit({
    actorId: input.actorId,
    companyId: order.companyId,
    action: "conversion.update",
    entityType: "payment_order",
    entityId: order.id,
    ip: input.ip,
    metadata: { status: input.status, txHash: updated.txHash },
  });
  return updated;
}

export async function updateLiquidacion(input: {
  id: string;
  actorId: string;
  status: "pendiente" | "en_proceso" | "pagado";
  reference?: string;
  adminNote?: string;
  ip?: string | null;
}) {
  const row = await prisma.liquidacionBob.findUnique({ where: { id: input.id } });
  if (!row) throw new AppError("No encontramos la liquidación.", 404);
  const data: {
    status: string;
    reference?: string | null;
    adminNote?: string | null;
    rate?: string;
    bobAmount?: string;
    quotedAt?: Date;
  } = {
    status: input.status,
    reference: input.reference || row.reference,
    adminNote: input.adminNote ?? row.adminNote,
  };
  if (input.status === "pagado" && !row.rate) {
    const pricing = await getPricing();
    const quote = await freshBob(pricing.bobMarkupPercent);
    if (!quote.venta) throw new AppError("No hay un tipo de cambio de venta disponible. Intente más tarde.", 503);
    const net = row.netUsdcAmount || row.usdcAmount;
    const priced = quoteBobProceeds(net, quote.venta);
    data.rate = priced.rate;
    data.bobAmount = priced.bobAmount;
    data.quotedAt = new Date(quote.at);
  }
  const updated = await prisma.liquidacionBob.update({ where: { id: row.id }, data });
  await audit({
    actorId: input.actorId,
    companyId: row.companyId,
    action: "conversion.update",
    entityType: "liquidacion_bob",
    entityId: row.id,
    ip: input.ip,
    metadata: { status: input.status, rate: updated.rate, bobAmount: updated.bobAmount },
  });
  return updated;
}
