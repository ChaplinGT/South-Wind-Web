import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { isValidEmail, otherAdminAction, resolveAdminEmail } from "../lib/admin-seed";
import { DEMO_PASSWORD, DEMO_STATEMENT, demoCompanies, type DemoCompany } from "../lib/demo-data";
import { PRICING_DEFAULTS } from "../lib/pricing";
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
  const defaults: [string, string][] = [
    ["feePercent", process.env.SOUTH_WIND_FEE_PERCENT || "0.50"],
    ["bobMarkupPercent", process.env.BOB_MARKUP_PERCENT || PRICING_DEFAULTS.bobMarkupPercent],
    ["fxMarkupPercent", process.env.FX_MARKUP_PERCENT || process.env.EUR_MARKUP_PERCENT || PRICING_DEFAULTS.fxMarkupPercent],
    ["vaDeveloperFeePercent", process.env.VA_DEVELOPER_FEE_PERCENT || PRICING_DEFAULTS.vaDeveloperFeePercent],
    ["sendFeePercent", PRICING_DEFAULTS.sendFeePercent],
    ["walletSurchargePercent", PRICING_DEFAULTS.walletSurchargePercent],
    ["fixedSendFeeUsd", PRICING_DEFAULTS.fixedSendFeeUsd],
    ["wireFixedFeeUsd", PRICING_DEFAULTS.wireFixedFeeUsd],
    ["fixedReceiveFeeUsd", PRICING_DEFAULTS.fixedReceiveFeeUsd],
    ["feeConfigEnabled", PRICING_DEFAULTS.feeConfigEnabled],
    ["bridgeOrchestrationPercent", PRICING_DEFAULTS.bridgeOrchestrationPercent],
    ["bridgeVaOrchestrationPercent", PRICING_DEFAULTS.bridgeVaOrchestrationPercent],
    ["bridgeUsdtSupportPercent", PRICING_DEFAULTS.bridgeUsdtSupportPercent],
    ["bridgeVaAccountFeeUsd", PRICING_DEFAULTS.bridgeVaAccountFeeUsd],
    ["bridgeVaAccountFeeMxn", PRICING_DEFAULTS.bridgeVaAccountFeeMxn],
    ["bridgeVaAccountFeeBrlCop", PRICING_DEFAULTS.bridgeVaAccountFeeBrlCop],
    ["bridgeWalletFeeUsd", PRICING_DEFAULTS.bridgeWalletFeeUsd],
    ["bridgeKycUsdYear", PRICING_DEFAULTS.bridgeKycUsdYear],
    ["bridgeKybUsdYear", PRICING_DEFAULTS.bridgeKybUsdYear],
  ];
  for (const [key, value] of defaults) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  const adminEmail = resolveAdminEmail(process.env.ADMIN_EMAIL);
  const adminPassword = process.env.ADMIN_PASSWORD || DEMO_PASSWORD;
  const clientPasswordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  const admin = existingAdmin
    ? await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          role: "admin",
          companyId: null,
          active: true,
          ...(process.env.ADMIN_PASSWORD
            ? { passwordHash: bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10) }
            : {}),
        },
      })
    : await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash: bcrypt.hashSync(adminPassword, 10),
          name: "Equipo South Wind",
          role: "admin",
          active: true,
        },
      });

  const otherAdmins = await prisma.user.findMany({
    where: { role: "admin", email: { not: adminEmail } },
    select: { id: true, email: true, active: true },
  });
  for (const other of otherAdmins) {
    const references = await prisma.auditLog.count({ where: { actorId: other.id } });
    const action = otherAdminAction(other.email, references > 0);
    if (action === "delete") {
      try {
        await prisma.user.delete({ where: { id: other.id } });
        console.log("Se eliminó un admin cuyo correo no es una dirección válida.");
        continue;
      } catch {
        if (other.active) {
          await prisma.user.update({ where: { id: other.id }, data: { active: false } });
        }
        console.log("No se pudo eliminar un admin con correo inválido; quedó desactivado. El correo no se imprime.");
        continue;
      }
    }
    if (!other.active) continue;
    await prisma.user.update({ where: { id: other.id }, data: { active: false } });
    if (isValidEmail(other.email)) {
      console.log(`Cuenta de admin desactivada: ${other.email}`);
    } else {
      console.log("Un admin con correo inválido quedó desactivado. El correo no se imprime.");
    }
  }

  for (const company of demoCompanies) {
    const already = await prisma.company.findUnique({ where: { nit: company.nit } });
    if (already) {
      console.log(`Ya existe ${company.legalName}; no se duplica.`);
      continue;
    }
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
        kind: "empresa",
      },
    });
    const owner = await prisma.user.create({
      data: {
        email: company.email,
        passwordHash: clientPasswordHash,
        name: company.contactName,
        phone: company.phone,
        role: "client",
        companyId: row.id,
      },
    });
    await prisma.company.update({ where: { id: row.id }, data: { ownerUserId: owner.id, kind: "empresa" } });
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
  const feeAudit = await prisma.auditLog.findFirst({ where: { action: "fee.update", entityId: "feePercent" } });
  if (!feeAudit) {
    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: "fee.update",
        entityType: "setting",
        entityId: "feePercent",
        metadata: JSON.stringify({ feePercent: "0.50", note: "Valor de referencia del MVP" }),
      },
    });
  }
  console.log("Datos de demostración listos.");
  console.log(`Admin: ${adminEmail}`);
  console.log("La contraseña de admin no se imprime.");
  console.log("Cliente de demostración: maria.quispe@importadora-andina.example");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
