/** Montos como cadenas con dos decimales. La aritmética usa centavos enteros. */

export function toCents(amount: string | number): number {
  const raw = typeof amount === "number" ? amount.toFixed(2) : amount.trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(raw)) {
    throw new Error(`Monto no válido: ${amount}`);
  }
  const negative = raw.startsWith("-");
  const [whole, frac = ""] = raw.replace("-", "").split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return negative ? -cents : cents;
}

export function fromCents(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

export function add(a: string, b: string): string {
  return fromCents(toCents(a) + toCents(b));
}

export function sub(a: string, b: string): string {
  return fromCents(toCents(a) - toCents(b));
}

export function cmp(a: string, b: string): number {
  return toCents(a) - toCents(b);
}

/** Porcentaje con hasta dos decimales, por ejemplo "0.50" = 0,50 %. */
export function feeAmount(amount: string, percent: string): string {
  const bps = Math.round(toCents(percent));
  const cents = toCents(amount);
  const fee = Math.round((cents * bps) / 10000);
  return fromCents(fee);
}

export function isPositiveAmount(amount: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(amount) && toCents(amount) > 0;
}
