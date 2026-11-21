import { prisma } from "../db";
import { audit } from "../audit";
import { mapKybStatus } from "../kyb";
import { isFailureState } from "./ledger";
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
    else status = "stored";
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
