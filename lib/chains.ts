const USDC: Record<string, { contract: string; decimals: number }> = {
  ethereum: { contract: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
  polygon: { contract: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
  base: { contract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
  arbitrum: { contract: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
};

const SOLANA_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export function rpcEnv(network: string): string | undefined {
  const key = `RPC_${network.toUpperCase()}`;
  const value = process.env[key];
  return value && value.trim() ? value.trim() : undefined;
}

export function encodeBalanceOf(holder: string): string {
  const hex = holder.toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{40}$/.test(hex)) throw new Error("Dirección EVM no válida.");
  return `0x70a08231${hex.padStart(64, "0")}`;
}

export function formatToken(raw: bigint, decimals: number): string {
  const zero = BigInt(0);
  const negative = raw < zero;
  const value = negative ? -raw : raw;
  const base = BigInt(10) ** BigInt(decimals);
  const whole = value / base;
  const frac = value % base;
  const text = `${whole.toString()}.${frac.toString().padStart(decimals, "0").slice(0, 2)}`;
  return negative ? `-${text}` : text;
}

export function decodeHexQuantity(hex: string): bigint {
  const clean = hex.startsWith("0x") ? hex : `0x${hex}`;
  if (clean === "0x") return BigInt(0);
  return BigInt(clean);
}

export async function readUsdcBalance(network: string, address: string): Promise<{ available: true; amount: string } | { available: false; reason: string }> {
  const unsupported = "Saldo no disponible. La dirección puede ser de un exchange o la red no tiene un RPC configurado.";
  try {
    if (network in USDC) {
      const rpc = rpcEnv(network);
      if (!rpc) return { available: false, reason: unsupported };
      const token = USDC[network];
      const response = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
          params: [{ to: token.contract, data: encodeBalanceOf(address) }, "latest"],
        }),
        signal: AbortSignal.timeout(8000),
      });
      const body = (await response.json()) as { result?: string; error?: { message?: string } };
      if (!response.ok || body.error || !body.result) return { available: false, reason: unsupported };
      return { available: true, amount: formatToken(decodeHexQuantity(body.result), token.decimals) };
    }
    if (network === "solana") {
      const rpc = rpcEnv("solana");
      if (!rpc) return { available: false, reason: unsupported };
      const response = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTokenAccountsByOwner",
          params: [address, { mint: SOLANA_USDC }, { encoding: "jsonParsed" }],
        }),
        signal: AbortSignal.timeout(8000),
      });
      const body = (await response.json()) as {
        result?: { value?: { account?: { data?: { parsed?: { info?: { tokenAmount?: { uiAmountString?: string } } } } } }[] };
      };
      const amounts = body.result?.value ?? [];
      if (amounts.length === 0) return { available: false, reason: unsupported };
      const total = amounts.reduce((sum, item) => sum + Number(item.account?.data?.parsed?.info?.tokenAmount?.uiAmountString ?? 0), 0);
      return { available: true, amount: total.toFixed(2) };
    }
    return { available: false, reason: unsupported };
  } catch {
    return { available: false, reason: unsupported };
  }
}
