export const rails = {
  ach: {
    label: "ACH Estados Unidos",
    currency: "usd",
    bridgeRail: "ach",
    accountType: "us",
    country: "USA",
  },
  wire: {
    label: "Wire Estados Unidos",
    currency: "usd",
    bridgeRail: "wire",
    accountType: "us",
    country: "USA",
  },
  sepa: {
    label: "SEPA Europa",
    currency: "eur",
    bridgeRail: "sepa",
    accountType: "iban",
    country: "EUR",
  },
  spei: {
    label: "SPEI México",
    currency: "mxn",
    bridgeRail: "spei",
    accountType: "clabe",
    country: "MEX",
  },
  pix: {
    label: "Pix Brasil",
    currency: "brl",
    bridgeRail: "pix",
    accountType: "pix",
    country: "BRA",
  },
  fps: {
    label: "Faster Payments Reino Unido",
    currency: "gbp",
    bridgeRail: "faster_payments",
    accountType: "gb",
    country: "GBR",
  },
} as const;

export type RailKey = keyof typeof rails;

export function isRail(value: string): value is RailKey {
  return value in rails;
}

export function railLabel(rail: string): string {
  return isRail(rail) ? rails[rail].label : rail;
}
