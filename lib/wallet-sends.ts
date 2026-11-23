import { cmp } from "./money";
import { normalizeMoney } from "./pricing";

export const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const DRAIN_STATES = new Set(["funds_received", "payment_submitted", "payment_processed"]);

export function padAddressTopic(address: string): string {
  const hex = address.toLowerCase().replace(/^0x/, "");
  return `0x${hex.padStart(64, "0")}`;
}

export function usdcToRaw(amount: string, decimals: number): bigint {
  const normalized = normalizeMoney(amount);
  const [whole, frac = ""] = normalized.split(".");
  const digits = `${frac}${"0".repeat(decimals)}`.slice(0, decimals);
  const base = BigInt(10) ** BigInt(decimals);
  return BigInt(whole) * base + BigInt(digits || "0");
}

export type ParsedTransfer = { txHash: string; to: string; amountRaw: bigint; blockNumber?: number };

export function parseEvmTransferLogs(
  logs: { topics?: string[]; data?: string; transactionHash?: string; address?: string; blockNumber?: string }[],
  token: string,
  expectedTo?: string,
): ParsedTransfer[] {
  const tokenAddress = token.toLowerCase();
  const toFilter = expectedTo?.toLowerCase();
  const parsed: ParsedTransfer[] = [];
  for (const log of logs) {
    if (log.address && log.address.toLowerCase() !== tokenAddress) continue;
    const topics = log.topics ?? [];
    if (topics[0]?.toLowerCase() !== TRANSFER_TOPIC) continue;
    if (!topics[2] || !log.data || !log.transactionHash) continue;
    const to = `0x${topics[2].slice(-40)}`.toLowerCase();
    if (toFilter && to !== toFilter) continue;
    let amountRaw = BigInt(0);
    try {
      amountRaw = BigInt(log.data);
    } catch {
      continue;
    }
    parsed.push({
      txHash: log.transactionHash,
      to,
      amountRaw,
      blockNumber: log.blockNumber ? Number(BigInt(log.blockNumber)) : undefined,
    });
  }
  return parsed;
}

export type FeeCandidate = { id: string; feeRaw: bigint; createdAt: number };
export type FeeTransfer = { txHash: string; amountRaw: bigint; at?: number };

/** Empareja cada orden con un envío distinto, de al menos el cargo fijo, posterior a la orden. */
export function assignFeeTransfers(orders: FeeCandidate[], transfers: FeeTransfer[], used: Set<string>): { orderId: string; txHash: string }[] {
  const available = transfers.filter((transfer) => !used.has(transfer.txHash));
  const taken = new Set<string>();
  const assignments: { orderId: string; txHash: string }[] = [];
  const sorted = [...orders].sort((a, b) => a.createdAt - b.createdAt);
  for (const order of sorted) {
    const choices = available
      .filter((transfer) => !taken.has(transfer.txHash) && transfer.amountRaw >= order.feeRaw)
      .filter((transfer) => transfer.at === undefined || transfer.at >= order.createdAt - 120_000)
      .sort((a, b) => {
        const exactA = a.amountRaw === order.feeRaw ? 0 : 1;
        const exactB = b.amountRaw === order.feeRaw ? 0 : 1;
        if (exactA !== exactB) return exactA - exactB;
        return (a.at ?? 0) - (b.at ?? 0);
      });
    const chosen = choices[0];
    if (!chosen) continue;
    taken.add(chosen.txHash);
    assignments.push({ orderId: order.id, txHash: chosen.txHash });
  }
  return assignments;
}

export function drainConfirmsPayment(state: string): boolean {
  return DRAIN_STATES.has(state);
}

export function matchDrainOrder(
  orders: { id: string; usdcAmount: string; createdAt: number }[],
  amount: string,
): string | null {
  if (orders.length === 0 || !amount) return null;
  let incoming: string;
  try {
    incoming = normalizeMoney(amount);
  } catch {
    return null;
  }
  const exact = orders
    .filter((order) => {
      try {
        return cmp(normalizeMoney(order.usdcAmount), incoming) === 0;
      } catch {
        return false;
      }
    })
    .sort((a, b) => a.createdAt - b.createdAt);
  return exact[0]?.id ?? null;
}

export function statusFromLegs(feeLeg: string | null | undefined, paymentLeg: string | null | undefined): "pendiente" | "pagado" {
  return feeLeg === "confirmado" && paymentLeg === "confirmado" ? "pagado" : "pendiente";
}
