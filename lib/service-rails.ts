const BY_ENDORSEMENT: Record<string, string[]> = {
  base: ["ACH mismo día", "Wire"],
  sepa: ["SEPA"],
  spei: ["SPEI"],
  pix: ["Pix"],
  faster_payments: ["Faster Payments"],
  gb: ["Faster Payments"],
};

export function railsFromEndorsements(endorsements: { name: string; status: string }[] | undefined): string[] {
  const rails = new Set<string>();
  for (const item of endorsements ?? []) {
    if (item.status !== "approved") continue;
    for (const rail of BY_ENDORSEMENT[item.name] ?? []) rails.add(rail);
  }
  return [...rails];
}

export const RECEIVE_CURRENCIES = [
  { currency: "usd", label: "USD · ACH" },
  { currency: "eur", label: "EUR · SEPA" },
  { currency: "brl", label: "BRL · Pix" },
  { currency: "mxn", label: "MXN · SPEI" },
] as const;

export const WALLET_NETWORKS = ["ethereum", "polygon", "base", "arbitrum", "solana", "tron"] as const;
