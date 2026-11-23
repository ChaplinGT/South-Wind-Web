export type StoredBankDetails = {
  accountNumber?: string;
  routingNumber?: string;
  iban?: string;
  bic?: string;
  clabe?: string;
  pixKey?: string;
  pixAgency?: string;
  pixAccount?: string;
  sortCode?: string;
  accountKind?: string;
};

export function parseBankDetails(detailsJson: string | null | undefined): StoredBankDetails {
  if (!detailsJson) return {};
  try {
    const body = JSON.parse(detailsJson) as StoredBankDetails;
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

export function maskAccount(full: string | undefined, last4: string): string {
  const compact = (full || "").replace(/\s+/g, "");
  if (compact.length >= 4) return compact;
  if (last4) return `****${last4}`;
  return "";
}

export function accountKindLabel(kind: string | undefined): string {
  if (kind === "checking") return "Cuenta corriente";
  if (kind === "savings") return "Cuenta de ahorros";
  return "";
}

export function destinationRows(input: {
  owner: string;
  bank: string;
  currency: string;
  methodLabel: string;
  rail: string;
  last4: string;
  details: StoredBankDetails;
}): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [
    { label: "Titular", value: input.owner },
    { label: "Banco", value: input.bank },
  ];
  const rail = input.rail;
  const details = input.details;
  const push = (label: string, value: string | undefined) => {
    const clean = value?.trim();
    if (clean) rows.push({ label, value: clean });
  };
  if (rail === "ach" || rail === "wire") {
    push("Número de cuenta", maskAccount(details.accountNumber, input.last4));
    push("Tipo de cuenta", accountKindLabel(details.accountKind));
    push("Routing number", details.routingNumber);
  } else if (rail === "sepa") {
    push("IBAN", details.iban ? details.iban.replace(/\s+/g, "").toUpperCase() : maskAccount(undefined, input.last4));
    push("BIC", details.bic?.toUpperCase());
  } else if (rail === "spei") {
    push("CLABE", maskAccount(details.clabe, input.last4));
  } else if (rail === "pix") {
    push("Llave Pix", details.pixKey || maskAccount(undefined, input.last4));
    push("Agencia", details.pixAgency);
    push("Conta", details.pixAccount);
  } else if (rail === "fps") {
    push("Número de cuenta", maskAccount(details.accountNumber, input.last4));
    push("Sort code", details.sortCode);
  } else {
    push("Número de cuenta", maskAccount(details.accountNumber, input.last4));
  }
  push("Moneda y tipo", `${input.currency.toUpperCase()} · ${input.methodLabel}`);
  return rows.filter((row) => row.value);
}
