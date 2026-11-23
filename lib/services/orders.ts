import { prisma } from "../db";
import { audit } from "../audit";
import { AppError } from "../errors";
import { feeAmount } from "../money";
import { quoteBobProceeds, quoteDirectSend } from "../pricing";
import { bobReference } from "../rates";
import { getPricing, getSouthWindWallet } from "../settings";
import { findRecentUsdcTransfers, receiptPaysFee } from "../usdc-watch";
import { assignFeeTransfers, statusFromLegs, usdcToRaw } from "../wallet-sends";
import { usdcToken } from "../chains";

async function freshBob(markup: string) {
  try {
    return await bobReference(Number(markup), 60_000);
  } catch {
    throw new AppError("No se pudo obtener el tipo de cambio. Intente más tarde.", 503);
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
      kind: "bob",
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

export async function quoteSelfSend(input: { companyId: string; beneficiaryId: string; usdcAmount: string }) {
  const beneficiary = await prisma.beneficiary.findFirst({
    where: { id: input.beneficiaryId, companyId: input.companyId, status: "active" },
  });
  if (!beneficiary?.liquidationAddress || !beneficiary.liquidationChain) {
    throw new AppError("Ese beneficiario todavía no tiene dirección de liquidación.", 409);
  }
  const feeAddress = (await getSouthWindWallet(beneficiary.liquidationChain)).trim();
  if (!feeAddress) {
    throw new AppError("Esa red todavía no está disponible. Elija otra o intente más tarde.", 409);
  }
  const pricing = await getPricing();
  return {
    usdcAmount: input.usdcAmount,
    fixedFeeUsd: pricing.fixedSendFeeUsd,
    feeAddress,
    feeChain: beneficiary.liquidationChain,
    liquidationAddress: beneficiary.liquidationAddress,
    sendFeePercent: pricing.sendFeePercent,
    sendFeeUsdc: feeAmount(input.usdcAmount, pricing.sendFeePercent),
  };
}

export async function createSelfSendOrder(input: {
  companyId: string;
  actorId: string;
  beneficiaryId: string;
  usdcAmount: string;
  ip?: string | null;
}) {
  const quote = await quoteSelfSend(input);
  const order = await prisma.paymentOrder.create({
    data: {
      companyId: input.companyId,
      beneficiaryId: input.beneficiaryId,
      bobAmount: "0.00",
      rate: "0.0000",
      usdcAmount: quote.usdcAmount,
      feePercent: quote.sendFeePercent,
      fixedFeeUsd: quote.fixedFeeUsd,
      status: "pendiente",
      kind: "wallet",
      feeAddress: quote.feeAddress,
      feeChain: quote.feeChain,
      feeLegStatus: "pendiente",
      paymentLegStatus: "pendiente",
      reference: `WAL-${Date.now().toString().slice(-6)}`,
    },
  });
  await audit({
    actorId: input.actorId,
    companyId: input.companyId,
    action: "conversion.create",
    entityType: "payment_order",
    entityId: order.id,
    ip: input.ip,
    metadata: { kind: "wallet", usdcAmount: quote.usdcAmount, fixedFeeUsd: quote.fixedFeeUsd, feeChain: quote.feeChain },
  });
  await reconcileWalletFees(input.companyId);
  const fresh = await prisma.paymentOrder.findUnique({ where: { id: order.id } });
  return {
    ...quote,
    ...order,
    ...(fresh ?? {}),
    feeAddress: quote.feeAddress,
    liquidationAddress: quote.liquidationAddress,
    sendFeeUsdc: quote.sendFeeUsdc,
    sendFeePercent: quote.sendFeePercent,
    status: fresh?.status ?? order.status,
    feeLegStatus: fresh?.feeLegStatus ?? order.feeLegStatus,
    paymentLegStatus: fresh?.paymentLegStatus ?? order.paymentLegStatus,
  };
}

async function markLeg(orderId: string, leg: "fee" | "payment", txHash: string, drainId?: string) {
  const current = await prisma.paymentOrder.findUnique({ where: { id: orderId } });
  if (!current || current.kind !== "wallet") return current;
  if (leg === "fee" && current.feeLegStatus === "confirmado") return current;
  if (leg === "payment" && current.paymentLegStatus === "confirmado") return current;
  const feeLeg = leg === "fee" ? "confirmado" : current.feeLegStatus;
  const paymentLeg = leg === "payment" ? "confirmado" : current.paymentLegStatus;
  return prisma.paymentOrder.update({
    where: { id: current.id },
    data: {
      feeLegStatus: feeLeg,
      paymentLegStatus: paymentLeg,
      feeTxHash: leg === "fee" ? txHash : current.feeTxHash,
      paymentTxHash: leg === "payment" ? txHash || current.paymentTxHash : current.paymentTxHash,
      drainId: drainId || current.drainId,
      status: statusFromLegs(feeLeg, paymentLeg),
    },
  });
}

export async function confirmWalletFeeByAdmin(orderId: string, txHash: string, actorId: string, ip?: string | null) {
  const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } });
  if (!order || order.kind !== "wallet") throw new AppError("Esa orden no es un pago desde la billetera del cliente.", 404);
  if (order.feeLegStatus === "confirmado") return order;
  const token = order.feeChain ? usdcToken(order.feeChain) : null;
  const decimals = token?.decimals ?? (order.feeChain === "solana" ? 6 : null);
  if (order.feeChain && order.feeAddress && decimals !== null) {
    const checked = await receiptPaysFee(order.feeChain, txHash, order.feeAddress, usdcToRaw(order.fixedFeeUsd || "0", decimals));
    if (checked === false) {
      throw new AppError("Ese hash no incluye un envío de USDC de al menos el cargo fijo a la dirección de South Wind.", 422);
    }
  }
  const updated = await markLeg(order.id, "fee", txHash);
  await audit({
    actorId,
    companyId: order.companyId,
    action: "conversion.update",
    entityType: "payment_order",
    entityId: order.id,
    ip,
    metadata: { feeTxHash: txHash, status: updated?.status },
  });
  return updated;
}

export async function confirmWalletPayment(orderId: string, txHash: string, drainId?: string) {
  return markLeg(orderId, "payment", txHash, drainId);
}

export async function reconcileWalletFees(companyId?: string) {
  const orders = await prisma.paymentOrder.findMany({
    where: {
      kind: "wallet",
      status: "pendiente",
      feeLegStatus: { not: "confirmado" },
      ...(companyId ? { companyId } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
  if (orders.length === 0) return;
  const usedRows = await prisma.paymentOrder.findMany({
    where: { feeTxHash: { not: null } },
    select: { feeTxHash: true },
  });
  const used = new Set(usedRows.map((row) => row.feeTxHash).filter((hash): hash is string => Boolean(hash)));
  const groups = new Map<string, typeof orders>();
  for (const order of orders) {
    if (!order.feeChain || !order.feeAddress || !order.fixedFeeUsd) continue;
    const key = `${order.feeChain}\n${order.feeAddress}`;
    groups.set(key, [...(groups.get(key) ?? []), order]);
  }
  for (const [key, group] of groups) {
    const [chain, address] = key.split("\n");
    const decimals = usdcToken(chain)?.decimals ?? (chain === "solana" ? 6 : null);
    if (!chain || !address || decimals === null) continue;
    const transfers = await findRecentUsdcTransfers(chain, address);
    if (!transfers) continue;
    const assignments = assignFeeTransfers(
      group.map((order) => ({
        id: order.id,
        feeRaw: usdcToRaw(order.fixedFeeUsd || "0", decimals),
        createdAt: order.createdAt.getTime(),
      })),
      transfers,
      used,
    );
    for (const assignment of assignments) {
      await markLeg(assignment.orderId, "fee", assignment.txHash);
      used.add(assignment.txHash);
    }
  }
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
  if (order.kind === "wallet") {
    if (!input.txHash?.trim()) {
      throw new AppError("Indique el hash del envío del cargo fijo a South Wind.", 422);
    }
    return confirmWalletFeeByAdmin(order.id, input.txHash.trim(), input.actorId, input.ip);
  }
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
