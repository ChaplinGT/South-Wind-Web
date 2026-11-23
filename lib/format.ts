const TIME_ZONE = "America/La_Paz";

const currencySuffix: Record<string, string> = {
  usdc: "USDC",
  usd: "USD",
  bob: "Bs",
  eur: "EUR",
  mxn: "MXN",
  brl: "BRL",
  gbp: "GBP",
};

export function formatAmount(amount: string | number, currency = "usdc"): string {
  const value = typeof amount === "number" ? amount : Number(amount);
  const formatted = new Intl.NumberFormat("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${formatted} ${currencySuffix[currency.toLowerCase()] ?? currency.toUpperCase()}`;
}

export function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat("es-BO", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export function formatDateShort(value: Date | string): string {
  return new Intl.DateTimeFormat("es-BO", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function formatDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat("es-BO", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

/** Inicio y fin del mes calendario en America/La_Paz (UTC−4, sin horario de verano). */
export function periodBounds(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1, 4, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 3, 59, 59, 999));
  return { start, end };
}

export function monthLabel(year: number, month: number): string {
  const date = new Date(Date.UTC(year, month - 1, 15, 16, 0, 0));
  return new Intl.DateTimeFormat("es-BO", {
    timeZone: TIME_ZONE,
    month: "long",
    year: "numeric",
  }).format(date);
}
