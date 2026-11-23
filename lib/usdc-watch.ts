import { rpcEnv, SOLANA_USDC_MINT, usdcToken } from "./chains";
import { parseEvmTransferLogs, padAddressTopic, TRANSFER_TOPIC, type ParsedTransfer } from "./wallet-sends";

type RpcLog = { topics?: string[]; data?: string; transactionHash?: string; address?: string; blockNumber?: string };

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T | null> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { result?: T; error?: unknown };
    if (body.error || body.result === undefined) return null;
    return body.result;
  } catch {
    return null;
  }
}

async function evmLogs(url: string, token: string, to: string): Promise<ParsedTransfer[] | null> {
  const latestHex = await rpc<string>(url, "eth_blockNumber", []);
  if (!latestHex) return null;
  const latest = Number(BigInt(latestHex));
  const spans = [8000, 1000];
  for (const span of spans) {
    const from = Math.max(latest - span, 0);
    const logs = await rpc<RpcLog[]>(url, "eth_getLogs", [
      {
        fromBlock: `0x${from.toString(16)}`,
        toBlock: "latest",
        address: token,
        topics: [TRANSFER_TOPIC, null, padAddressTopic(to)],
      },
    ]);
    if (logs) return parseEvmTransferLogs(logs, token, to);
  }
  return null;
}

async function blockTime(url: string, blockNumber: number): Promise<number | undefined> {
  const block = await rpc<{ timestamp?: string }>(url, "eth_getBlockByNumber", [`0x${blockNumber.toString(16)}`, false]);
  if (!block?.timestamp) return undefined;
  return Number(BigInt(block.timestamp)) * 1000;
}

export async function findRecentUsdcTransfers(chain: string, toAddress: string): Promise<{ txHash: string; amountRaw: bigint; at?: number }[] | null> {
  const rpcUrl = rpcEnv(chain);
  if (!rpcUrl) return null;
  const token = usdcToken(chain);
  if (token) {
    const logs = await evmLogs(rpcUrl, token.contract, toAddress);
    if (!logs) return null;
    const recent = logs.slice(-12);
    const stamped = [];
    for (const log of recent) {
      const at = log.blockNumber === undefined ? undefined : await blockTime(rpcUrl, log.blockNumber);
      stamped.push({ txHash: log.txHash, amountRaw: log.amountRaw, at });
    }
    return stamped;
  }
  if (chain === "solana") return solanaTransfers(rpcUrl, toAddress);
  return null;
}

export async function receiptPaysFee(chain: string, txHash: string, toAddress: string, minRaw: bigint): Promise<boolean | null> {
  const rpcUrl = rpcEnv(chain);
  if (!rpcUrl) return null;
  const token = usdcToken(chain);
  if (token) {
    const receipt = await rpc<{ logs?: RpcLog[] }>(rpcUrl, "eth_getTransactionReceipt", [txHash]);
    if (!receipt?.logs) return null;
    return parseEvmTransferLogs(receipt.logs, token.contract, toAddress).some((transfer) => transfer.amountRaw >= minRaw);
  }
  if (chain === "solana") {
    const received = await solanaReceived(rpcUrl, txHash, toAddress);
    if (received === null) return null;
    return received >= minRaw;
  }
  return null;
}

async function solanaTransfers(url: string, owner: string): Promise<{ txHash: string; amountRaw: bigint; at?: number }[] | null> {
  const signatures = await rpc<{ signature: string; blockTime?: number | null }[]>(url, "getSignaturesForAddress", [owner, { limit: 8 }]);
  if (!signatures) return null;
  const transfers = [];
  for (const row of signatures) {
    const received = await solanaReceived(url, row.signature, owner);
    if (received === null || received <= BigInt(0)) continue;
    transfers.push({
      txHash: row.signature,
      amountRaw: received,
      at: row.blockTime ? row.blockTime * 1000 : undefined,
    });
  }
  return transfers;
}

async function solanaReceived(url: string, signature: string, owner: string): Promise<bigint | null> {
  const tx = await rpc<{
    blockTime?: number | null;
    meta?: {
      preTokenBalances?: SolanaBalance[];
      postTokenBalances?: SolanaBalance[];
    };
  }>(url, "getTransaction", [signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]);
  if (!tx?.meta) return null;
  const before = solanaBalance(tx.meta.preTokenBalances ?? [], owner);
  const after = solanaBalance(tx.meta.postTokenBalances ?? [], owner);
  if (after < before) return BigInt(0);
  return after - before;
}

type SolanaBalance = { mint?: string; owner?: string; uiTokenAmount?: { amount?: string } };

function solanaBalance(rows: SolanaBalance[], owner: string): bigint {
  return rows
    .filter((row) => row.mint === SOLANA_USDC_MINT && row.owner === owner)
    .reduce((sum, row) => sum + BigInt(row.uiTokenAmount?.amount || "0"), BigInt(0));
}
