import { prisma } from "../db";
import { getBridge } from "../bridge";
import { bridgeDecimal, virtualAccountFeePayload } from "../pricing";
import { getPricing } from "../settings";

export async function syncPricingToBridge() {
  const pricing = await getPricing();
  const feeFields = virtualAccountFeePayload(
    pricing.feeConfigEnabled,
    pricing.vaDeveloperFeePercent,
    pricing.fixedReceiveFeeUsd,
  );
  const bridge = getBridge();
  const accounts = await prisma.virtualAccount.findMany({ include: { company: true } });
  const beneficiaries = await prisma.beneficiary.findMany({
    where: { liquidationId: { not: null } },
    include: { company: true },
  });
  let updatedVirtualAccounts = 0;
  let updatedLiquidations = 0;
  let failures = 0;
  for (const account of accounts) {
    if (!account.bridgeVirtualAccountId || !account.company.bridgeCustomerId) continue;
    try {
      await bridge.updateVirtualAccount(account.company.bridgeCustomerId, account.bridgeVirtualAccountId, feeFields);
      await prisma.virtualAccount.update({
        where: { id: account.id },
        data: { feeMode: pricing.feeConfigEnabled ? "fee_config" : "developer_percent" },
      });
      updatedVirtualAccounts += 1;
    } catch {
      failures += 1;
    }
  }
  for (const item of beneficiaries) {
    if (!item.liquidationId || !item.company.bridgeCustomerId) continue;
    try {
      await bridge.updateLiquidationAddress(item.company.bridgeCustomerId, item.liquidationId, {
        custom_developer_fee_percent: bridgeDecimal(pricing.sendFeePercent),
      });
      updatedLiquidations += 1;
    } catch {
      failures += 1;
    }
  }
  return { updatedVirtualAccounts, updatedLiquidations, failures };
}
