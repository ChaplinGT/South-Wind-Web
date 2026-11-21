import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { DEMO_PASSWORD, DEMO_STATEMENT, demoCompanies, type DemoCompany } from "../lib/demo-data";
import { rails } from "../lib/rails";
import { generateStatement } from "../lib/services/statements";

const prisma = new PrismaClient();

function instructions(company: DemoCompany) {
  return {
    id: company.virtualAccountId,
    customer_id: company.bridgeCustomerId,
    status: "activated",
    developer_fee_percent: "0.50",
    source_deposit_instructions: {
      currency: "usd",
      payment_rails: ["ach_push", "fednow", "wire"],
      bank_name: "Lead Bank",
      bank_address: "1801 Main St., Kansas City, MO 64108",
      bank_beneficiary_name: company.legalName,
      bank_beneficiary_address: "Domicilio registrado: [completar dirección en Montana]",
      bank_account_number: company.accountNumber,
      bank_routing_number: company.routingNumber,
    },
    destination: {
      currency: "usdc",
      payment_rail: "base",
      address: company.walletAddress,
      bridge_wallet_id: company.walletId,
    },
  };
}

async function main() {
  fs.rmSync(path.join(process.cwd(), "storage", "bridge-mock.json"), { force: true });
  await prisma.webhookEvent.deleteMany();
  await prisma.idempotencyRecord.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.statement.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.transfer.deleteMany();
  await prisma.conversionRequest.deleteMany();
  await prisma.virtualAccount.deleteMany();
  await prisma.beneficiary.deleteMany();
  await prisma.bolivianAccount.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();
  await prisma.setting.deleteMany();

  await prisma.setting.create({ data: { key: "feePercent", value: process.env.SOUTH_WIND_FEE_PERCENT || "0.50" } });
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const admin = await prisma.user.create({
    data: {
      email: "admin@southwind.example",
      passwordHash,
      name: "Equipo South Wind",
      role: "admin",
    },
  });

  for (const company of demoCompanies) {
    const row = await prisma.company.create({
      data: {
        legalName: company.legalName,
        tradeName: company.tradeName,
        nit: company.nit,
        email: company.email,
        phone: company.phone,
        address: company.address,
        city: company.city,
        clientType: company.clientType,
        contactName: company.contactName,
        bridgeCustomerId: company.bridgeCustomerId,
        bridgeWalletId: company.walletId,
        walletAddress: company.walletAddress,
        walletChain: "base",
        kybStatus: "approved",
        bridgeKycStatus: "active",
        onboardingSource: "invited",
      },
    });
    await prisma.user.create({
      data: {
        email: company.email,
        passwordHash,
        name: company.contactName,
        role: "client",
        companyId: row.id,
      },
    });
    const bob = await prisma.bolivianAccount.create({
      data: { companyId: row.id, ...company.bob, isDefault: true },
    });
    const beneficiaryIds = new Map<string, string>();
    for (const beneficiary of company.beneficiaries) {
      const created = await prisma.beneficiary.create({
        data: {
          companyId: row.id,
          bridgeExternalAccountId: beneficiary.bridgeId,
          nickname: beneficiary.nickname,
          rail: beneficiary.rail,
          currency: rails[beneficiary.rail].currency,
          accountOwnerName: beneficiary.accountOwnerName,
          bankName: beneficiary.bankName,
          accountLast4: beneficiary.last4,
          country: beneficiary.country,
          status: "active",
        },
      });
      beneficiaryIds.set(beneficiary.bridgeId, created.id);
    }
    await prisma.virtualAccount.create({
      data: {
        companyId: row.id,
        bridgeVirtualAccountId: company.virtualAccountId,
        status: "activated",
        currency: "usd",
        instructionsJson: JSON.stringify(instructions(company)),
      },
    });
    const transferIds = new Map<string, string>();
    for (const entry of company.ledger) {
      if (entry.kind !== "payout" || !entry.bridgeTransferId || !entry.principal || !entry.fee) continue;
      const transfer = await prisma.transfer.create({
        data: {
          companyId: row.id,
          bridgeTransferId: entry.bridgeTransferId,
          idempotencyKey: `seed-${entry.reference}`,
          amount: entry.principal,
          developerFee: entry.fee,
          totalDebit: entry.debit,
          currency: rails[company.beneficiaries.find((item) => item.bridgeId === entry.beneficiaryBridgeId)?.rail ?? "ach"].currency,
          rail: company.beneficiaries.find((item) => item.bridgeId === entry.beneficiaryBridgeId)?.rail ?? "ach",
          beneficiaryId: entry.beneficiaryBridgeId ? beneficiaryIds.get(entry.beneficiaryBridgeId) : null,
          beneficiaryName: company.beneficiaries.find((item) => item.bridgeId === entry.beneficiaryBridgeId)?.accountOwnerName ?? "",
          state: entry.state ?? "payment_processed",
          reference: entry.reference,
          description: entry.description,
          responseJson: "{}",
          createdAt: new Date(entry.postedAt),
          settledAt: entry.state === "payment_processed" ? new Date(entry.postedAt) : null,
        },
      });
      transferIds.set(entry.reference, transfer.id);
    }
    const conversionIds = new Map<string, string>();
    for (const conversion of company.conversions) {
      const created = await prisma.conversionRequest.create({
        data: {
          companyId: row.id,
          direction: conversion.direction,
          amount: conversion.amount,
          sourceCurrency: conversion.direction === "usdc_to_bob" ? "usdc" : "bob",
          targetCurrency: conversion.direction === "usdc_to_bob" ? "bob" : "usdc",
          bolivianAccountId: bob.id,
          bankSnapshot: `${bob.bankName} · ${bob.accountNumber} · ${bob.accountHolder}`,
          status: conversion.status,
          reference: conversion.reference,
          adminNote: conversion.adminNote,
          createdAt: new Date(conversion.createdAt),
        },
      });
      conversionIds.set(conversion.reference, created.id);
    }
    for (const entry of company.ledger) {
      await prisma.ledgerEntry.create({
        data: {
          companyId: row.id,
          postedAt: new Date(entry.postedAt),
          reference: entry.reference,
          description: entry.description,
          debit: entry.debit,
          credit: entry.credit,
          kind: entry.kind,
          transferId: transferIds.get(entry.reference) ?? null,
          conversionId: conversionIds.get(entry.reference) ?? null,
        },
      });
    }
  }

  const andina = await prisma.company.findUniqueOrThrow({ where: { nit: "1029384756" } });
  await generateStatement({
    companyId: andina.id,
    year: DEMO_STATEMENT.year,
    month: DEMO_STATEMENT.month,
    actorId: admin.id,
    statementNumber: DEMO_STATEMENT.number,
    verification: DEMO_STATEMENT.verificationCode,
  });
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "fee.update",
      entityType: "setting",
      entityId: "feePercent",
      metadata: JSON.stringify({ feePercent: "0.50", note: "Valor de referencia del MVP" }),
    },
  });
  console.log("Datos de demostración listos.");
  console.log(`Admin: admin@southwind.example / ${DEMO_PASSWORD}`);
  console.log(`Cliente: maria.quispe@importadora-andina.example / ${DEMO_PASSWORD}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
