import { createHash, createSign, generateKeyPairSync } from "crypto";
import { describe, expect, it } from "vitest";
import { BridgeHttpClient } from "@/lib/bridge/http";
import { MockBridge } from "@/lib/bridge/mock";
import { summarizeCustomers, verifyBridgeSignature } from "@/lib/bridge/webhook";
import { demoCompanies, endingBalance } from "@/lib/demo-data";
import { feeAmount } from "@/lib/money";
import { periodBounds } from "@/lib/format";
import { compileStatement } from "@/lib/statements/build";
import { renderStatementPdf } from "@/lib/statements/pdf";
import { registerSchema } from "@/lib/validation";

describe("cliente HTTP de Bridge", () => {
  it("manda Api-Key e Idempotency-Key en POST y no revela la clave", async () => {
    const apiKey = "sk-test-SUPERSECRETVALUE";
    let headers: Headers | undefined;
    const fetchImpl: typeof fetch = async (_url, init) => {
      headers = new Headers(init?.headers);
      return new Response(JSON.stringify({ message: `rechazado ${apiKey}` }), { status: 401 });
    };
    const client = new BridgeHttpClient({
      apiKey,
      baseUrl: "https://api.sandbox.bridge.xyz/v0",
      fetchImpl,
    });
    await expect(client.createCustomer({ type: "business", email: "a@b.co" }, "6d1f0b2e-1c2a-4d3e-8f90-123456789abc")).rejects.toThrow(
      /No se pudo autenticar con Bridge/,
    );
    expect(headers?.get("Api-Key")).toBe(apiKey);
    expect(headers?.get("Idempotency-Key")).toBe("6d1f0b2e-1c2a-4d3e-8f90-123456789abc");
    try {
      await client.createCustomer({ type: "business" }, "6d1f0b2e-1c2a-4d3e-8f90-123456789abc");
    } catch (error) {
      expect((error as Error).message).not.toContain("SUPERSECRETVALUE");
    }
  });

  it("no envía Idempotency-Key en GET /customers", async () => {
    let headers: Headers | undefined;
    let url = "";
    const fetchImpl: typeof fetch = async (input, init) => {
      url = String(input);
      headers = new Headers(init?.headers);
      return new Response(JSON.stringify({ count: 1, data: [{ id: "c1", status: "active", type: "business" }] }), { status: 200 });
    };
    const client = new BridgeHttpClient({ apiKey: "sk-test-abc", baseUrl: "https://api.sandbox.bridge.xyz/v0", fetchImpl });
    const list = await client.listCustomers({ limit: 100 });
    expect(url).toContain("/customers?limit=100");
    expect(headers?.get("Api-Key")).toBe("sk-test-abc");
    expect(headers?.get("Idempotency-Key")).toBeNull();
    expect(summarizeCustomers(list)).toEqual({ count: 1, returned: 1, statuses: { active: 1 } });
  });

  it("exige Idempotency-Key para crear una transferencia", async () => {
    const client = new BridgeHttpClient({ apiKey: "sk-test-abc", fetchImpl: fetch });
    await expect(client.createTransfer({ amount: "1.00" }, "")).rejects.toThrow(/idempotencia/i);
  });
});

describe("modo simulado de Bridge", () => {
  it("lista clientes de negocio con la forma documentada", async () => {
    const bridge = new MockBridge();
    const list = await bridge.listCustomers();
    expect(list.count).toBe(list.data.length);
    expect(list.count).toBeGreaterThanOrEqual(4);
    for (const customer of list.data) {
      expect(customer.id).toBeTruthy();
      expect(customer.type).toBe("business");
      expect(customer.status).toBe("active");
      expect(customer.endorsements?.[0]?.name).toBe("base");
      expect(customer.endorsements?.[0]?.status).toBe("approved");
    }
  });

  it("repite la misma transferencia si se reutiliza la clave de idempotencia", async () => {
    const bridge = new MockBridge();
    const company = demoCompanies[0];
    const payload = {
      amount: "100.00",
      developer_fee: "0.50",
      on_behalf_of: company.bridgeCustomerId,
      client_reference_id: "TEST-1",
      source: { payment_rail: "bridge_wallet", currency: "usdc", bridge_wallet_id: company.walletId },
      destination: {
        payment_rail: "ach",
        currency: "usd",
        external_account_id: company.beneficiaries[0].bridgeId,
      },
    };
    const first = await bridge.createTransfer(payload, "idem-demo-1");
    const second = await bridge.createTransfer(payload, "idem-demo-1");
    expect(second.id).toBe(first.id);
    expect(first.state).toBe("payment_processed");
    expect(first.developer_fee).toBe("0.50");
    expect(first.receipt?.developer_fee).toBe("0.50");
    await expect(bridge.createTransfer({ ...payload, amount: "120.00" }, "idem-demo-1")).rejects.toThrow(/idempotencia/i);
  });
});

describe("firma de webhooks", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = publicKey.export({ type: "spki", format: "pem" }).toString();

  function sign(body: string, timestamp: number) {
    const digest = createHash("sha256").update(`${timestamp}.${body}`).digest();
    const signer = createSign("SHA256");
    signer.update(digest);
    signer.end();
    return `t=${timestamp},v0=${signer.sign(privateKey).toString("base64")}`;
  }

  it("acepta una firma vigente y rechaza una vencida o alterada", () => {
    const body = JSON.stringify({ event_id: "wh_1", event_category: "transfer", event_type: "transfer.updated" });
    const now = Date.now();
    expect(verifyBridgeSignature(body, sign(body, now), pem, now).ok).toBe(true);
    expect(verifyBridgeSignature(body, sign(body, now - 11 * 60 * 1000), pem, now).ok).toBe(false);
    expect(verifyBridgeSignature(`${body} `, sign(body, now), pem, now).ok).toBe(false);
    const missing = verifyBridgeSignature(body, null, pem, now);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toMatch(/firma/i);
  });
});

describe("extractos, comisiones y validación", () => {
  it("arma el extracto de octubre con saldo corrido", () => {
    const andina = demoCompanies[0];
    expect(endingBalance(andina.ledger)).toBe("26141.00");
    const { start, end } = periodBounds(2026, 10);
    const statement = compileStatement(andina.ledger, start, end);
    expect(statement.openingBalance).toBe("25000.00");
    expect(statement.totalDebits).toBe("11356.50");
    expect(statement.totalCredits).toBe("18000.00");
    expect(statement.closingBalance).toBe("31643.50");
    expect(statement.lines.at(-1)?.balance).toBe("31643.50");
  });

  it("calcula la comisión de referencia", () => {
    expect(feeAmount("8200.00", "0.50")).toBe("41.00");
    expect(feeAmount("3100.00", "0.50")).toBe("15.50");
  });

  it("responde en español cuando el NIT no es válido", () => {
    const result = registerSchema.safeParse({
      contactName: "Ana",
      email: "ana@empresa.example",
      password: "ClaveSegura1",
      legalName: "Empresa Nueva S.R.L.",
      tradeName: "Empresa Nueva",
      nit: "12",
      phone: "+591 2 2000000",
      city: "La Paz",
      address: "Calle 1",
      clientType: "importador",
      acceptTerms: true,
      acceptConversion: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes("NIT"))).toBe(true);
    }
  });

  it("genera un PDF de extracto", async () => {
    const pdf = await renderStatementPdf({
      mock: true,
      statementNumber: "EXT-2026-00001",
      verificationCode: "SW-ANDI-4F7Q",
      verificationUrl: "http://localhost:3000/verificar/SW-ANDI-4F7Q",
      generatedAt: new Date("2026-11-01T16:00:00.000Z"),
      periodLabel: "1 de octubre de 2026 — 31 de octubre de 2026",
      periodStart: new Date("2026-10-01T04:00:00.000Z"),
      periodEnd: new Date("2026-11-01T03:59:59.999Z"),
      company: { legalName: "Importadora Andina S.R.L.", nit: "1029384756", address: "Av. Arce 2345", city: "La Paz" },
      openingBalance: "25000.00",
      closingBalance: "31643.50",
      totalDebits: "11356.50",
      totalCredits: "18000.00",
      lines: [
        {
          postedAt: "2026-10-03T16:00:00.000Z",
          reference: "PAG-3018",
          description: "Pago ACH",
          debit: "8241.00",
          credit: "0.00",
          balance: "16759.00",
        },
      ],
    });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
