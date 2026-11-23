import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash, createSign, generateKeyPairSync } from "crypto";
import { afterEach, describe, expect, it } from "vitest";
import { BridgeHttpClient } from "@/lib/bridge/http";
import { MockBridge } from "@/lib/bridge/mock";
import { summarizeCustomers, verifyBridgeSignature } from "@/lib/bridge/webhook";
import { demoCompanies, endingBalance } from "@/lib/demo-data";
import { feeAmount } from "@/lib/money";
import { periodBounds } from "@/lib/format";
import { compileStatement } from "@/lib/statements/build";
import { renderStatementPdf } from "@/lib/statements/pdf";
import { isValidEmail, otherAdminAction, resolveAdminEmail } from "@/lib/admin-seed";
import { decodeHexQuantity, encodeBalanceOf, formatToken } from "@/lib/chains";
import {
  marginSummary,
  PRICING_DEFAULTS,
  quoteBobProceeds,
  quoteDirectSend,
  quoteWalletSend,
  receiveNetUsdc,
  virtualAccountFeePayload,
} from "@/lib/pricing";
import { applySpread, averageNearMedian, pricesFromBinanceBody } from "@/lib/rates";
import { railsFromEndorsements } from "@/lib/service-rails";
import {
  assignFeeTransfers,
  drainConfirmsPayment,
  matchDrainOrder,
  parseEvmTransferLogs,
  statusFromLegs,
  TRANSFER_TOPIC,
  usdcToRaw,
} from "@/lib/wallet-sends";
import { appUrl, isMockMode } from "@/lib/env";
import { registerSchema } from "@/lib/validation";

describe("entorno", () => {
  const snapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...snapshot };
  });

  it("simula si no hay clave, aunque BRIDGE_MOCK sea false", () => {
    delete process.env.BRIDGE_API_KEY;
    process.env.BRIDGE_MOCK = "false";
    expect(isMockMode()).toBe(true);
    process.env.BRIDGE_API_KEY = "sk-test-demo";
    process.env.BRIDGE_MOCK = "false";
    expect(isMockMode()).toBe(false);
    process.env.BRIDGE_MOCK = "true";
    expect(isMockMode()).toBe(true);
  });

  it("rechaza ADMIN_EMAIL inválido sin incluir el valor en el error", () => {
    expect(resolveAdminEmail(undefined)).toBe("admin@southwind.example");
    expect(resolveAdminEmail("  gterrazas@southwindglobalservices.com ")).toBe(
      "gterrazas@southwindglobalservices.com",
    );
    const bogus = "not-an-email-secret";
    expect(() => resolveAdminEmail(bogus)).toThrow(/no es un correo válido/);
    try {
      resolveAdminEmail(bogus);
    } catch (error) {
      expect((error as Error).message).not.toContain(bogus);
    }
    expect(isValidEmail("gabriel@southwindglobalservices.com")).toBe(true);
    expect(otherAdminAction("gabriel@southwindglobalservices.com", true)).toBe("deactivate");
    expect(otherAdminAction(bogus, false)).toBe("delete");
    expect(otherAdminAction(bogus, true)).toBe("deactivate");
  });

  it("omite el seed de build si SEED_ON_BUILD no es true", () => {
    const result = spawnSync("node", ["scripts/seed-on-build.mjs"], {
      env: { ...process.env, SEED_ON_BUILD: "false" },
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/omite el seed/);
    expect(`${result.stdout}${result.stderr}`).not.toMatch(/VientoSur-2026/);
  });

  it("separa el ingreso del registro", () => {
    const login = readFileSync("app/ingresar/page.tsx", "utf8");
    const signup = readFileSync("app/registro/page.tsx", "utf8");
    const middleware = readFileSync("middleware.ts", "utf8");
    expect(login).not.toContain("RegisterForm");
    expect(login).toContain('href="/registro"');
    expect(login).toContain("Crear cuenta");
    expect(signup).toContain("RegisterForm");
    expect(signup).toContain('href="/ingresar"');
    expect(signup).not.toContain('action="/api/auth/login"');
    expect(readFileSync("app/abrir-cuenta/page.tsx", "utf8")).toContain('"/registro"');
    expect(middleware).toContain('"/registro"');
    expect(readFileSync("components/site.tsx", "utf8")).toContain('href="/registro"');
    expect(readFileSync("app/page.tsx", "utf8")).toContain('href="/registro"');
    expect(readFileSync("app/api/auth/logout/route.ts", "utf8")).toContain('"/ingresar"');
  });

  it("arma la URL pública con APP_URL y, si falta, con VERCEL_URL", () => {
    process.env.APP_URL = "https://portal.southwindglobalservices.com/";
    delete process.env.NEXTAUTH_URL;
    expect(appUrl()).toBe("https://portal.southwindglobalservices.com");
    delete process.env.APP_URL;
    process.env.NEXTAUTH_URL = "https://alias.example";
    expect(appUrl()).toBe("https://alias.example");
    delete process.env.NEXTAUTH_URL;
    process.env.VERCEL_URL = "south-wind-web.vercel.app";
    expect(appUrl()).toBe("https://south-wind-web.vercel.app");
  });
});

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
      /No se pudo completar la operación/,
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

  it("arma la referencia USDC/BOB y los rieles", () => {
    const prices = pricesFromBinanceBody({
      data: [
        { adv: { price: "6.90", classify: "mass" } },
        { adv: { price: "6.91", privilegeType: "promoted" } },
        { adv: { price: "9.50", classify: "mass" } },
        { adv: { price: "6.88", classify: "mass" } },
      ],
    });
    expect(prices).toEqual([6.9, 9.5, 6.88]);
    expect(averageNearMedian([6.9, 9.5, 6.88])).toBeCloseTo((6.9 + 6.88) / 2, 5);
    expect(applySpread(10, 0.5, "add")).toBeCloseTo(10.05, 5);
    expect(applySpread(10, 0, "sub")).toBe(10);
    expect(railsFromEndorsements([{ name: "base", status: "approved" }, { name: "sepa", status: "incomplete" }])).toEqual([
      "ACH mismo día",
      "Wire",
    ]);
    expect(encodeBalanceOf("0x00000000000000000000000000000000000000aa")).toMatch(/^0x70a08231/);
    expect(formatToken(decodeHexQuantity("0x0f4240"), 6)).toBe("1.00");
    const direct = quoteDirectSend({ usdcAmount: "100.00", buyRate: 6.9, fixedFeeUsd: "10.00", sendFeePercent: "1.00" });
    expect(direct).toMatchObject({
      rate: "6.9000",
      principalBob: "690.00",
      fixedFeeBob: "69.00",
      bobAmount: "759.00",
      sendFeeUsdc: "1.00",
      beneficiaryUsdc: "99.00",
    });
    expect(quoteWalletSend("100.00", "1.00", "0.25", "10.00").fee).toBe("11.25");
    expect(receiveNetUsdc("100.00", "10.00", true)).toEqual({ gross: "100.00", fixedFeeUsd: "10.00", net: "90.00" });
    expect(receiveNetUsdc("100.00", "10.00", false).net).toBe("100.00");
    expect(quoteBobProceeds("90.00", 6.9)).toEqual({ rate: "6.9000", bobAmount: "621.00" });
    const withFlat = virtualAccountFeePayload(true, "1.25", "10.00");
    const percentOnly = virtualAccountFeePayload(false, "1.25", "10.00");
    expect(withFlat).toEqual({ fee_config: { source: { default: { fee_amount: "10.0", fee_percent: "1.25" } } } });
    expect(percentOnly).toEqual({ developer_fee_percent: "1.25" });
    expect("developer_fee_percent" in withFlat).toBe(false);
    expect("fee_config" in percentOnly).toBe(false);
    const margins = marginSummary({
      ...PRICING_DEFAULTS,
      feeConfigEnabled: false,
    });
    expect(margins.find((row) => row.route.startsWith("Recepción a la billetera"))?.grossMarginPercent).toBe("0.75");
    expect(margins.find((row) => row.route.startsWith("Envío desde billetera"))?.grossMarginPercent).toBe("1.88");
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

describe("pago desde la billetera del cliente", () => {
  const token = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const southWind = "0x00000000000000000000000000000000000000aa";
  const ten = usdcToRaw("10.00", 6);

  it("exige los dos tramos y reconoce un envío de USDC de al menos el cargo fijo", () => {
    expect(statusFromLegs("pendiente", "confirmado")).toBe("pendiente");
    expect(statusFromLegs("confirmado", "pendiente")).toBe("pendiente");
    expect(statusFromLegs("confirmado", "confirmado")).toBe("pagado");
    expect(drainConfirmsPayment("funds_received")).toBe(true);
    expect(drainConfirmsPayment("canceled")).toBe(false);
    const topicTo = `0x${southWind.slice(2).padStart(64, "0")}`;
    const logs = parseEvmTransferLogs(
      [
        {
          address: token,
          topics: [TRANSFER_TOPIC, `0x${"11".repeat(32)}`, topicTo],
          data: `0x${ten.toString(16)}`,
          transactionHash: "0xfee",
        },
        {
          address: token,
          topics: [TRANSFER_TOPIC, `0x${"11".repeat(32)}`, `0x${"22".repeat(32)}`],
          data: `0x${ten.toString(16)}`,
          transactionHash: "0xother",
        },
      ],
      token,
      southWind,
    );
    expect(logs.map((log) => log.txHash)).toEqual(["0xfee"]);
    const orders = [
      { id: "a", feeRaw: ten, createdAt: 2_000_000 },
      { id: "b", feeRaw: ten, createdAt: 3_000_000 },
    ];
    const assigned = assignFeeTransfers(
      orders,
      [
        { txHash: "0xold", amountRaw: ten, at: 0 },
        { txHash: "0xfee", amountRaw: ten, at: 2_500_000 },
        { txHash: "0xshort", amountRaw: usdcToRaw("9.00", 6), at: 4_000_000 },
      ],
      new Set(),
    );
    expect(assigned).toEqual([{ orderId: "a", txHash: "0xfee" }]);
    expect(matchDrainOrder([{ id: "pay", usdcAmount: "100.00", createdAt: 1 }], "100.0")).toBe("pay");
    expect(matchDrainOrder(
      [
        { id: "one", usdcAmount: "50.00", createdAt: 1 },
        { id: "two", usdcAmount: "80.00", createdAt: 2 },
      ],
      "80.00",
    )).toBe("two");
  });
});
