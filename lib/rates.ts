export type P2PAd = {
  price?: string;
  classify?: string;
  privilegeType?: string | null;
};

const cache = new Map<string, { at: number; value: unknown }>();

export function usableP2PPrices(ads: P2PAd[]): number[] {
  return ads
    .filter((ad) => ad.price && ad.classify !== "block" && !ad.privilegeType)
    .map((ad) => Number(ad.price))
    .filter((price) => Number.isFinite(price) && price > 0);
}

/** Promedio de los avisos cercanos a la mediana. Descarta los que se alejan más de 1,5 %. */
export function averageNearMedian(prices: number[], tolerance = 0.015): number | null {
  if (prices.length === 0) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = sorted[Math.floor(sorted.length / 2)] ?? sorted[0];
  const kept = sorted.filter((price) => Math.abs(price - mid) / mid <= tolerance);
  const use = kept.length > 0 ? kept : sorted;
  return use.reduce((sum, price) => sum + price, 0) / use.length;
}

export function applySpread(price: number, percent: number, direction: "add" | "sub"): number {
  const factor = percent / 100;
  return direction === "add" ? price * (1 + factor) : price * (1 - factor);
}

export function pricesFromBinanceBody(body: unknown): number[] {
  const rows = (body as { data?: { adv?: P2PAd }[] } | null)?.data ?? [];
  return usableP2PPrices(rows.map((row) => row.adv ?? {}));
}

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function binanceSide(tradeType: "BUY" | "SELL"): Promise<number | null> {
  const response = await fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      asset: "USDT",
      fiat: "BOB",
      page: 1,
      rows: 20,
      tradeType,
      publisherType: null,
      payTypes: [],
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  return averageNearMedian(pricesFromBinanceBody(await response.json()));
}

export async function bobReference(markup: number): Promise<{
  compra: number | null;
  venta: number | null;
  binanceBuy: number | null;
  binanceSell: number | null;
  markup: number;
  at: string;
  source: string;
}> {
  const [buy, sell] = await cached("bob", 60_000, () => Promise.all([binanceSide("BUY"), binanceSide("SELL")]));
  return {
    binanceBuy: buy,
    binanceSell: sell,
    compra: buy === null ? null : applySpread(buy, markup, "add"),
    venta: sell === null ? null : applySpread(sell, markup, "sub"),
    markup,
    at: new Date().toISOString(),
    source: "Binance P2P USDT/BOB",
  };
}

export function eurWithMarkup(
  buyRate: string | number | null,
  sellRate: string | number | null,
  markup: number,
): { buy: number | null; sell: number | null } {
  const buy = buyRate === null ? null : Number(buyRate);
  const sell = sellRate === null ? null : Number(sellRate);
  return {
    buy: buy !== null && Number.isFinite(buy) ? applySpread(buy, markup, "add") : null,
    sell: sell !== null && Number.isFinite(sell) ? applySpread(sell, markup, "sub") : null,
  };
}
