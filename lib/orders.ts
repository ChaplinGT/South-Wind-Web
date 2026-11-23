import { applySpread } from "./rates";

export function usdcForBobPayment(bobAmount: string, rate: number, feePercent: string): { rate: string; usdcAmount: string } {
  const bob = Number(bobAmount);
  if (!Number.isFinite(bob) || bob <= 0 || !Number.isFinite(rate) || rate <= 0) {
    throw new Error("Monto o tipo de cambio no válido.");
  }
  const gross = bob / rate;
  const net = applySpread(gross, Number(feePercent) || 0, "sub");
  return { rate: rate.toFixed(4), usdcAmount: net.toFixed(2) };
}
