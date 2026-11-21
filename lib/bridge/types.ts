export type BridgeList<T> = { count: number; data: T[] };

export type BridgeEndorsement = {
  name: string;
  status: string;
  requirements?: {
    complete?: unknown[];
    pending?: unknown[];
    missing?: unknown;
    issues?: unknown[];
  };
};

export type BridgeCustomer = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  status: string;
  type?: "individual" | "business" | string;
  client_reference_id?: string | null;
  persona_inquiry_type?: string;
  has_accepted_terms_of_service?: boolean;
  endorsements?: BridgeEndorsement[];
  rejection_reasons?: unknown[];
  capabilities?: Record<string, string>;
  requirements_due?: string[];
  future_requirements_due?: string[];
  created_at?: string;
  updated_at?: string;
};

export type BridgeExternalAccount = {
  id: string;
  customer_id: string;
  currency: string;
  account_type: string;
  bank_name?: string;
  account_owner_name: string;
  account_owner_type?: string;
  business_name?: string;
  active?: boolean;
  last_4?: string;
  created_at: string;
  updated_at?: string;
};

export type BridgeVirtualAccount = {
  id: string;
  customer_id?: string;
  status: string;
  developer_fee_percent: string;
  source_deposit_instructions: {
    currency: string;
    payment_rails?: string[];
    bank_name?: string;
    bank_address?: string;
    bank_beneficiary_name?: string;
    bank_beneficiary_address?: string;
    bank_account_number?: string;
    bank_routing_number?: string;
  };
  destination: {
    currency: string;
    payment_rail: string;
    address?: string;
    bridge_wallet_id?: string;
  };
};

export type BridgeWallet = {
  id: string;
  customer_id?: string;
  chain: string;
  address: string;
  created_at?: string;
  updated_at?: string;
  balances: { balance: string; currency: string; chain?: string }[];
};

export type BridgeTransfer = {
  id: string;
  client_reference_id?: string | null;
  state: string;
  on_behalf_of: string;
  amount: string;
  currency?: string;
  developer_fee: string;
  source: Record<string, unknown>;
  destination: Record<string, unknown>;
  source_deposit_instructions?: Record<string, unknown>;
  receipt?: {
    initial_amount?: string;
    developer_fee?: string;
    exchange_fee?: string;
    subtotal_amount?: string;
    gas_fee?: string;
    final_amount?: string;
    url?: string;
  };
  created_at: string;
  updated_at: string;
};

export type KycLink = {
  url: string;
  tos_url?: string;
  kyc_status?: string;
};

export type BridgeWebhookEvent = {
  api_version?: string;
  event_id: string;
  event_sequence?: number;
  event_category: string;
  event_type: string;
  event_object_id?: string;
  event_object_status?: string | null;
  event_object: Record<string, unknown>;
  event_object_changes?: Record<string, unknown>;
  event_created_at?: string;
};

export interface BridgeClient {
  listCustomers(params?: { limit?: number }): Promise<BridgeList<BridgeCustomer>>;
  getCustomer(id: string): Promise<BridgeCustomer>;
  createCustomer(input: Record<string, unknown>, idempotencyKey: string): Promise<BridgeCustomer>;
  getKycLink(customerId: string): Promise<KycLink>;
  listExternalAccounts(customerId: string): Promise<BridgeList<BridgeExternalAccount>>;
  createExternalAccount(
    customerId: string,
    input: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<BridgeExternalAccount>;
  listVirtualAccounts(customerId: string): Promise<BridgeList<BridgeVirtualAccount>>;
  createVirtualAccount(
    customerId: string,
    input: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<BridgeVirtualAccount>;
  listWallets(customerId: string): Promise<BridgeList<BridgeWallet>>;
  createWallet(customerId: string, input: Record<string, unknown>, idempotencyKey: string): Promise<BridgeWallet>;
  listTransfers(params?: { limit?: number }): Promise<BridgeList<BridgeTransfer>>;
  getTransfer(id: string): Promise<BridgeTransfer>;
  createTransfer(input: Record<string, unknown>, idempotencyKey: string): Promise<BridgeTransfer>;
  simulateDeposit(
    customerId: string,
    virtualAccountId: string,
    input: { amount: string },
    idempotencyKey: string,
  ): Promise<Record<string, unknown>>;
}
