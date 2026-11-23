import { feeAmount, fromCents, toCents } from "./money";

export type SendBreakdown = {
  fiatAmount: string;
  principalUsdc: string;
  fixedFee: string;
  percentFee: string;
  totalFees: string;
  usdcTotal: string;
  percent: string;
  fxPerUsd: number;
};

export type TransferChoice = {
  id: string;
  label: string;
  feeTitle: string;
  bridgeRail: string;
  currency: string;
  fixedFee: string;
};

export function combinedSendPercent(sendPercent: string, walletSurchargePercent: string, fromWallet: boolean): string {
  const send = Number(sendPercent) || 0;
  const extra = fromWallet ? Number(walletSurchargePercent) || 0 : 0;
  return (send + extra).toFixed(2);
}

export function methodsForCurrency(
  currency: string,
  fees: { ach: string; wire: string; standard: string },
): TransferChoice[] {
  const code = currency.toLowerCase();
  if (code === "usd") {
    return [
      { id: "ach", label: "ACH en el mismo día", feeTitle: "Comisión ACH", bridgeRail: "ach_same_day", currency: "usd", fixedFee: fees.ach },
      { id: "wire", label: "Transferencia bancaria (Wire)", feeTitle: "Comisión Wire", bridgeRail: "wire", currency: "usd", fixedFee: fees.wire },
    ];
  }
  if (code === "eur") return [single("sepa", "SEPA", "Comisión SEPA", "sepa", "eur", fees.standard)];
  if (code === "brl") return [single("pix", "PIX", "Comisión PIX", "pix", "brl", fees.standard)];
  if (code === "mxn") return [single("spei", "SPEI", "Comisión SPEI", "spei", "mxn", fees.standard)];
  if (code === "gbp") return [single("fps", "Faster Payments", "Comisión Faster Payments", "faster_payments", "gbp", fees.standard)];
  return [single(code || "other", code.toUpperCase() || "Transferencia", "Comisión fija", code || "wire", code || "usd", fees.standard)];
}

function single(id: string, label: string, feeTitle: string, bridgeRail: string, currency: string, fixedFee: string): TransferChoice {
  return { id, label, feeTitle, bridgeRail, currency, fixedFee };
}

export function fixedFeeForMethod(methodId: string, fees: { ach: string; wire: string; standard: string }): string {
  if (methodId === "wire") return fees.wire;
  if (methodId === "ach") return fees.ach;
  return fees.standard;
}

function principalFromFiat(fiatAmount: string, fxPerUsd: number): string {
  if (!Number.isFinite(fxPerUsd) || fxPerUsd <= 0) throw new Error("Tipo de cambio no válido.");
  const cents = Math.round(toCents(fiatAmount) / fxPerUsd);
  if (cents <= 0) throw new Error("Monto no válido.");
  return fromCents(cents);
}

function fiatFromPrincipal(principalUsdc: string, fxPerUsd: number): string {
  const cents = Math.round(toCents(principalUsdc) * fxPerUsd);
  return fromCents(Math.max(cents, 0));
}

function breakdown(principalUsdc: string, fixedFee: string, percent: string, fxPerUsd: number): SendBreakdown {
  const percentFee = feeAmount(principalUsdc, percent);
  const totalFees = fromCents(toCents(percentFee) + toCents(fixedFee));
  const usdcTotal = fromCents(toCents(principalUsdc) + toCents(totalFees));
  return {
    fiatAmount: fiatFromPrincipal(principalUsdc, fxPerUsd),
    principalUsdc,
    fixedFee,
    percentFee,
    totalFees,
    usdcTotal,
    percent,
    fxPerUsd,
  };
}

export function quoteFromReceiveAmount(input: {
  fiatAmount: string;
  fxPerUsd: number;
  fixedFee: string;
  percent: string;
}): SendBreakdown {
  return breakdown(principalFromFiat(input.fiatAmount, input.fxPerUsd), input.fixedFee, input.percent, input.fxPerUsd);
}

export function quoteFromSendAmount(input: {
  usdcTotal: string;
  fxPerUsd: number;
  fixedFee: string;
  percent: string;
}): SendBreakdown | null {
  if (!Number.isFinite(input.fxPerUsd) || input.fxPerUsd <= 0) return null;
  const available = toCents(input.usdcTotal) - toCents(input.fixedFee);
  if (available <= 0) return null;
  const bps = Math.round(toCents(input.percent));
  const principal = Math.round((available * 10000) / (10000 + bps));
  if (principal <= 0) return null;
  return breakdown(fromCents(principal), input.fixedFee, input.percent, input.fxPerUsd);
}

export function payoutMode(hasWallet: boolean): "wallet" | "instructions" {
  return hasWallet ? "wallet" : "instructions";
}
