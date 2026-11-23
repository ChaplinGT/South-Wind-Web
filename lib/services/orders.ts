import { prisma } from "../db";
import { audit } from "../audit";
import { AppError } from "../errors";
import { bobReference } from "../rates";
import { getBobMarkupPercent, getPayoutDirectFeePercent } from "../settings";
import { usdcForBobPayment } from "../orders";

export async function createPaymentOrder(input: {
  companyId: string;
  actorId: string;
  beneficiaryId: string;
  bobAmount: string;
  ip?: string | null;
}) {
  const beneficiary = await prisma.beneficiary.findFirst({
    where: { id: input.beneficiaryId, companyId: input.companyId, status: "active" },
  });
  if (!beneficiary?.liquidationAddress) {
    throw new AppError("Ese beneficiario todavía no tiene dirección de liquidación.", 409);
  }
  const markup = Number(await getBobMarkupPercent());
  const quote = await bobReference(markup);
  if (!quote.venta) throw new AppError("No hay un tipo de cambio de venta disponible. Intente más tarde.", 503);
  const feePercent = await getPayoutDirectFeePercent();
  const priced = usdcForBobPayment(input.bobAmount, quote.venta, feePercent);
  const order = await prisma.paymentOrder.create({
    data: {
      companyId: input.companyId,
      beneficiaryId: beneficiary.id,
      bobAmount: input.bobAmount,
      rate: priced.rate,
      usdcAmount: priced.usdcAmount,
      feePercent,
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
    metadata: { bobAmount: input.bobAmount, usdcAmount: priced.usdcAmount, rate: priced.rate },
  });
  return order;
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
  const updated = await prisma.liquidacionBob.update({
    where: { id: row.id },
    data: {
      status: input.status,
      reference: input.reference || row.reference,
      adminNote: input.adminNote ?? row.adminNote,
    },
  });
  await audit({
    actorId: input.actorId,
    companyId: row.companyId,
    action: "conversion.update",
    entityType: "liquidacion_bob",
    entityId: row.id,
    ip: input.ip,
    metadata: { status: input.status },
  });
  return updated;
}
