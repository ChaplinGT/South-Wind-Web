import { randomUUID } from "crypto";
import { prisma } from "../db";
import { getBridge } from "../bridge";
import { getFeePercent } from "../settings";
import type { BridgeVirtualAccount, BridgeWallet } from "../bridge/types";

export async function provisionCompany(companyId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company?.bridgeCustomerId) return company;
  const bridge = getBridge();
  const fee = await getFeePercent();

  let wallet: BridgeWallet | undefined;
  const wallets = await bridge.listWallets(company.bridgeCustomerId);
  wallet = wallets.data[0];
  if (!wallet) {
    wallet = await bridge.createWallet(company.bridgeCustomerId, { chain: "base" }, randomUUID());
  }

  let virtualAccount: BridgeVirtualAccount | undefined;
  const accounts = await bridge.listVirtualAccounts(company.bridgeCustomerId);
  virtualAccount = accounts.data.find((item) => item.status !== "deactivated") ?? accounts.data[0];
  if (!virtualAccount) {
    virtualAccount = await bridge.createVirtualAccount(
      company.bridgeCustomerId,
      {
        developer_fee_percent: fee,
        source: { currency: "usd" },
        destination: {
          currency: "usdc",
          payment_rail: "base",
          bridge_wallet_id: wallet.id,
          address: wallet.address,
        },
      },
      randomUUID(),
    );
  }

  await prisma.company.update({
    where: { id: company.id },
    data: {
      bridgeWalletId: wallet.id,
      walletAddress: wallet.address,
      walletChain: wallet.chain,
    },
  });

  const existing = await prisma.virtualAccount.findFirst({
    where: { companyId: company.id, bridgeVirtualAccountId: virtualAccount.id },
  });
  if (!existing) {
    await prisma.virtualAccount.create({
      data: {
        companyId: company.id,
        bridgeVirtualAccountId: virtualAccount.id,
        status: virtualAccount.status,
        currency: virtualAccount.source_deposit_instructions.currency || "usd",
        instructionsJson: JSON.stringify(virtualAccount),
      },
    });
  } else {
    await prisma.virtualAccount.update({
      where: { id: existing.id },
      data: { status: virtualAccount.status, instructionsJson: JSON.stringify(virtualAccount) },
    });
  }

  return prisma.company.findUnique({ where: { id: company.id } });
}
