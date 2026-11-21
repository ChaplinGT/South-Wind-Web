import { bridgeBaseUrl } from "../env";
import { BridgeError, bridgeErrorMessage } from "./errors";
import type {
  BridgeClient,
  BridgeCustomer,
  BridgeExternalAccount,
  BridgeList,
  BridgeTransfer,
  BridgeVirtualAccount,
  BridgeWallet,
  KycLink,
} from "./types";

type FetchLike = typeof fetch;

export class BridgeHttpClient implements BridgeClient {
  constructor(
    private readonly options: {
      apiKey: string;
      baseUrl?: string;
      fetchImpl?: FetchLike;
    },
  ) {}

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    opts?: { body?: unknown; idempotencyKey?: string },
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Api-Key": this.options.apiKey,
      Accept: "application/json",
    };
    let body: string | undefined;
    if (opts?.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.body);
    }
    if (method === "POST") {
      if (!opts?.idempotencyKey) {
        throw new BridgeError("Falta la clave de idempotencia para esta operación.", 400);
      }
      headers["Idempotency-Key"] = opts.idempotencyKey;
    }
    const base = (this.options.baseUrl || bridgeBaseUrl()).replace(/\/$/, "");
    const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
    const fetchImpl = this.options.fetchImpl ?? fetch;
    let response: Response;
    try {
      response = await fetchImpl(url, { method, headers, body });
    } catch {
      throw new BridgeError("No se pudo contactar a Bridge. Intente nuevamente.", 503);
    }
    const text = await response.text();
    if (!response.ok) {
      throw new BridgeError(bridgeErrorMessage(response.status, text, this.options.apiKey), response.status);
    }
    if (!text) return {} as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new BridgeError("Bridge devolvió una respuesta que no se pudo leer.", 502);
    }
  }

  listCustomers(params?: { limit?: number }) {
    const query = params?.limit ? `?limit=${params.limit}` : "";
    return this.request<BridgeList<BridgeCustomer>>("GET", `/customers${query}`);
  }

  getCustomer(id: string) {
    return this.request<BridgeCustomer>("GET", `/customers/${encodeURIComponent(id)}`);
  }

  createCustomer(input: Record<string, unknown>, idempotencyKey: string) {
    return this.request<BridgeCustomer>("POST", "/customers", { body: input, idempotencyKey });
  }

  async getKycLink(customerId: string): Promise<KycLink> {
    const data = await this.request<Record<string, unknown>>(
      "GET",
      `/customers/${encodeURIComponent(customerId)}/kyc_link`,
    );
    const url = stringField(data, "url") || stringField(data, "kyc_link");
    if (!url) throw new BridgeError("Bridge no devolvió el enlace de verificación.", 502);
    return {
      url,
      tos_url: stringField(data, "tos_link") || stringField(data, "tos_url"),
      kyc_status: stringField(data, "kyc_status"),
    };
  }

  listExternalAccounts(customerId: string) {
    return this.asList<BridgeExternalAccount>(
      `/customers/${encodeURIComponent(customerId)}/external_accounts`,
    );
  }

  createExternalAccount(customerId: string, input: Record<string, unknown>, idempotencyKey: string) {
    return this.request<BridgeExternalAccount>(
      "POST",
      `/customers/${encodeURIComponent(customerId)}/external_accounts`,
      { body: input, idempotencyKey },
    );
  }

  listVirtualAccounts(customerId: string) {
    return this.asList<BridgeVirtualAccount>(
      `/customers/${encodeURIComponent(customerId)}/virtual_accounts`,
    );
  }

  createVirtualAccount(customerId: string, input: Record<string, unknown>, idempotencyKey: string) {
    return this.request<BridgeVirtualAccount>(
      "POST",
      `/customers/${encodeURIComponent(customerId)}/virtual_accounts`,
      { body: input, idempotencyKey },
    );
  }

  listWallets(customerId: string) {
    return this.asList<BridgeWallet>(`/customers/${encodeURIComponent(customerId)}/wallets`);
  }

  createWallet(customerId: string, input: Record<string, unknown>, idempotencyKey: string) {
    return this.request<BridgeWallet>("POST", `/customers/${encodeURIComponent(customerId)}/wallets`, {
      body: input,
      idempotencyKey,
    });
  }

  listTransfers(params?: { limit?: number }) {
    const query = params?.limit ? `?limit=${params.limit}` : "";
    return this.asList<BridgeTransfer>(`/transfers${query}`);
  }

  getTransfer(id: string) {
    return this.request<BridgeTransfer>("GET", `/transfers/${encodeURIComponent(id)}`);
  }

  createTransfer(input: Record<string, unknown>, idempotencyKey: string) {
    return this.request<BridgeTransfer>("POST", "/transfers", { body: input, idempotencyKey });
  }

  simulateDeposit(customerId: string, virtualAccountId: string, input: { amount: string }, idempotencyKey: string) {
    return this.request<Record<string, unknown>>(
      "POST",
      `/customers/${encodeURIComponent(customerId)}/virtual_accounts/${encodeURIComponent(virtualAccountId)}/simulate_deposit`,
      { body: { amount: input.amount, currency: "usd" }, idempotencyKey },
    );
  }

  private async asList<T>(path: string): Promise<BridgeList<T>> {
    const raw = await this.request<unknown>("GET", path);
    if (Array.isArray(raw)) return { count: raw.length, data: raw as T[] };
    const body = (raw ?? {}) as { count?: number; data?: T[] };
    const data = body.data ?? [];
    return { count: body.count ?? data.length, data };
  }
}

function stringField(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key];
  return typeof value === "string" && value ? value : undefined;
}
