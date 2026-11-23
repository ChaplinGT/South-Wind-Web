import { prisma } from "./db";

function envPercent(name: string, fallback: string): string {
  const raw = process.env[name]?.trim();
  if (!raw || !/^\d+(\.\d{1,2})?$/.test(raw)) return fallback;
  return raw;
}

async function readSetting(key: string, fallback: string): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value || fallback;
}

export async function getFeePercent(): Promise<string> {
  return readSetting("feePercent", envPercent("SOUTH_WIND_FEE_PERCENT", "0.50"));
}

/** Margen USDT/BOB sobre Binance. Por defecto 0,50 %. */
export async function getBobMarkupPercent(): Promise<string> {
  return readSetting("bobMarkupPercent", envPercent("BOB_MARKUP_PERCENT", "0.50"));
}

/** Margen para EUR y el resto de monedas distintas de BOB, sobre las tasas de Bridge. Por defecto 0,10 %. */
export async function getFxMarkupPercent(): Promise<string> {
  return readSetting("fxMarkupPercent", envPercent("FX_MARKUP_PERCENT", envPercent("EUR_MARKUP_PERCENT", "0.10")));
}

export async function getPayoutDirectFeePercent(): Promise<string> {
  return readSetting("payoutDirectFeePercent", "0");
}

export async function getPayoutWalletFeePercent(): Promise<string> {
  return readSetting("payoutWalletFeePercent", "0");
}

export async function getVaDeveloperFeePercent(): Promise<string> {
  return readSetting("vaDeveloperFeePercent", envPercent("VA_DEVELOPER_FEE_PERCENT", envPercent("SOUTH_WIND_FEE_PERCENT", "0.50")));
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

export async function setRouteFees(direct: string, wallet: string, vaFee: string) {
  for (const [key, value] of [
    ["payoutDirectFeePercent", direct],
    ["payoutWalletFeePercent", wallet],
    ["vaDeveloperFeePercent", vaFee],
  ] as const) {
    await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
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
