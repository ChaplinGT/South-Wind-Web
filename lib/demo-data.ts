import { add, sub } from "./money";

export const DEMO_PASSWORD = "VientoSur-2026";

export type DemoBeneficiary = {
  bridgeId: string;
  nickname: string;
  rail: "ach" | "wire" | "sepa" | "spei" | "pix" | "fps";
  accountOwnerName: string;
  bankName: string;
  last4: string;
  country: string;
};

export type DemoLedger = {
  postedAt: string;
  reference: string;
  description: string;
  debit: string;
  credit: string;
  kind: "deposit" | "payout" | "conversion_out" | "conversion_in";
  bridgeTransferId?: string;
  beneficiaryBridgeId?: string;
  principal?: string;
  fee?: string;
  state?: string;
};

export type DemoConversion = {
  direction: "usdc_to_bob" | "bob_to_usdc";
  amount: string;
  status: "pendiente" | "en_proceso" | "pagado";
  reference: string;
  createdAt: string;
  adminNote?: string;
  ledgerReference?: string;
};

export type DemoCompany = {
  slug: string;
  legalName: string;
  tradeName: string;
  nit: string;
  email: string;
  contactName: string;
  phone: string;
  address: string;
  city: string;
  clientType: "importador" | "cuenta_eeuu" | "exportador";
  bridgeCustomerId: string;
  walletId: string;
  walletAddress: string;
  virtualAccountId: string;
  accountNumber: string;
  routingNumber: string;
  beneficiaries: DemoBeneficiary[];
  ledger: DemoLedger[];
  conversions: DemoConversion[];
  bob: { bankName: string; accountNumber: string; accountHolder: string; accountType: "ahorro" | "corriente" };
};

const noon = (isoDay: string) => `${isoDay}T16:00:00.000Z`;

export const demoCompanies: DemoCompany[] = [
  {
    slug: "andina",
    legalName: "Importadora Andina S.R.L.",
    tradeName: "Importadora Andina",
    nit: "1029384756",
    email: "maria.quispe@importadora-andina.example",
    contactName: "María Quispe",
    phone: "+591 2 2441180",
    address: "Av. Arce 2345, Sopocachi",
    city: "La Paz",
    clientType: "importador",
    bridgeCustomerId: "a11a11a1-1111-4111-8111-111111111111",
    walletId: "walandina0000000000000000000000001",
    walletAddress: "0x8f3C2a91bE44d0c1a77e5b9D12c4e6F0a1b2c3d4",
    virtualAccountId: "vaandina0001usd000000000000000001",
    accountNumber: "2000001001",
    routingNumber: "87654321",
    bob: {
      bankName: "Banco Nacional de Bolivia",
      accountNumber: "1500234567",
      accountHolder: "Importadora Andina S.R.L.",
      accountType: "corriente",
    },
    beneficiaries: [
      {
        bridgeId: "eaandinaach000000000000000000001",
        nickname: "Pacific Goods",
        rail: "ach",
        accountOwnerName: "Pacific Goods LLC",
        bankName: "First Harbor Bank",
        last4: "4412",
        country: "USA",
      },
      {
        bridgeId: "eaandinaspei0000000000000000001",
        nickname: "Textiles del Bajío",
        rail: "spei",
        accountOwnerName: "Textiles del Bajio SA de CV",
        bankName: "Banco del Centro",
        last4: "8891",
        country: "MEX",
      },
    ],
    ledger: [
      {
        postedAt: noon("2026-09-15"),
        reference: "DEP-2401",
        description: "Depósito USD recibido en cuenta virtual · comprador europeo",
        debit: "0.00",
        credit: "25000.00",
        kind: "deposit",
      },
      {
        postedAt: noon("2026-10-03"),
        reference: "PAG-3018",
        description: "Pago ACH a Pacific Goods LLC · principal 8.200,00 · comisión 41,00",
        debit: "8241.00",
        credit: "0.00",
        kind: "payout",
        bridgeTransferId: "11111111-aaaa-4111-8111-000000000301",
        beneficiaryBridgeId: "eaandinaach000000000000000000001",
        principal: "8200.00",
        fee: "41.00",
        state: "payment_processed",
      },
      {
        postedAt: noon("2026-10-18"),
        reference: "PAG-3072",
        description: "Pago SPEI a Textiles del Bajío S.A. de C.V. · principal 3.100,00 · comisión 15,50",
        debit: "3115.50",
        credit: "0.00",
        kind: "payout",
        bridgeTransferId: "11111111-aaaa-4111-8111-000000000302",
        beneficiaryBridgeId: "eaandinaspei0000000000000000001",
        principal: "3100.00",
        fee: "15.50",
        state: "payment_processed",
      },
      {
        postedAt: noon("2026-10-28"),
        reference: "DEP-2440",
        description: "Depósito USD recibido en cuenta virtual · pedido de temporada",
        debit: "0.00",
        credit: "18000.00",
        kind: "deposit",
      },
      {
        postedAt: noon("2026-11-06"),
        reference: "CONV-1044",
        description: "Conversión de USDC a bolivianos · solicitud CONV-1044",
        debit: "5000.00",
        credit: "0.00",
        kind: "conversion_out",
      },
      {
        postedAt: noon("2026-11-18"),
        reference: "PAG-3110",
        description: "Pago ACH a Pacific Goods LLC · principal 500,00 · comisión 2,50",
        debit: "502.50",
        credit: "0.00",
        kind: "payout",
        bridgeTransferId: "11111111-aaaa-4111-8111-000000000303",
        beneficiaryBridgeId: "eaandinaach000000000000000000001",
        principal: "500.00",
        fee: "2.50",
        state: "payment_submitted",
      },
    ],
    conversions: [
      {
        direction: "usdc_to_bob",
        amount: "5000.00",
        status: "pagado",
        reference: "CONV-1044",
        createdAt: noon("2026-11-06"),
        adminNote: "Abono coordinado a Banco Nacional de Bolivia.",
        ledgerReference: "CONV-1044",
      },
    ],
  },
  {
    slug: "textil",
    legalName: "Altiplano Textil S.R.L.",
    tradeName: "Altiplano Textil",
    nit: "3874659201",
    email: "juan.choque@altiplano-textil.example",
    contactName: "Juan Choque",
    phone: "+591 4 4452210",
    address: "Av. Blanco Galindo km 8",
    city: "Cochabamba",
    clientType: "cuenta_eeuu",
    bridgeCustomerId: "b22b22b2-2222-4222-8222-222222222222",
    walletId: "waltextil0000000000000000000000001",
    walletAddress: "0x21Aa90cE7710bB4433ddeE0918273645f0a1b2c3",
    virtualAccountId: "vatextil0001usd000000000000000001",
    accountNumber: "2000001002",
    routingNumber: "87654321",
    bob: {
      bankName: "Banco Mercantil Santa Cruz",
      accountNumber: "4011122334",
      accountHolder: "Altiplano Textil S.R.L.",
      accountType: "corriente",
    },
    beneficiaries: [
      {
        bridgeId: "eatextilach000000000000000000001",
        nickname: "Cuenta propia en EE.UU.",
        rail: "ach",
        accountOwnerName: "Altiplano Textil LLC",
        bankName: "Northline Bank",
        last4: "7780",
        country: "USA",
      },
    ],
    ledger: [
      {
        postedAt: noon("2026-09-02"),
        reference: "CONV-1002",
        description: "Conversión de bolivianos a USDC · solicitud CONV-1002",
        debit: "0.00",
        credit: "8000.00",
        kind: "conversion_in",
      },
      {
        postedAt: noon("2026-10-09"),
        reference: "CONV-1020",
        description: "Conversión de bolivianos a USDC · solicitud CONV-1020",
        debit: "0.00",
        credit: "4000.00",
        kind: "conversion_in",
      },
      {
        postedAt: noon("2026-10-20"),
        reference: "PAG-2201",
        description: "Envío ACH a la cuenta propia en Estados Unidos · principal 6.000,00 · comisión 30,00",
        debit: "6030.00",
        credit: "0.00",
        kind: "payout",
        bridgeTransferId: "22222222-bbbb-4222-8222-000000000220",
        beneficiaryBridgeId: "eatextilach000000000000000000001",
        principal: "6000.00",
        fee: "30.00",
        state: "payment_processed",
      },
    ],
    conversions: [
      {
        direction: "bob_to_usdc",
        amount: "55200.00",
        status: "pagado",
        reference: "CONV-1002",
        createdAt: noon("2026-09-02"),
        adminNote: "Se acreditaron 8.000,00 USDC.",
        ledgerReference: "CONV-1002",
      },
      {
        direction: "bob_to_usdc",
        amount: "27600.00",
        status: "pagado",
        reference: "CONV-1020",
        createdAt: noon("2026-10-09"),
        adminNote: "Se acreditaron 4.000,00 USDC.",
        ledgerReference: "CONV-1020",
      },
      {
        direction: "bob_to_usdc",
        amount: "17250.00",
        status: "pendiente",
        reference: "CONV-1108",
        createdAt: noon("2026-11-16"),
        adminNote: "Esperando transferencia desde el banco en Bolivia.",
      },
    ],
  },
  {
    slug: "quinua",
    legalName: "Quinua Real Export S.R.L.",
    tradeName: "Quinua Real",
    nit: "5647382910",
    email: "lucia.mamani@quinua-real.example",
    contactName: "Lucía Mamani",
    phone: "+591 2 5274411",
    address: "Calle Bolívar 118",
    city: "Oruro",
    clientType: "exportador",
    bridgeCustomerId: "c33c33c3-3333-4333-8333-333333333333",
    walletId: "walquinua0000000000000000000000001",
    walletAddress: "0x44bB10de8821cC5544eeF1029384756a0b1c2d3e",
    virtualAccountId: "vaquinua0001usd000000000000000001",
    accountNumber: "2000001003",
    routingNumber: "87654321",
    bob: {
      bankName: "Banco BISA",
      accountNumber: "8800456123",
      accountHolder: "Quinua Real Export S.R.L.",
      accountType: "ahorro",
    },
    beneficiaries: [
      {
        bridgeId: "eaquinuasepa00000000000000000001",
        nickname: "Flete Rotterdam",
        rail: "sepa",
        accountOwnerName: "Noord Freight BV",
        bankName: "Canal Bank",
        last4: "2209",
        country: "NLD",
      },
    ],
    ledger: [
      {
        postedAt: noon("2026-09-20"),
        reference: "DEP-1802",
        description: "Depósito USD recibido en cuenta virtual · comprador de Estados Unidos",
        debit: "0.00",
        credit: "12000.00",
        kind: "deposit",
      },
      {
        postedAt: noon("2026-10-07"),
        reference: "DEP-1833",
        description: "Depósito USD recibido en cuenta virtual · comprador de Países Bajos",
        debit: "0.00",
        credit: "9600.00",
        kind: "deposit",
      },
      {
        postedAt: noon("2026-10-22"),
        reference: "CONV-1033",
        description: "Conversión de USDC a bolivianos · solicitud CONV-1033",
        debit: "7000.00",
        credit: "0.00",
        kind: "conversion_out",
      },
      {
        postedAt: noon("2026-11-10"),
        reference: "DEP-1860",
        description: "Depósito USD recibido en cuenta virtual · comprador de Alemania",
        debit: "0.00",
        credit: "5400.00",
        kind: "deposit",
      },
    ],
    conversions: [
      {
        direction: "usdc_to_bob",
        amount: "7000.00",
        status: "pagado",
        reference: "CONV-1033",
        createdAt: noon("2026-10-22"),
        adminNote: "Abono a Banco BISA.",
        ledgerReference: "CONV-1033",
      },
    ],
  },
  {
    slug: "cafe",
    legalName: "Café de los Yungas S.R.L.",
    tradeName: "Café de los Yungas",
    nit: "2193847560",
    email: "carlos.condori@cafe-yungas.example",
    contactName: "Carlos Condori",
    phone: "+591 2 8123344",
    address: "Zona Central, calle Comercio 42",
    city: "Caranavi",
    clientType: "exportador",
    bridgeCustomerId: "d44d44d4-4444-4444-8444-444444444444",
    walletId: "walcafe000000000000000000000000001",
    walletAddress: "0x90Cc55aa1930dD6655ff2130495867b1c2d3e4f5",
    virtualAccountId: "vacafe000001usd000000000000000001",
    accountNumber: "2000001004",
    routingNumber: "87654321",
    bob: {
      bankName: "Banco Unión",
      accountNumber: "2200789012",
      accountHolder: "Café de los Yungas S.R.L.",
      accountType: "ahorro",
    },
    beneficiaries: [
      {
        bridgeId: "eacafefps0000000000000000000001",
        nickname: "Green Leaf Roasters",
        rail: "fps",
        accountOwnerName: "Green Leaf Roasters Ltd",
        bankName: "Thames Clearing",
        last4: "6614",
        country: "GBR",
      },
    ],
    ledger: [
      {
        postedAt: noon("2026-09-05"),
        reference: "DEP-0901",
        description: "Depósito USD recibido en cuenta virtual · primer embarque",
        debit: "0.00",
        credit: "3000.00",
        kind: "deposit",
      },
      {
        postedAt: noon("2026-10-11"),
        reference: "PAG-4410",
        description: "Pago Faster Payments a Green Leaf Roasters Ltd · principal 1.500,00 · comisión 7,50",
        debit: "1507.50",
        credit: "0.00",
        kind: "payout",
        bridgeTransferId: "44444444-dddd-4444-8444-000000000441",
        beneficiaryBridgeId: "eacafefps0000000000000000000001",
        principal: "1500.00",
        fee: "7.50",
        state: "payment_processed",
      },
      {
        postedAt: noon("2026-10-25"),
        reference: "DEP-0944",
        description: "Depósito USD recibido en cuenta virtual · comprador del Reino Unido",
        debit: "0.00",
        credit: "4200.00",
        kind: "deposit",
      },
    ],
    conversions: [
      {
        direction: "usdc_to_bob",
        amount: "1200.00",
        status: "en_proceso",
        reference: "CONV-1088",
        createdAt: noon("2026-11-14"),
        adminNote: "Gabriel está coordinando el abono en bolivianos.",
      },
    ],
  },
];

export const unlinkedBridgeCustomer = {
  legalName: "Distribuidora Illimani S.R.L.",
  email: "hola@distribuidora-illimani.example",
  bridgeCustomerId: "e55e55e5-5555-4555-8555-555555555555",
  walletId: "walillimani00000000000000000000001",
  walletAddress: "0x12Dd66bb2041eE7766aa3241506978c2d3e4f506",
  virtualAccountId: "vaillimani001usd00000000000000001",
  accountNumber: "2000001005",
  routingNumber: "87654321",
};

export function endingBalance(entries: { debit: string; credit: string }[]): string {
  return entries.reduce((balance, entry) => add(sub(balance, entry.debit), entry.credit), "0.00");
}

export const DEMO_STATEMENT = {
  companySlug: "andina",
  year: 2026,
  month: 10,
  number: "EXT-2026-00001",
  verificationCode: "SW-ANDI-4F7Q",
};
