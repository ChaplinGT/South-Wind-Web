import { prisma } from "../db";
import { audit } from "../audit";
import { mapKybStatus } from "../kyb";
import { receiveNetUsdc } from "../pricing";
import { getPricing } from "../settings";
import { drainConfirmsPayment, matchDrainOrder } from "../wallet-sends";
import { isFailureState } from "./ledger";
import { confirmWalletPayment } from "./orders";
import { provisionCompany } from "./provision";
import type { BridgeWebhookEvent } from "../bridge/types";

export async function processBridgeWebhook(event: BridgeWebhookEvent) {
  if (!event.event_id || !event.event_category) {
    return { status: "ignored", reason: "evento incompleto" };
  }
  const existing = await prisma.webhookEvent.findUnique({ where: { eventId: event.event_id } });
  if (existing) return { status: "duplicate" };

  let status = "processed";
  try {
    if (event.event_category === "customer") await applyCustomer(event);
    else if (event.event_category === "transfer") await applyTransfer(event);
    else if (event.event_category === "virtual_account.activity") await applyVirtualAccount(event);
    else if (event.event_category === "liquidation_address.drain" || event.event_category.startsWith("liquidation_address")) {
      await applyLiquidationDrain(event);
    } else status = "stored";
  } catch (error) {
    status = "error";
    console.error("webhook", event.event_id, error);
  }

  await prisma.webhookEvent.create({
    data: {
      eventId: event.event_id,
      category: event.event_category,
      eventType: event.event_type || event.event_category,
      payload: JSON.stringify(event),
      status,
    },
  });
  await audit({
    action: "webhook.processed",
    entityType: "webhook",
    entityId: event.event_id,
    metadata: { category: event.event_category, type: event.event_type, status },
  });
  return { status };
}

async function applyCustomer(event: BridgeWebhookEvent) {
  const object = event.event_object;
  const id = String(object.id ?? event.event_object_id ?? "");
  const bridgeStatus = String(object.status ?? event.event_object_status ?? "");
  if (!id) return;
  const company = await prisma.company.findUnique({ where: { bridgeCustomerId: id } });
  if (!company) return;
  const kybStatus = mapKybStatus(bridgeStatus);
  await prisma.company.update({
    where: { id: company.id },
    data: { bridgeKycStatus: bridgeStatus, kybStatus },
  });
  if (kybStatus === "approved") await provisionCompany(company.id);
}

export async function applyTransfer(event: BridgeWebhookEvent) {
  const object = event.event_object;
  const id = String(object.id ?? event.event_object_id ?? "");
  const state = String(object.state ?? event.event_object_status ?? "");
  if (!id || !state) return;
  const transfer = await prisma.transfer.findUnique({ where: { bridgeTransferId: id } });
  if (!transfer || transfer.state === state) return;
  await prisma.transfer.update({
    where: { id: transfer.id },
    data: {
      state,
      responseJson: JSON.stringify(object),
      settledAt: state === "payment_processed" ? new Date() : transfer.settledAt,
    },
  });
  if (isFailureState(state)) {
    const reversal = await prisma.ledgerEntry.findFirst({
      where: { transferId: transfer.id, kind: "payout_reversal" },
    });
    if (!reversal) {
      await prisma.ledgerEntry.create({
        data: {
          companyId: transfer.companyId,
          postedAt: new Date(),
          reference: `${transfer.reference}-REV`,
          description: `Reverso de pago ${transfer.reference} · estado ${state}`,
          debit: "0.00",
          credit: transfer.totalDebit,
          kind: "payout_reversal",
          transferId: transfer.id,
        },
      });
    }
  }
}

async function applyLiquidationDrain(event: BridgeWebhookEvent) {
  const object = event.event_object;
  const state = String(object.state ?? event.event_object_status ?? "");
  if (!drainConfirmsPayment(state)) return;
  const liquidationId = String(object.liquidation_address_id ?? "");
  const amount = String(object.amount ?? "");
  const drainId = String(object.id ?? event.event_object_id ?? "");
  const txHash = String(object.deposit_tx_hash ?? object.destination_tx_hash ?? "");
  if (!liquidationId) return;
  if (drainId) {
    const used = await prisma.paymentOrder.findFirst({ where: { drainId } });
    if (used) return;
  }
  const beneficiary = await prisma.beneficiary.findFirst({ where: { liquidationId } });
  if (!beneficiary) return;
  const pending = await prisma.paymentOrder.findMany({
    where: {
      beneficiaryId: beneficiary.id,
      kind: "wallet",
      paymentLegStatus: { not: "confirmado" },
      status: { not: "pagado" },
    },
    orderBy: { createdAt: "asc" },
  });
  const orderId = matchDrainOrder(
    pending.map((order) => ({ id: order.id, usdcAmount: order.usdcAmount, createdAt: order.createdAt.getTime() })),
    amount,
  );
  if (!orderId) return;
  await confirmWalletPayment(orderId, txHash, drainId || undefined);
}

async function applyVirtualAccount(event: BridgeWebhookEvent) {
  const object = event.event_object;
  const type = String(object.type ?? "");
  if (type !== "payment_processed") return;
  const customerId = String(object.customer_id ?? "");
  const amount = String(object.amount ?? "");
  const eventId = String(object.id ?? event.event_object_id ?? event.event_id);
  if (!customerId || !amount || !eventId) return;
  const company = await prisma.company.findUnique({ where: { bridgeCustomerId: customerId } });
  if (!company) return;
  const reference = `VA-${eventId.slice(0, 12)}`;
  const vaId = String(object.virtual_account_id ?? "");
  const virtualAccount = vaId
    ? await prisma.virtualAccount.findFirst({ where: { bridgeVirtualAccountId: vaId, companyId: company.id } })
    : null;
  if (virtualAccount?.destinationMode === "southwind") {
    const existing = await prisma.liquidacionBob.findFirst({ where: { companyId: company.id, reference } });
    if (existing) return;
    const bank = await prisma.bolivianAccount.findFirst({ where: { companyId: company.id, isDefault: true } });
    const pricing = await getPricing();
    const bridgeCollectsFlat = virtualAccount.feeMode === "fee_config";
    const net = receiveNetUsdc(amount, pricing.fixedReceiveFeeUsd, !bridgeCollectsFlat);
    await prisma.liquidacionBob.create({
      data: {
        companyId: company.id,
        virtualAccountId: virtualAccount.id,
        bolivianAccountId: bank?.id,
        usdcAmount: net.gross,
        fixedFeeUsd: bridgeCollectsFlat ? pricing.fixedReceiveFeeUsd : net.fixedFeeUsd,
        fixedFeeBearer: bridgeCollectsFlat ? "bridge" : "portal",
        netUsdcAmount: net.net,
        status: "pendiente",
        reference,
        adminNote: bridgeCollectsFlat
          ? "Bridge ya retuvo el cargo fijo con fee_config. La tasa se fija al marcar pagado."
          : "El cargo fijo se descuenta en esta liquidación. La tasa se fija al marcar pagado.",
      },
    });
    return;
  }
  const duplicate = await prisma.ledgerEntry.findFirst({ where: { companyId: company.id, reference } });
  if (duplicate) return;
  await prisma.ledgerEntry.create({
    data: {
      companyId: company.id,
      postedAt: new Date(String(object.created_at ?? new Date().toISOString())),
      reference,
      description: "Depósito USD recibido en cuenta virtual y acreditado en USDC",
      debit: "0.00",
      credit: amount,
      kind: "deposit",
    },
  });
}
