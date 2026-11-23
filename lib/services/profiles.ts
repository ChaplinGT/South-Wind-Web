import { randomUUID } from "crypto";
import { prisma } from "../db";
import { audit } from "../audit";
import { getBridge } from "../bridge";
import { AppError } from "../errors";
import { startKyb } from "./onboarding";
import { provisionCompany } from "./provision";
import type { z } from "zod";
import type { enableProfileSchema, virtualAccountRequestSchema } from "../validation";
import { WALLET_NETWORKS } from "../service-rails";

export async function enableProfile(userId: string, input: z.infer<typeof enableProfileSchema>, ip?: string | null) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "client") throw new AppError("Debe iniciar sesión con una cuenta de cliente.", 401);
  const existing = await prisma.company.findFirst({ where: { ownerUserId: user.id, kind: input.kind } });
  if (existing) throw new AppError("Ese perfil ya está creado. Continúe la verificación desde el inicio.", 409);
  const networks = new Set<string>(WALLET_NETWORKS);
  if (input.funding === "external" && (!input.address || !networks.has(input.network))) {
    throw new AppError("Indique la dirección y la red de la billetera externa.", 422);
  }
  if (input.kind === "empresa" && (input.legalName.length < 3 || !/^\d{7,15}$/.test(input.nit))) {
    throw new AppError("Para una empresa indique la razón social y un NIT de 7 a 15 dígitos.", 422);
  }
  const company = await prisma.company.create({
    data: {
      legalName: input.kind === "persona" ? user.name : input.legalName,
      tradeName: input.kind === "persona" ? user.name : input.tradeName || input.legalName,
      nit: input.kind === "empresa" ? input.nit : null,
      email: user.email,
      phone: user.phone || "",
      address: input.kind === "empresa" ? input.addressLine : "Por completar en la verificación",
      city: input.kind === "empresa" ? input.city || "Bolivia" : "Bolivia",
      clientType: input.kind === "persona" ? "persona" : input.clientType,
      contactName: user.name,
      kybStatus: "not_started",
      onboardingSource: "self",
      ownerUserId: user.id,
      kind: input.kind,
      fundingMode: input.funding,
    },
  });
  if (!user.companyId) {
    await prisma.user.update({ where: { id: user.id }, data: { companyId: company.id } });
  }
  if (input.funding === "external") {
    await prisma.externalWallet.create({
      data: { companyId: company.id, address: input.address, network: input.network, label: "Billetera externa" },
    });
  }
  const linked = await startKyb(company.id, user.id, ip);
  if (input.funding === "bridge_wallet" && linked.bridgeCustomerId) {
    await provisionCompany(company.id);
    await prisma.company.update({ where: { id: company.id }, data: { fundingMode: "bridge_wallet" } });
  }
  await audit({
    actorId: user.id,
    companyId: company.id,
    action: "customer.register",
    entityType: "company",
    entityId: company.id,
    ip,
    metadata: { kind: input.kind, funding: input.funding },
  });
  return linked;
}

export async function openReceiveAccount(userId: string, input: z.infer<typeof virtualAccountRequestSchema>) {
  const company = await prisma.company.findFirst({ where: { id: input.companyId, ownerUserId: userId } });
  if (!company?.bridgeCustomerId) throw new AppError("Ese perfil todavía no está vinculado a Bridge.", 409);
  const bridge = getBridge();
  let destination: Record<string, unknown>;
  if (input.destination === "bridge_wallet") {
    if (!company.bridgeWalletId) {
      const wallet = await bridge.createWallet(company.bridgeCustomerId, { chain: "base" }, randomUUID());
      await prisma.company.update({
        where: { id: company.id },
        data: { bridgeWalletId: wallet.id, walletAddress: wallet.address, walletChain: wallet.chain },
      });
      destination = { currency: "usdc", payment_rail: "base", bridge_wallet_id: wallet.id, address: wallet.address };
    } else {
      destination = {
        currency: "usdc",
        payment_rail: company.walletChain || "base",
        bridge_wallet_id: company.bridgeWalletId,
        address: company.walletAddress,
      };
    }
  } else {
    const wallet = await prisma.externalWallet.findFirst({ where: { id: input.externalWalletId, companyId: company.id } });
    if (!wallet) throw new AppError("Seleccione una billetera externa registrada.", 422);
    destination = { currency: "usdc", payment_rail: wallet.network === "solana" ? "solana" : wallet.network, address: wallet.address };
  }
  const account = await bridge.createVirtualAccount(
    company.bridgeCustomerId,
    { developer_fee_percent: "0.50", source: { currency: input.currency }, destination },
    randomUUID(),
  );
  await prisma.virtualAccount.create({
    data: {
      companyId: company.id,
      bridgeVirtualAccountId: account.id,
      status: account.status,
      currency: input.currency,
      instructionsJson: JSON.stringify(account),
    },
  });
  return account;
}
