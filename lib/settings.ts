import { prisma } from "./db";

export async function getFeePercent(): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key: "feePercent" } });
  return row?.value || process.env.SOUTH_WIND_FEE_PERCENT || "0.50";
}

export async function setFeePercent(value: string) {
  await prisma.setting.upsert({
    where: { key: "feePercent" },
    update: { value },
    create: { key: "feePercent", value },
  });
}
