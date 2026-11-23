import { prisma } from "../db";
import { audit } from "../audit";
import { getBridge } from "../bridge";
import { AppError } from "../errors";
import { formatAmount } from "../format";
import { assertIdempotency, beginIdempotency, finishIdempotency, hashRequest } from "../idempotency";
import { canTransact } from "../kyb";
import { add, cmp, feeAmount } from "../money";
import { isRail, rails } from "../rails";
import { getPayoutWalletFeePercent } from "../settings";
import { companyBalance } from "./ledger";

export async function createPayout(input: {
  companyId: string;
  actorId: string;
  beneficiaryId: string;
  amount: string;
  reference: string;
  idempotencyKey: string;
  ip?: string | null;
}) {
  const existing = await prisma.transfer.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    return {
      ok: true,
      transferId: existing.id,
      state: existing.state,
      fee: existing.developerFee,
      total: existing.totalDebit,
      replayed: true,
    };
  }

  const company = await prisma.company.findUnique({ where: { id: input.companyId } });
  if (!company) throw new AppError("No encontramos la empresa.", 404);
  if (!canTransact(company.kybStatus)) {
    throw new AppError("Su verificación todavía no está aprobada. Cuando lo esté, podrá enviar pagos.", 403);
  }
  if (!company.bridgeCustomerId || !company.bridgeWalletId) {
    throw new AppError("Su cuenta todavía no tiene una billetera lista para enviar pagos.", 409);
  }

  const beneficiary = await prisma.beneficiary.findFirst({
    where: { id: input.beneficiaryId, companyId: company.id, status: "active" },
  });
  if (!beneficiary?.bridgeExternalAccountId || !isRail(beneficiary.rail)) {
    throw new AppError("Seleccione un beneficiario activo.", 422);
  }

  const feePercent = await getPayoutWalletFeePercent();
  const fee = feeAmount(input.amount, feePercent);
  const total = add(input.amount, fee);
  const balance = await companyBalance(company.id);
  if (cmp(balance, total) < 0) {
    throw new AppError(
      `Saldo insuficiente. Disponible: ${formatAmount(balance)}. Esta operación requiere ${formatAmount(total)}.`,
      422,
    );
  }

  const requestBody = {
    beneficiaryId: input.beneficiaryId,
    amount: input.amount,
    reference: input.reference,
    companyId: company.id,
  };
  const idem = await beginIdempotency(input.idempotencyKey, hashRequest(requestBody));
  if (idem.kind === "replay") return idem.body as Record<string, unknown>;
  assertIdempotency(idem);

  const rail = rails[beneficiary.rail];
  let bridgeTransfer;
  try {
    bridgeTransfer = await getBridge().createTransfer(
      {
        amount: input.amount,
        on_behalf_of: company.bridgeCustomerId,
        developer_fee: fee,
        client_reference_id: input.reference,
        source: {
          payment_rail: "bridge_wallet",
          currency: "usdc",
          bridge_wallet_id: company.bridgeWalletId,
        },
        destination: {
          payment_rail: rail.bridgeRail,
          currency: rail.currency,
          external_account_id: beneficiary.bridgeExternalAccountId,
        },
      },
      input.idempotencyKey,
    );
  } catch (error) {
    await prisma.idempotencyRecord.delete({ where: { key: input.idempotencyKey } }).catch(() => undefined);
    throw error;
  }

  const description = `Pago ${rail.label} a ${beneficiary.accountOwnerName} · principal ${formatAmount(input.amount)} · comisión ${formatAmount(fee)}`;
  const transfer = await prisma.transfer.create({
    data: {
      companyId: company.id,
      bridgeTransferId: bridgeTransfer.id,
      idempotencyKey: input.idempotencyKey,
      amount: input.amount,
      developerFee: fee,
      totalDebit: total,
      currency: rail.currency,
      rail: beneficiary.rail,
      beneficiaryId: beneficiary.id,
      beneficiaryName: beneficiary.accountOwnerName,
      state: bridgeTransfer.state,
      reference: input.reference,
      description,
      responseJson: JSON.stringify(bridgeTransfer),
      settledAt: bridgeTransfer.state === "payment_processed" ? new Date() : null,
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      companyId: company.id,
      postedAt: new Date(),
      reference: input.reference,
      description,
      debit: total,
      credit: "0.00",
      kind: "payout",
      transferId: transfer.id,
    },
  });

  await audit({
    actorId: input.actorId,
    companyId: company.id,
    action: "transfer.create",
    entityType: "transfer",
    entityId: transfer.id,
    ip: input.ip,
    metadata: { amount: input.amount, fee, total, state: transfer.state, rail: beneficiary.rail },
  });

  const body = { ok: true, transferId: transfer.id, state: transfer.state, fee, total, replayed: false };
  await finishIdempotency(input.idempotencyKey, 201, body);
  return body;
}
