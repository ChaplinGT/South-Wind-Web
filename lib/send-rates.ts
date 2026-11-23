import { getBridge } from "./bridge";
import { AppError } from "./errors";
import { bobReference, fxWithMarkup } from "./rates";
import { getBobMarkupPercent, getFxMarkupPercent } from "./settings";

export async function destinationPerUsdc(currency: string): Promise<number> {
  if (currency.toLowerCase() === "usd") return 1;
  const markup = Number(await getFxMarkupPercent());
  const quote = await getBridge().getExchangeRate("usd", currency.toLowerCase());
  const priced = fxWithMarkup(quote.buy_rate ?? null, quote.sell_rate ?? null, markup);
  if (priced.sell === null) throw new AppError("No hay un tipo de cambio disponible para esa moneda.", 503);
  return priced.sell;
}

export async function bobBuyPerUsdc(): Promise<number> {
  const markup = Number(await getBobMarkupPercent());
  const quote = await bobReference(markup, 60_000);
  if (!quote.compra) throw new AppError("No hay un tipo de cambio disponible para bolivianos.", 503);
  return quote.compra;
}
