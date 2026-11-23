import { randomUUID } from "crypto";
import { prisma } from "../db";
import { demoCompanies, endingBalance, unlinkedBridgeCustomer } from "../demo-data";
import { appUrl } from "../env";
import { add, sub } from "../money";
import { rails, type RailKey } from "../rails";
import { BridgeError } from "./errors";
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

type Store = {
  customers: BridgeCustomer[];
  externalAccounts: BridgeExternalAccount[];
  virtualAccounts: BridgeVirtualAccount[];
  wallets: BridgeWallet[];
  transfers: BridgeTransfer[];
  idempotency: Record<string, { hash: string; body: unknown }>;
};

function endorsement(name: string) {
  return { name, status: "approved", requirements: { complete: ["kyb_review"], pending: [], missing: null, issues: [] } };
}

function customer(input: {
  id: string;
  name: string;
  email: string;
  status?: string;
  reference?: string | null;
}): BridgeCustomer {
  const now = "2026-08-01T16:00:00.000Z";
  return {
    id: input.id,
    first_name: input.name,
    last_name: null,
    email: input.email,
    status: input.status ?? "active",
    type: "business",
    client_reference_id: input.reference ?? null,
    persona_inquiry_type: "business",
    has_accepted_terms_of_service: true,
    rejection_reasons: [],
    requirements_due: [],
    future_requirements_due: [],
    capabilities: { payin_crypto: "active", payout_crypto: "active", payin_fiat: "active", payout_fiat: "active" },
    endorsements: [endorsement("base"), endorsement("sepa")],
    created_at: now,
    updated_at: now,
  };
}

function virtualAccount(input: {
  id: string;
  customerId: string;
  walletId: string;
  address: string;
  accountNumber: string;
  routingNumber: string;
  beneficiary: string;
}): BridgeVirtualAccount {
  return {
    id: input.id,
    customer_id: input.customerId,
    status: "activated",
    developer_fee_percent: "0.50",
    source_deposit_instructions: {
      currency: "usd",
      payment_rails: ["ach_push", "fednow", "wire"],
      bank_name: "Lead Bank",
      bank_address: "1801 Main St., Kansas City, MO 64108",
      bank_beneficiary_name: input.beneficiary,
      bank_beneficiary_address: "Domicilio registrado: [completar dirección en Montana]",
      bank_account_number: input.accountNumber,
      bank_routing_number: input.routingNumber,
    },
    destination: {
      currency: "usdc",
      payment_rail: "base",
      address: input.address,
      bridge_wallet_id: input.walletId,
    },
  };
}

function initialStore(): Store {
  const customers: BridgeCustomer[] = [];
  const externalAccounts: BridgeExternalAccount[] = [];
  const virtualAccounts: BridgeVirtualAccount[] = [];
  const wallets: BridgeWallet[] = [];
  const transfers: BridgeTransfer[] = [];

  for (const company of demoCompanies) {
    customers.push(
      customer({
        id: company.bridgeCustomerId,
        name: company.legalName,
        email: company.email,
        reference: `southwind:${company.slug}`,
      }),
    );
    wallets.push({
      id: company.walletId,
      customer_id: company.bridgeCustomerId,
      chain: "base",
      address: company.walletAddress,
      created_at: "2026-08-01T16:00:00.000Z",
      balances: [{ balance: endingBalance(company.ledger), currency: "usdc", chain: "base" }],
    });
    virtualAccounts.push(
      virtualAccount({
        id: company.virtualAccountId,
        customerId: company.bridgeCustomerId,
        walletId: company.walletId,
        address: company.walletAddress,
        accountNumber: company.accountNumber,
        routingNumber: company.routingNumber,
        beneficiary: company.legalName,
      }),
    );
    for (const beneficiary of company.beneficiaries) {
      const rail = rails[beneficiary.rail];
      externalAccounts.push({
        id: beneficiary.bridgeId,
        customer_id: company.bridgeCustomerId,
        currency: rail.currency,
        account_type: rail.accountType,
        bank_name: beneficiary.bankName,
        account_owner_name: beneficiary.accountOwnerName,
        account_owner_type: "business",
        business_name: beneficiary.accountOwnerName,
        active: true,
        last_4: beneficiary.last4,
        created_at: "2026-08-12T16:00:00.000Z",
        updated_at: "2026-08-12T16:00:00.000Z",
      });
    }
    for (const entry of company.ledger) {
      if (!entry.bridgeTransferId || !entry.principal) continue;
      transfers.push(buildTransfer({
        id: entry.bridgeTransferId,
        customerId: company.bridgeCustomerId,
        walletId: company.walletId,
        amount: entry.principal,
        fee: entry.fee ?? "0.00",
        externalAccountId: entry.beneficiaryBridgeId ?? "",
        rail: entry.beneficiaryBridgeId
          ? company.beneficiaries.find((item) => item.bridgeId === entry.beneficiaryBridgeId)?.rail ?? "ach"
          : "ach",
        reference: entry.reference,
        state: entry.state ?? "payment_processed",
        createdAt: entry.postedAt,
      }));
    }
  }

  const extra = unlinkedBridgeCustomer;
  customers.push(customer({ id: extra.bridgeCustomerId, name: extra.legalName, email: extra.email }));
  wallets.push({
    id: extra.walletId,
    customer_id: extra.bridgeCustomerId,
    chain: "base",
    address: extra.walletAddress,
    created_at: "2026-07-20T16:00:00.000Z",
    balances: [{ balance: "0.00", currency: "usdc", chain: "base" }],
  });
  virtualAccounts.push(
    virtualAccount({
      id: extra.virtualAccountId,
      customerId: extra.bridgeCustomerId,
      walletId: extra.walletId,
      address: extra.walletAddress,
      accountNumber: extra.accountNumber,
      routingNumber: extra.routingNumber,
      beneficiary: extra.legalName,
    }),
  );

  return { customers, externalAccounts, virtualAccounts, wallets, transfers, idempotency: {} };
}

function railKeyFromBridge(paymentRail: string): RailKey {
  if (paymentRail === "ach_same_day" || paymentRail === "ach") return "ach";
  const found = (Object.keys(rails) as RailKey[]).find((key) => rails[key].bridgeRail === paymentRail);
  return found ?? "ach";
}

function buildTransfer(input: {
  id: string;
  customerId: string;
  walletId: string;
  amount: string;
  fee: string;
  externalAccountId: string;
  rail: RailKey;
  reference: string;
  state: string;
  createdAt: string;
}): BridgeTransfer {
  const rail = rails[input.rail];
  const finalAmount = sub(input.amount, "0.00");
  return {
    id: input.id,
    client_reference_id: input.reference,
    state: input.state,
    on_behalf_of: input.customerId,
    amount: input.amount,
    currency: "usd",
    developer_fee: input.fee,
    source: { payment_rail: "bridge_wallet", currency: "usdc", bridge_wallet_id: input.walletId },
    destination: {
      payment_rail: rail.bridgeRail,
      currency: rail.currency,
      external_account_id: input.externalAccountId,
    },
    receipt: {
      initial_amount: input.amount,
      developer_fee: input.fee,
      exchange_fee: "0.0",
      subtotal_amount: finalAmount,
      gas_fee: "0.0",
      final_amount: finalAmount,
      url: `${appUrl()}/app/movimientos`,
    },
    created_at: input.createdAt,
    updated_at: input.createdAt,
  };
}

function last4Of(value: unknown): string {
  const digits = String(value ?? "").replace(/\s+/g, "");
  return digits.slice(-4) || "0000";
}

export class MockBridge implements BridgeClient {
  private store: Store;
  private hydrated = false;
  private hydrating: Promise<void> | null = null;

  constructor(private readonly options: { persist?: boolean } = {}) {
    this.store = initialStore();
  }

  private async hydrate() {
    if (!this.options.persist || this.hydrated) return;
    if (!this.hydrating) {
      this.hydrating = (async () => {
        try {
          const row = await prisma.bridgeMockState.findUnique({ where: { id: "default" } });
          if (row?.json) this.store = JSON.parse(row.json) as Store;
        } catch {
          /* la tabla puede no existir todavía; se usan los fixtures */
        }
        this.hydrated = true;
      })();
    }
    await this.hydrating;
  }

  private async save() {
    if (!this.options.persist) return;
    const json = JSON.stringify(this.store);
    await prisma.bridgeMockState.upsert({
      where: { id: "default" },
      update: { json },
      create: { id: "default", json },
    });
  }

  private remember(key: string, hash: string, body: unknown) {
    const existing = this.store.idempotency[key];
    if (existing) {
      if (existing.hash !== hash) {
        throw new BridgeError("La clave de idempotencia ya se usó con otro cuerpo.", 422);
      }
      return existing.body;
    }
    return null;
  }

  private async storeIdempotency(key: string, hash: string, body: unknown) {
    this.store.idempotency[key] = { hash, body };
    await this.save();
    return body;
  }

  async createLiquidationAddress(customerId: string, input: Record<string, unknown>, idempotencyKey: string) {
    await this.hydrate();
    const hash = JSON.stringify({ customerId, ...input });
    const replay = this.remember(idempotencyKey, hash, null);
    if (replay) return replay as { id: string; address: string; chain: string; currency: string };
    const created = {
      id: randomUUID(),
      address: `0x${randomUUID().replace(/-/g, "")}aa`.slice(0, 42),
      chain: String(input.chain || "base"),
      currency: String(input.currency || "usdc"),
      custom_developer_fee_percent: input.custom_developer_fee_percent
        ? String(input.custom_developer_fee_percent)
        : undefined,
    };
    return (await this.storeIdempotency(idempotencyKey, hash, created)) as {
      id: string;
      address: string;
      chain: string;
      currency: string;
    };
  }

  async updateLiquidationAddress(customerId: string, liquidationAddressId: string, input: Record<string, unknown>) {
    await this.getCustomer(customerId);
    return { id: liquidationAddressId };
  }

  async getExchangeRate() {
    await this.hydrate();
    return { midmarket_rate: "0.9200", buy_rate: "0.9250", sell_rate: "0.9150" };
  }

  async listCustomers(params?: { limit?: number }) {
    await this.hydrate();
    const data = this.store.customers.slice(0, params?.limit ?? this.store.customers.length);
    return { count: data.length, data };
  }

  async getCustomer(id: string) {
    await this.hydrate();
    const found = this.store.customers.find((item) => item.id === id);
    if (!found) throw new BridgeError("No encontramos la cuenta.", 404);
    return found;
  }

  async createCustomer(input: Record<string, unknown>, idempotencyKey: string) {
    await this.hydrate();
    const hash = JSON.stringify(input);
    const replay = this.remember(idempotencyKey, hash, null);
    if (replay) return replay as BridgeCustomer;
    const now = new Date().toISOString();
    const created = customer({
      id: randomUUID(),
      name: String(input.business_legal_name || input.first_name || "Empresa"),
      email: String(input.email || ""),
      status: "incomplete",
      reference: input.client_reference_id ? String(input.client_reference_id) : null,
    });
    created.has_accepted_terms_of_service = false;
    created.endorsements = [{ name: "base", status: "incomplete", requirements: { pending: ["kyb_review"], complete: [], missing: null, issues: [] } }];
    created.capabilities = { payin_crypto: "pending", payout_crypto: "pending", payin_fiat: "pending", payout_fiat: "pending" };
    created.created_at = now;
    created.updated_at = now;
    this.store.customers.push(created);
    return (await this.storeIdempotency(idempotencyKey, hash, created)) as BridgeCustomer;
  }

  async getKycLink(customerId: string): Promise<KycLink> {
    await this.getCustomer(customerId);
    const base = appUrl();
    return {
      url: `${base}/sandbox/kyb/${customerId}`,
      tos_url: `${base}/sandbox/kyb/${customerId}?paso=condiciones`,
      kyc_status: "incomplete",
    };
  }

  async listExternalAccounts(customerId: string) {
    await this.hydrate();
    const data = this.store.externalAccounts.filter((item) => item.customer_id === customerId);
    return { count: data.length, data };
  }

  async createExternalAccount(customerId: string, input: Record<string, unknown>, idempotencyKey: string) {
    await this.getCustomer(customerId);
    const hash = JSON.stringify(input);
    const replay = this.remember(idempotencyKey, hash, null);
    if (replay) return replay as BridgeExternalAccount;
    const account = (input.account ?? {}) as Record<string, unknown>;
    const iban = (input.iban ?? {}) as Record<string, unknown>;
    const rawNumber = account.account_number || iban.account_number || account.pix_key || "";
    const now = new Date().toISOString();
    const created: BridgeExternalAccount = {
      id: randomUUID(),
      customer_id: customerId,
      currency: String(input.currency || "usd"),
      account_type: String(input.account_type || "us"),
      bank_name: String(input.bank_name || ""),
      account_owner_name: String(input.account_owner_name || ""),
      account_owner_type: String(input.account_owner_type || "business"),
      business_name: input.business_name ? String(input.business_name) : undefined,
      active: true,
      last_4: last4Of(rawNumber),
      created_at: now,
      updated_at: now,
    };
    this.store.externalAccounts.push(created);
    return (await this.storeIdempotency(idempotencyKey, hash, created)) as BridgeExternalAccount;
  }

  async listVirtualAccounts(customerId: string) {
    await this.hydrate();
    const data = this.store.virtualAccounts.filter((item) => item.customer_id === customerId);
    return { count: data.length, data };
  }

  async createVirtualAccount(customerId: string, input: Record<string, unknown>, idempotencyKey: string) {
    const owner = await this.getCustomer(customerId);
    const hash = JSON.stringify(input);
    const replay = this.remember(idempotencyKey, hash, null);
    if (replay) return replay as BridgeVirtualAccount;
    if (input.developer_fee_percent !== undefined && input.fee_config !== undefined) {
      throw new BridgeError("No se pudo abrir la cuenta. Intente nuevamente.", 422);
    }
    const destination = (input.destination ?? {}) as Record<string, unknown>;
    const wallet = this.store.wallets.find((item) => item.id === destination.bridge_wallet_id) ??
      this.store.wallets.find((item) => item.customer_id === customerId);
    const created = virtualAccount({
      id: randomUUID().replace(/-/g, ""),
      customerId,
      walletId: wallet?.id ?? "",
      address: wallet?.address ?? "",
      accountNumber: `2000${Math.floor(100000 + Math.random() * 899999)}`,
      routingNumber: "87654321",
      beneficiary: owner.first_name || "Cliente South Wind",
    });
    const feeConfig = input.fee_config as { source?: { default?: { fee_percent?: string; fee_amount?: string } } } | undefined;
    created.developer_fee_percent = String(
      input.developer_fee_percent ?? feeConfig?.source?.default?.fee_percent ?? "1.25",
    );
    if (feeConfig) created.fee_config = feeConfig;
    const source = (input.source ?? {}) as { currency?: string };
    const currency = String(source.currency || "usd");
    if (currency !== "usd") {
      created.source_deposit_instructions = {
        ...created.source_deposit_instructions,
        currency,
        payment_rails: currency === "eur" ? ["sepa"] : currency === "brl" ? ["pix"] : currency === "mxn" ? ["spei"] : ["ach_push"],
      };
    }
    this.store.virtualAccounts.push(created);
    return (await this.storeIdempotency(idempotencyKey, hash, created)) as BridgeVirtualAccount;
  }

  async updateVirtualAccount(customerId: string, virtualAccountId: string, input: Record<string, unknown>) {
    await this.getCustomer(customerId);
    if (input.developer_fee_percent !== undefined && input.fee_config !== undefined) {
      throw new BridgeError("No se pudo abrir la cuenta. Intente nuevamente.", 422);
    }
    const found = this.store.virtualAccounts.find((item) => item.id === virtualAccountId && item.customer_id === customerId);
    if (!found) throw new BridgeError("No encontramos la cuenta.", 404);
    const feeConfig = input.fee_config as BridgeVirtualAccount["fee_config"] | undefined;
    if (input.developer_fee_percent !== undefined) {
      found.developer_fee_percent = String(input.developer_fee_percent);
      delete found.fee_config;
    }
    if (feeConfig) {
      found.fee_config = feeConfig;
      found.developer_fee_percent = String(feeConfig.source?.default?.fee_percent ?? found.developer_fee_percent);
    }
    await this.save();
    return found;
  }

  async listWallets(customerId: string) {
    await this.hydrate();
    const data = this.store.wallets.filter((item) => item.customer_id === customerId);
    return { count: data.length, data };
  }

  async createWallet(customerId: string, input: Record<string, unknown>, idempotencyKey: string) {
    await this.getCustomer(customerId);
    const hash = JSON.stringify(input);
    const replay = this.remember(idempotencyKey, hash, null);
    if (replay) return replay as BridgeWallet;
    const created: BridgeWallet = {
      id: randomUUID().replace(/-/g, ""),
      customer_id: customerId,
      chain: String(input.chain || "base"),
      address: `0x${randomUUID().replace(/-/g, "").slice(0, 40)}`,
      created_at: new Date().toISOString(),
      balances: [{ balance: "0.00", currency: "usdc", chain: String(input.chain || "base") }],
    };
    this.store.wallets.push(created);
    return (await this.storeIdempotency(idempotencyKey, hash, created)) as BridgeWallet;
  }

  async listTransfers() {
    await this.hydrate();
    return { count: this.store.transfers.length, data: this.store.transfers };
  }

  async getTransfer(id: string) {
    await this.hydrate();
    const found = this.store.transfers.find((item) => item.id === id);
    if (!found) throw new BridgeError("No encontramos la transferencia.", 404);
    return found;
  }

  async createTransfer(input: Record<string, unknown>, idempotencyKey: string) {
    await this.hydrate();
    const hash = JSON.stringify(input);
    const replay = this.remember(idempotencyKey, hash, null);
    if (replay) return replay as BridgeTransfer;
    const source = (input.source ?? {}) as Record<string, unknown>;
    const destination = (input.destination ?? {}) as Record<string, unknown>;
    const depositRail = String(source.payment_rail || "");
    if (depositRail && depositRail !== "bridge_wallet") {
      const amount = String(input.amount);
      const fee = String(input.developer_fee ?? "0.00");
      const now = new Date().toISOString();
      const chain = depositRail;
      const created = buildTransfer({
        id: randomUUID(),
        customerId: String(input.on_behalf_of),
        walletId: "",
        amount,
        fee,
        externalAccountId: String(destination.external_account_id ?? ""),
        rail: railKeyFromBridge(String(destination.payment_rail || "")),
        reference: String(input.client_reference_id ?? ""),
        state: "awaiting_funds",
        createdAt: now,
      });
      created.source = { payment_rail: chain, currency: "usdc" };
      created.source_deposit_instructions = {
        payment_rail: chain,
        currency: "usdc",
        to_address: `0x${randomUUID().replace(/-/g, "").slice(0, 40)}`,
        amount: add(amount, fee),
      };
      this.store.transfers.unshift(created);
      return (await this.storeIdempotency(idempotencyKey, hash, created)) as BridgeTransfer;
    }
    const wallet = this.store.wallets.find((item) => item.id === source.bridge_wallet_id);
    if (!wallet) throw new BridgeError("No encontramos la billetera de origen.", 422);
    const amount = String(input.amount);
    const fee = String(input.developer_fee ?? "0.00");
    const total = add(amount, fee);
    const balance = wallet.balances.find((item) => item.currency === "usdc");
    if (!balance || Number(balance.balance) < Number(total)) {
      throw new BridgeError("Saldo insuficiente en la billetera.", 422);
    }
    balance.balance = sub(balance.balance, total);
    const now = new Date().toISOString();
    const rail = railKeyFromBridge(String(destination.payment_rail || ""));
    const created = buildTransfer({
      id: randomUUID(),
      customerId: String(input.on_behalf_of),
      walletId: wallet.id,
      amount,
      fee,
      externalAccountId: String(destination.external_account_id ?? ""),
      rail,
      reference: String(input.client_reference_id ?? ""),
      state: "payment_processed",
      createdAt: now,
    });
    this.store.transfers.unshift(created);
    return (await this.storeIdempotency(idempotencyKey, hash, created)) as BridgeTransfer;
  }

  async adjustUsdc(customerId: string, delta: string) {
    await this.hydrate();
    const wallet = this.store.wallets.find((item) => item.customer_id === customerId);
    const balance = wallet?.balances.find((item) => item.currency === "usdc");
    if (!balance) return;
    balance.balance = add(balance.balance, delta);
    await this.save();
  }

  async markCustomerActive(id: string) {
    await this.hydrate();
    const found = this.store.customers.find((item) => item.id === id);
    if (!found) throw new BridgeError("No encontramos la cuenta.", 404);
    found.status = "active";
    found.has_accepted_terms_of_service = true;
    found.updated_at = new Date().toISOString();
    found.requirements_due = [];
    found.endorsements = [
      { name: "base", status: "approved", requirements: { complete: ["kyb_review"], pending: [], missing: null, issues: [] } },
      { name: "sepa", status: "approved", requirements: { complete: ["kyb_review"], pending: [], missing: null, issues: [] } },
    ];
    found.capabilities = {
      payin_crypto: "active",
      payout_crypto: "active",
      payin_fiat: "active",
      payout_fiat: "active",
    };
    await this.save();
    return found;
  }

  async simulateDeposit(customerId: string, virtualAccountId: string, input: { amount: string }, idempotencyKey: string) {
    await this.hydrate();
    const hash = JSON.stringify({ customerId, virtualAccountId, ...input });
    const replay = this.remember(idempotencyKey, hash, null);
    if (replay) return replay as Record<string, unknown>;
    const account = this.store.virtualAccounts.find(
      (item) => item.id === virtualAccountId && item.customer_id === customerId,
    );
    if (!account) throw new BridgeError("No encontramos la cuenta.", 404);
    const wallet = this.store.wallets.find((item) => item.customer_id === customerId);
    const balance = wallet?.balances.find((item) => item.currency === "usdc");
    if (balance) balance.balance = add(balance.balance, input.amount);
    const event = {
      id: randomUUID(),
      type: "payment_processed",
      amount: input.amount,
      currency: "usd",
      customer_id: customerId,
      virtual_account_id: virtualAccountId,
      created_at: new Date().toISOString(),
    };
    return (await this.storeIdempotency(idempotencyKey, hash, event)) as Record<string, unknown>;
  }
}

let singleton: MockBridge | null = null;

export function getMockBridge(): MockBridge {
  if (!singleton) {
    singleton = new MockBridge({ persist: true });
  }
  return singleton;
}

export function listShape<T>(data: T[]): BridgeList<T> {
  return { count: data.length, data };
}
