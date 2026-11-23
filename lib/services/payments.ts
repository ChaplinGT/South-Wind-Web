import { prisma } from "../db";
import { audit } from "../audit";
import { getBridge } from "../bridge";
import { AppError } from "../errors";
import { formatAmount } from "../format";
import { assertIdempotency, beginIdempotency, finishIdempotency, hashRequest } from "../idempotency";
import { canTransact } from "../kyb";
import { cmp, fromCents, toCents } from "../money";
import { quoteWalletSend } from "../pricing";
import { isRail, rails } from "../rails";
import { bobBuyPerUsdc, destinationPerUsdc } from "../send-rates";
import {
  combinedSendPercent,
  fixedFeeForMethod,
  methodsForCurrency,
  quoteFromReceiveAmount,
} from "../send-quote";
import { getPricing } from "../settings";
import { companyBalance } from "./ledger";
import QRCode from "qrcode";

const BOB_DEPOSIT_BENEFICIARY = "Gabriel Terrazas";

export async function createPayout(input: {
  companyId: string;
  actorId: string;
  beneficiaryId: string;
  amount: string;
  fiatAmount?: string;
  rail?: string;
  reference: string;
  idempotencyKey: string;
  ip?: string | null;
}) {
  if (input.fiatAmount) return createQuotedPayout(input);
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

  const pricing = await getPricing();
  const quoted = quoteWalletSend(
    input.amount,
    pricing.sendFeePercent,
    pricing.walletSurchargePercent,
    pricing.fixedSendFeeUsd,
  );
  const fee = quoted.fee;
  const total = quoted.total;
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

  const body = { ok: true, mode: "wallet", transferId: transfer.id, state: transfer.state, fee, total, replayed: false };
  await finishIdempotency(input.idempotencyKey, 201, body);
  return body;
}

async function createQuotedPayout(input: {
  companyId: string;
  actorId: string;
  beneficiaryId: string;
  amount: string;
  fiatAmount?: string;
  rail?: string;
  reference: string;
  idempotencyKey: string;
  ip?: string | null;
}) {
  const existing = await prisma.transfer.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    const parsed = JSON.parse(existing.responseJson) as { clientInstructions?: Record<string, unknown> };
    if (parsed.clientInstructions) {
      return { ok: true, mode: "instructions", transferId: existing.id, replayed: true, ...parsed.clientInstructions };
    }
    return { ok: true, mode: "wallet", transferId: existing.id, state: existing.state, fee: existing.developerFee, total: existing.totalDebit, replayed: true };
  }
  const company = await prisma.company.findUnique({ where: { id: input.companyId } });
  if (!company) throw new AppError("No encontramos la empresa.", 404);
  if (!canTransact(company.kybStatus)) {
    throw new AppError("Su verificación todavía no está aprobada. Cuando lo esté, podrá enviar pagos.", 403);
  }
  const beneficiary = await prisma.beneficiary.findFirst({
    where: { id: input.beneficiaryId, companyId: company.id, status: "active" },
  });
  if (!beneficiary?.bridgeExternalAccountId) throw new AppError("Seleccione un beneficiario activo.", 422);
  const pricing = await getPricing();
  const choices = methodsForCurrency(beneficiary.currency, {
    ach: pricing.fixedSendFeeUsd,
    wire: pricing.wireFixedFeeUsd,
    standard: pricing.fixedSendFeeUsd,
  });
  const method = choices.find((item) => item.id === input.rail) ?? choices[0];
  if (!method) throw new AppError("Seleccione el tipo de transferencia.", 422);
  const fromWallet = Boolean(company.bridgeWalletId);
  const fxPerUsd = await destinationPerUsdc(method.currency);
  const quoted = quoteFromReceiveAmount({
    fiatAmount: input.fiatAmount || input.amount,
    fxPerUsd,
    fixedFee: fixedFeeForMethod(method.id, {
      ach: pricing.fixedSendFeeUsd,
      wire: pricing.wireFixedFeeUsd,
      standard: pricing.fixedSendFeeUsd,
    }),
    percent: combinedSendPercent(pricing.sendFeePercent, pricing.walletSurchargePercent, fromWallet),
  });
  if (fromWallet) {
    if (!company.bridgeCustomerId) throw new AppError("Su cuenta todavía no está lista para enviar pagos.", 409);
    const balance = await companyBalance(company.id);
    if (cmp(balance, quoted.usdcTotal) < 0) {
      throw new AppError(
        `Saldo insuficiente. Disponible: ${formatAmount(balance)}. Esta operación requiere ${formatAmount(quoted.usdcTotal)}.`,
        422,
      );
    }
    const bridgeTransfer = await getBridge().createTransfer(
      {
        amount: quoted.principalUsdc,
        on_behalf_of: company.bridgeCustomerId,
        developer_fee: quoted.totalFees,
        client_reference_id: input.reference,
        source: { payment_rail: "bridge_wallet", currency: "usdc", bridge_wallet_id: company.bridgeWalletId },
        destination: {
          payment_rail: method.bridgeRail,
          currency: method.currency,
          external_account_id: beneficiary.bridgeExternalAccountId,
        },
      },
      input.idempotencyKey,
    );
    const description = `Pago ${method.label} a ${beneficiary.accountOwnerName}`;
    const transfer = await prisma.transfer.create({
      data: {
        companyId: company.id,
        bridgeTransferId: bridgeTransfer.id,
        idempotencyKey: input.idempotencyKey,
        amount: quoted.principalUsdc,
        developerFee: quoted.totalFees,
        totalDebit: quoted.usdcTotal,
        currency: method.currency,
        rail: method.id === "fps" ? "fps" : isRail(method.id) ? method.id : beneficiary.rail,
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
        debit: quoted.usdcTotal,
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
      metadata: { mode: "wallet", rail: method.id, total: quoted.usdcTotal },
    });
    return { ok: true, mode: "wallet", transferId: transfer.id, state: transfer.state, fee: quoted.totalFees, total: quoted.usdcTotal, replayed: false };
  }

  const chain = beneficiary.liquidationChain || "polygon";
  let deposit: { to_address?: string; payment_rail?: string; amount?: string } | null = null;
  if (company.bridgeCustomerId) {
    try {
      const remote = await getBridge().createTransfer(
        {
          amount: quoted.principalUsdc,
          on_behalf_of: company.bridgeCustomerId,
          developer_fee: quoted.totalFees,
          client_reference_id: input.reference,
          source: { payment_rail: chain, currency: "usdc" },
          destination: {
            payment_rail: method.bridgeRail,
            currency: method.currency,
            external_account_id: beneficiary.bridgeExternalAccountId,
          },
        },
        input.idempotencyKey,
      );
      const instructions = remote.source_deposit_instructions as { to_address?: string; payment_rail?: string; amount?: string } | undefined;
      if (instructions?.to_address) deposit = instructions;
    } catch {
      deposit = null;
    }
  }
  const address = deposit?.to_address || beneficiary.liquidationAddress || "";
  const blockchain = deposit?.payment_rail || beneficiary.liquidationChain || chain;
  const sendAmount = deposit?.amount || quoted.usdcTotal;
  if (!address) throw new AppError("No hay una dirección disponible para este pago.", 409);
  const bobRate = await bobBuyPerUsdc();
  const bobAmount = fromCents(Math.round(toCents(sendAmount) * bobRate));
  const clientInstructions = {
    blockchain,
    address,
    amount: sendAmount,
    currency: "USDC",
    bankName: beneficiary.bankName,
    accountOwnerName: beneficiary.accountOwnerName,
    railLabel: method.label,
    destinationCurrency: method.currency.toUpperCase(),
    accountLast4: beneficiary.accountLast4,
    fiatAmount: quoted.fiatAmount,
    usdcTotal: quoted.usdcTotal,
    fixedFee: quoted.fixedFee,
    percentFee: quoted.percentFee,
    totalFees: quoted.totalFees,
    percent: quoted.percent,
    fxPerUsd: method.currency === "usd" ? null : fxPerUsd,
    bobAmount,
    bobPayee: BOB_DEPOSIT_BENEFICIARY,
    qr: await QRCode.toDataURL(address, { margin: 1, width: 180 }),
  };
  const transfer = await prisma.transfer.create({
    data: {
      companyId: company.id,
      idempotencyKey: input.idempotencyKey,
      amount: quoted.principalUsdc,
      developerFee: quoted.totalFees,
      totalDebit: quoted.usdcTotal,
      currency: method.currency,
      rail: isRail(method.id) ? method.id : beneficiary.rail,
      beneficiaryId: beneficiary.id,
      beneficiaryName: beneficiary.accountOwnerName,
      state: "awaiting_funds",
      reference: input.reference,
      description: `Instrucciones de pago ${method.label} a ${beneficiary.accountOwnerName}`,
      responseJson: JSON.stringify({ clientInstructions }),
    },
  });
  await audit({
    actorId: input.actorId,
    companyId: company.id,
    action: "transfer.create",
    entityType: "transfer",
    entityId: transfer.id,
    ip: input.ip,
    metadata: { mode: "instructions", rail: method.id },
  });
  return { ok: true, mode: "instructions", transferId: transfer.id, state: "awaiting_funds", replayed: false, ...clientInstructions };
}
