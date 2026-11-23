import { prisma } from "./db";
import { PRICING_DEFAULTS, type PricingSettings } from "./pricing";

function envPercent(name: string, fallback: string): string {
  const raw = process.env[name]?.trim();
  if (!raw || !/^\d+(\.\d{1,2})?$/.test(raw)) return fallback;
  return raw;
}

const PRICING_KEYS = [
  "sendFeePercent",
  "walletSurchargePercent",
  "fixedSendFeeUsd",
  "vaDeveloperFeePercent",
  "fixedReceiveFeeUsd",
  "feeConfigEnabled",
  "bobMarkupPercent",
  "fxMarkupPercent",
  "bridgeOrchestrationPercent",
  "bridgeVaOrchestrationPercent",
  "bridgeUsdtSupportPercent",
  "bridgeVaAccountFeeUsd",
  "bridgeVaAccountFeeMxn",
  "bridgeVaAccountFeeBrlCop",
  "bridgeWalletFeeUsd",
  "bridgeKycUsdYear",
  "bridgeKybUsdYear",
] as const;

function pricingFallback(key: (typeof PRICING_KEYS)[number]): string {
  if (key === "bobMarkupPercent") return envPercent("BOB_MARKUP_PERCENT", PRICING_DEFAULTS.bobMarkupPercent);
  if (key === "fxMarkupPercent") return envPercent("FX_MARKUP_PERCENT", envPercent("EUR_MARKUP_PERCENT", PRICING_DEFAULTS.fxMarkupPercent));
  if (key === "vaDeveloperFeePercent") return envPercent("VA_DEVELOPER_FEE_PERCENT", PRICING_DEFAULTS.vaDeveloperFeePercent);
  return PRICING_DEFAULTS[key];
}

async function readSetting(key: string, fallback: string): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value || fallback;
}

export async function getPricing(): Promise<PricingSettings> {
  const rows = await prisma.setting.findMany({ where: { key: { in: [...PRICING_KEYS] } } });
  const stored = new Map(rows.map((row) => [row.key, row.value]));
  const value = (key: (typeof PRICING_KEYS)[number]) => stored.get(key) || pricingFallback(key);
  return {
    sendFeePercent: value("sendFeePercent"),
    walletSurchargePercent: value("walletSurchargePercent"),
    fixedSendFeeUsd: value("fixedSendFeeUsd"),
    vaDeveloperFeePercent: value("vaDeveloperFeePercent"),
    fixedReceiveFeeUsd: value("fixedReceiveFeeUsd"),
    feeConfigEnabled: value("feeConfigEnabled") === "true",
    bobMarkupPercent: value("bobMarkupPercent"),
    fxMarkupPercent: value("fxMarkupPercent"),
    bridgeOrchestrationPercent: value("bridgeOrchestrationPercent"),
    bridgeVaOrchestrationPercent: value("bridgeVaOrchestrationPercent"),
    bridgeUsdtSupportPercent: value("bridgeUsdtSupportPercent"),
    bridgeVaAccountFeeUsd: value("bridgeVaAccountFeeUsd"),
    bridgeVaAccountFeeMxn: value("bridgeVaAccountFeeMxn"),
    bridgeVaAccountFeeBrlCop: value("bridgeVaAccountFeeBrlCop"),
    bridgeWalletFeeUsd: value("bridgeWalletFeeUsd"),
    bridgeKycUsdYear: value("bridgeKycUsdYear"),
    bridgeKybUsdYear: value("bridgeKybUsdYear"),
  };
}

export async function setPricing(input: Omit<PricingSettings, "feeConfigEnabled"> & { feeConfigEnabled: boolean }) {
  const entries: [string, string][] = PRICING_KEYS.map((key) => [
    key,
    key === "feeConfigEnabled" ? (input.feeConfigEnabled ? "true" : "false") : input[key],
  ]);
  for (const [key, value] of entries) {
    await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
}

export async function getFeePercent(): Promise<string> {
  return readSetting("feePercent", envPercent("SOUTH_WIND_FEE_PERCENT", "0.50"));
}

export async function getBobMarkupPercent(): Promise<string> {
  return readSetting("bobMarkupPercent", pricingFallback("bobMarkupPercent"));
}

export async function getFxMarkupPercent(): Promise<string> {
  return readSetting("fxMarkupPercent", pricingFallback("fxMarkupPercent"));
}

export async function getVaDeveloperFeePercent(): Promise<string> {
  return readSetting("vaDeveloperFeePercent", pricingFallback("vaDeveloperFeePercent"));
}

export async function getSouthWindWallet(chain: string): Promise<string> {
  return readSetting(`swWallet:${chain}`, "");
}

export async function setFeePercent(value: string) {
  await prisma.setting.upsert({
    where: { key: "feePercent" },
    update: { value },
    create: { key: "feePercent", value },
  });
}

export async function setSouthWindWallet(chain: string, address: string) {
  const key = `swWallet:${chain}`;
  await prisma.setting.upsert({ where: { key }, update: { value: address.trim() }, create: { key, value: address.trim() } });
}

export async function setMarkups(bob: string, fx: string) {
  await prisma.setting.upsert({
    where: { key: "bobMarkupPercent" },
    update: { value: bob },
    create: { key: "bobMarkupPercent", value: bob },
  });
  await prisma.setting.upsert({
    where: { key: "fxMarkupPercent" },
    update: { value: fx },
    create: { key: "fxMarkupPercent", value: fx },
  });
}
