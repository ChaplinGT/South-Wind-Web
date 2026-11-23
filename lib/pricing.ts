import { add, cmp, feeAmount, fromCents, sub, toCents } from "./money";

/** Valores comerciales iniciales. El seed los inserta solo si la clave todavía no existe. */
export const PRICING_DEFAULTS = {
  sendFeePercent: "1.00",
  walletSurchargePercent: "0.25",
  fixedSendFeeUsd: "10.00",
  vaDeveloperFeePercent: "1.25",
  fixedReceiveFeeUsd: "10.00",
  feeConfigEnabled: "false",
  bobMarkupPercent: "0.50",
  fxMarkupPercent: "0.10",
  bridgeOrchestrationPercent: "0.25",
  bridgeVaOrchestrationPercent: "0.50",
  bridgeUsdtSupportPercent: "0.10",
  bridgeVaAccountFeeUsd: "2.00",
  bridgeVaAccountFeeMxn: "1.50",
  bridgeVaAccountFeeBrlCop: "1.80",
  bridgeWalletFeeUsd: "0.25",
  bridgeKycUsdYear: "2.00",
  bridgeKybUsdYear: "10.00",
} as const;

export type PricingSettings = {
  sendFeePercent: string;
  walletSurchargePercent: string;
  fixedSendFeeUsd: string;
  vaDeveloperFeePercent: string;
  fixedReceiveFeeUsd: string;
  feeConfigEnabled: boolean;
  bobMarkupPercent: string;
  fxMarkupPercent: string;
  bridgeOrchestrationPercent: string;
  bridgeVaOrchestrationPercent: string;
  bridgeUsdtSupportPercent: string;
  bridgeVaAccountFeeUsd: string;
  bridgeVaAccountFeeMxn: string;
  bridgeVaAccountFeeBrlCop: string;
  bridgeWalletFeeUsd: string;
  bridgeKycUsdYear: string;
  bridgeKybUsdYear: string;
};

/** Referencia para convertir cargos fijos en un margen porcentual estimado. */
export const MARGIN_REFERENCE_USD = "1000.00";

export function bridgeDecimal(value: string): string {
  const normalized = fromCents(toCents(value));
  const [whole, frac] = normalized.split(".");
  if (frac === "00") return `${whole}.0`;
  if (frac?.endsWith("0")) return `${whole}.${frac[0]}`;
  return normalized;
}

export function normalizeMoney(value: string): string {
  const raw = value.trim();
  if (/^\d+(\.\d{1,2})?$/.test(raw)) return fromCents(toCents(raw));
  if (/^\d+\.\d+$/.test(raw)) return fromCents(Math.round(Number(raw) * 100));
  throw new Error("Monto no válido.");
}

function multiply(amount: string, rate: number): string {
  return fromCents(Math.round(toCents(normalizeMoney(amount)) * rate));
}

/** fee_config y developer_fee_percent no pueden ir juntos. El monto fijo se aplica primero y el porcentaje sobre el resto, del lado de Bridge. */
export function virtualAccountFeePayload(enabled: boolean, percent: string, fixedUsd: string): Record<string, unknown> {
  if (enabled) {
    return {
      fee_config: {
        source: {
          default: {
            fee_amount: bridgeDecimal(fixedUsd),
            fee_percent: bridgeDecimal(percent),
          },
        },
      },
    };
  }
  return { developer_fee_percent: bridgeDecimal(percent) };
}

export function quoteDirectSend(input: {
  usdcAmount: string;
  buyRate: number;
  fixedFeeUsd: string;
  sendFeePercent: string;
}) {
  const usdcAmount = normalizeMoney(input.usdcAmount);
  if (cmp(usdcAmount, "0.00") <= 0 || !Number.isFinite(input.buyRate) || input.buyRate <= 0) {
    throw new Error("Monto o tipo de cambio no válido.");
  }
  const rate = input.buyRate.toFixed(4);
  const rateNumber = Number(rate);
  const principalBob = multiply(usdcAmount, rateNumber);
  const fixedFeeUsd = normalizeMoney(input.fixedFeeUsd);
  const fixedFeeBob = multiply(fixedFeeUsd, rateNumber);
  const sendFeeUsdc = feeAmount(usdcAmount, input.sendFeePercent);
  return {
    rate,
    usdcAmount,
    principalBob,
    fixedFeeUsd,
    fixedFeeBob,
    bobAmount: add(principalBob, fixedFeeBob),
    sendFeePercent: input.sendFeePercent,
    sendFeeUsdc,
    beneficiaryUsdc: cmp(usdcAmount, sendFeeUsdc) < 0 ? "0.00" : sub(usdcAmount, sendFeeUsdc),
  };
}

/** developer_fee fijo = monto × (comisión de envío + recargo de billetera) + cargo fijo, a dos decimales. */
export function quoteWalletSend(amount: string, sendPercent: string, surchargePercent: string, fixedUsd: string) {
  const usdcAmount = normalizeMoney(amount);
  if (cmp(usdcAmount, "0.00") <= 0) throw new Error("Monto no válido.");
  const combinedPercent = ((Number(sendPercent) || 0) + (Number(surchargePercent) || 0)).toFixed(2);
  const variable = feeAmount(usdcAmount, combinedPercent);
  const fixed = normalizeMoney(fixedUsd);
  const fee = add(variable, fixed);
  return {
    usdcAmount,
    combinedPercent,
    variable,
    fixed,
    fee,
    total: add(usdcAmount, fee),
  };
}

export function receiveNetUsdc(grossAmount: string, fixedUsd: string, deductFixed: boolean) {
  const gross = normalizeMoney(grossAmount);
  if (!deductFixed) return { gross, fixedFeeUsd: "0.00", net: gross };
  const fixedFeeUsd = normalizeMoney(fixedUsd);
  if (cmp(gross, fixedFeeUsd) < 0) return { gross, fixedFeeUsd, net: "0.00" };
  return { gross, fixedFeeUsd, net: sub(gross, fixedFeeUsd) };
}

export function quoteBobProceeds(netUsdc: string, sellRate: number) {
  const net = normalizeMoney(netUsdc);
  if (!Number.isFinite(sellRate) || sellRate <= 0) throw new Error("Tipo de cambio no válido.");
  const rate = sellRate.toFixed(4);
  return { rate, bobAmount: multiply(net, Number(rate)) };
}

export type MarginRow = { route: string; detail: string; grossMarginPercent: string };

function asNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function marginPercent(revenue: number, cost: number, reference: number): string {
  if (reference <= 0) return "0.00";
  return (((revenue - cost) / reference) * 100).toFixed(2);
}

/** Cada fila es independiente. El porcentaje usa un depósito de referencia de USD 1.000. */
export function marginSummary(pricing: PricingSettings): MarginRow[] {
  const ref = asNumber(MARGIN_REFERENCE_USD);
  const va = asNumber(pricing.vaDeveloperFeePercent);
  const fixedReceive = asNumber(pricing.fixedReceiveFeeUsd);
  const vaCost = asNumber(pricing.bridgeVaOrchestrationPercent);
  const send = asNumber(pricing.sendFeePercent);
  const surcharge = asNumber(pricing.walletSurchargePercent);
  const fixedSend = asNumber(pricing.fixedSendFeeUsd);
  const orchestration = asNumber(pricing.bridgeOrchestrationPercent);
  const usdt = asNumber(pricing.bridgeUsdtSupportPercent);
  const walletCost = asNumber(pricing.bridgeWalletFeeUsd);
  const sendCost = ref * ((orchestration + usdt) / 100);
  const rows: MarginRow[] = [];

  if (pricing.feeConfigEnabled) {
    const revenue = fixedReceive + Math.max(ref - fixedReceive, 0) * (va / 100);
    rows.push({
      route: "Recepción en cuenta virtual",
      detail: `fee_config activo: USD ${pricing.fixedReceiveFeeUsd} primero y ${pricing.vaDeveloperFeePercent} % sobre el resto. Costo Bridge: orquestación de cuenta virtual ${pricing.bridgeVaOrchestrationPercent} %.`,
      grossMarginPercent: marginPercent(revenue, ref * (vaCost / 100), ref),
    });
  } else {
    const percentRevenue = ref * (va / 100);
    const vaCostAmount = ref * (vaCost / 100);
    rows.push({
      route: "Recepción a la billetera del cliente",
      detail: `${pricing.vaDeveloperFeePercent} % con developer_fee_percent. El cargo fijo de USD ${pricing.fixedReceiveFeeUsd} no se cobra. Costo Bridge: orquestación ${pricing.bridgeVaOrchestrationPercent} %.`,
      grossMarginPercent: marginPercent(percentRevenue, vaCostAmount, ref),
    });
    rows.push({
      route: "Recepción que South Wind liquida en bolivianos",
      detail: `${pricing.vaDeveloperFeePercent} % en Bridge y USD ${pricing.fixedReceiveFeeUsd} descontados en la liquidación. Costo Bridge: orquestación ${pricing.bridgeVaOrchestrationPercent} %.`,
      grossMarginPercent: marginPercent(percentRevenue + fixedReceive, vaCostAmount, ref),
    });
  }

  rows.push({
    route: "Envío directo (orden de pago)",
    detail: `${pricing.sendFeePercent} % en la dirección de liquidación más USD ${pricing.fixedSendFeeUsd} en la orden. Costo Bridge: orquestación ${pricing.bridgeOrchestrationPercent} % y soporte USDT ${pricing.bridgeUsdtSupportPercent} %.`,
    grossMarginPercent: marginPercent(ref * (send / 100) + fixedSend, sendCost, ref),
  });
  rows.push({
    route: "USDC enviado por el cliente a la dirección",
    detail: `Solo el ${pricing.sendFeePercent} % de la dirección de liquidación. El cargo fijo no se puede cobrar. Mismos costos de orquestación y USDT.`,
    grossMarginPercent: marginPercent(ref * (send / 100), sendCost, ref),
  });
  rows.push({
    route: "Envío desde billetera Bridge",
    detail: `developer_fee = monto × (${pricing.sendFeePercent} % + ${pricing.walletSurchargePercent} %) + USD ${pricing.fixedSendFeeUsd}. Costo Bridge: orquestación ${pricing.bridgeOrchestrationPercent} %, USDT ${pricing.bridgeUsdtSupportPercent} % y USD ${pricing.bridgeWalletFeeUsd} de billetera.`,
    grossMarginPercent: marginPercent(ref * ((send + surcharge) / 100) + fixedSend, sendCost + walletCost, ref),
  });
  rows.push({
    route: "Cambio USDT/BOB",
    detail: `Margen ${pricing.bobMarkupPercent} % sobre Binance. Costo atribuido: soporte USDT ${pricing.bridgeUsdtSupportPercent} %.`,
    grossMarginPercent: marginPercent(ref * (asNumber(pricing.bobMarkupPercent) / 100), ref * (usdt / 100), ref),
  });
  rows.push({
    route: "EUR, GBP, MXN, BRL y COP",
    detail: `Margen ${pricing.fxMarkupPercent} % sobre la tasa de Bridge. Esta fila no resta un costo porcentual del contrato.`,
    grossMarginPercent: marginPercent(ref * (asNumber(pricing.fxMarkupPercent) / 100), 0, ref),
  });
  return rows;
}
