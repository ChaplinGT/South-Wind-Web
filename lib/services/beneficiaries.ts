import { randomUUID } from "crypto";
import { prisma } from "../db";
import { audit } from "../audit";
import { getBridge } from "../bridge";
import { AppError } from "../errors";
import { rails, type RailKey } from "../rails";
import type { z } from "zod";
import type { beneficiarySchema } from "../validation";

type Input = z.infer<typeof beneficiarySchema>;

export async function createBeneficiary(input: {
  companyId: string;
  actorId: string;
  data: Input;
  ip?: string | null;
}) {
  const company = await prisma.company.findUnique({ where: { id: input.companyId } });
  if (!company?.bridgeCustomerId) {
    throw new AppError("Primero debe completarse la verificación de la empresa.", 409);
  }
  const rail = rails[input.data.rail as RailKey];
  const payload = bridgePayload(input.data, rail.accountType, rail.currency);
  const bridge = getBridge();
  const external = await bridge.createExternalAccount(company.bridgeCustomerId, payload, randomUUID());
  const liquidation = await bridge.createLiquidationAddress(
    company.bridgeCustomerId,
    {
      currency: "usdc",
      chain: input.data.chain,
      external_account_id: external.id,
      destination_payment_rail: rail.bridgeRail,
      destination_currency: rail.currency,
    },
    randomUUID(),
  );
  const accountNumber =
    input.data.accountNumber || input.data.iban || input.data.clabe || input.data.pixKey || "";
  const beneficiary = await prisma.beneficiary.create({
    data: {
      companyId: company.id,
      bridgeExternalAccountId: external.id,
      nickname: input.data.nickname,
      rail: input.data.rail,
      currency: rail.currency,
      accountOwnerName: input.data.accountOwnerName,
      bankName: input.data.bankName,
      accountLast4: external.last_4 || accountNumber.replace(/\s+/g, "").slice(-4),
      country: input.data.country || rail.country,
      status: "active",
      detailsJson: JSON.stringify({
        accountType: rail.accountType,
        city: input.data.city,
        country: input.data.country || rail.country,
      }),
      liquidationId: liquidation.id,
      liquidationAddress: liquidation.address,
      liquidationChain: liquidation.chain,
    },
  });
  await audit({
    actorId: input.actorId,
    companyId: company.id,
    action: "beneficiary.create",
    entityType: "beneficiary",
    entityId: beneficiary.id,
    ip: input.ip,
    metadata: { rail: beneficiary.rail, last4: beneficiary.accountLast4 },
  });
  return beneficiary;
}

function bridgePayload(data: Input, accountType: string, currency: string): Record<string, unknown> {
  const owner = {
    currency,
    account_type: accountType,
    bank_name: data.bankName,
    account_owner_name: data.accountOwnerName,
    account_owner_type: "business",
    business_name: data.accountOwnerName,
  };
  if (accountType === "us") {
    return {
      ...owner,
      address: {
        street_line_1: data.street,
        city: data.city,
        state: data.state.toUpperCase(),
        postal_code: data.postalCode,
        country: "USA",
      },
      account: {
        account_number: data.accountNumber,
        routing_number: data.routingNumber,
        checking_or_savings: data.accountKind,
      },
    };
  }
  if (accountType === "iban") {
    return {
      ...owner,
      iban: {
        account_number: data.iban.replace(/\s+/g, "").toUpperCase(),
        bic: data.bic || undefined,
        country: (data.country || "DEU").toUpperCase(),
      },
      address: {
        street_line_1: data.street || "Domicilio del beneficiario",
        city: data.city || "Ciudad",
        postal_code: data.postalCode || "00000",
        country: (data.country || "DEU").toUpperCase(),
      },
    };
  }
  if (accountType === "clabe") {
    return {
      ...owner,
      account: { account_number: data.clabe },
      address: { street_line_1: data.street || "Domicilio", city: data.city || "Ciudad de México", country: "MEX" },
    };
  }
  if (accountType === "pix") {
    return {
      ...owner,
      account: { pix_key: data.pixKey },
    };
  }
  return {
    ...owner,
    account: { account_number: data.accountNumber, sort_code: data.sortCode },
    address: {
      street_line_1: data.street || "Beneficiary address",
      city: data.city || "London",
      postal_code: data.postalCode || "EC1A1BB",
      country: "GBR",
    },
  };
}
