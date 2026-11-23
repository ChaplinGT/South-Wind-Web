/** Monedas que el cliente puede abrir hoy. GBP y COP se cotizan, pero todavía no tienen cuenta de recepción. */
export const RECEIVE_CURRENCY_CODES = ["usd", "eur", "mxn", "brl"] as const;

export function isActiveVirtualAccount(status: string): boolean {
  return status.toLowerCase() !== "deactivated";
}

export function accountStatusLabel(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "activated" || normalized === "active") return "Cuenta activada";
  return "Cuenta en proceso";
}

export function depositSummary(instructionsJson: string, fallbackCurrency: string): {
  currency: string;
  bankName: string;
  accountNumber: string;
} {
  try {
    const body = JSON.parse(instructionsJson) as {
      source_deposit_instructions?: { currency?: string; bank_name?: string; bank_account_number?: string };
    };
    const deposit = body.source_deposit_instructions;
    return {
      currency: (deposit?.currency || fallbackCurrency || "usd").toUpperCase(),
      bankName: deposit?.bank_name?.trim() || "",
      accountNumber: deposit?.bank_account_number?.trim() || "",
    };
  } catch {
    return { currency: (fallbackCurrency || "usd").toUpperCase(), bankName: "", accountNumber: "" };
  }
}

export function missingReceiveCurrencies(held: string[]): string[] {
  const have = new Set(held.map((code) => code.toLowerCase()));
  return RECEIVE_CURRENCY_CODES.filter((code) => !have.has(code));
}
