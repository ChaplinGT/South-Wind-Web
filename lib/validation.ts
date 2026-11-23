import { z } from "zod";
import { isRail } from "./rails";

const email = z.string().trim().email("Ingrese un correo electrónico válido.");
const password = z
  .string()
  .min(10, "La contraseña debe tener al menos 10 caracteres.")
  .regex(/[A-Za-zÁÉÍÓÚáéíóúÑñ]/, "La contraseña debe incluir al menos una letra.")
  .regex(/\d/, "La contraseña debe incluir al menos un número.");

const nit = z
  .string()
  .trim()
  .regex(/^\d{7,15}$/, "El NIT debe tener entre 7 y 15 dígitos, sin guiones.");

const amount = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Ingrese un monto válido, con hasta dos decimales.")
  .refine((value) => Number(value) > 0, "El monto debe ser mayor a cero.")
  .refine((value) => Number(value) <= 1_000_000, "El monto máximo por operación es 1.000.000,00.");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Ingrese su contraseña."),
});

export const accountSignupSchema = z.object({
  name: z.string().trim().min(3, "Ingrese su nombre.").max(120),
  email,
  phone: z.string().trim().min(6, "Ingrese un teléfono.").max(30),
  password,
});

export const enableProfileSchema = z.object({
  kind: z.enum(["persona", "empresa"]),
  funding: z.enum(["bridge_wallet", "external"]),
  network: z.string().trim().optional().default(""),
  address: z.string().trim().optional().default(""),
  legalName: z.string().trim().optional().default(""),
  tradeName: z.string().trim().optional().default(""),
  nit: z.string().trim().optional().default(""),
  city: z.string().trim().optional().default(""),
  addressLine: z.string().trim().optional().default(""),
  clientType: z.enum(["importador", "cuenta_eeuu", "exportador", "persona"]).optional().default("importador"),
});

export const virtualAccountRequestSchema = z.object({
  companyId: z.string().min(1),
  currency: z.enum(["usd", "eur", "brl", "mxn"]),
  destination: z.enum(["southwind", "bridge_wallet", "external"]),
  chain: z.enum(["ethereum", "polygon", "base", "arbitrum", "solana", "tron"]).optional().default("base"),
  externalWalletId: z.string().optional().default(""),
});

export const paymentOrderSchema = z.object({
  beneficiaryId: z.string().min(1),
  usdcAmount: amount,
  kind: z.enum(["bob", "wallet"]).optional().default("bob"),
});

const moneyField = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Ingrese un monto en USD válido.")
  .refine((value) => Number(value) >= 0 && Number(value) <= 1000, "El monto debe estar entre 0 y 1.000 USD.");

const percentField = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Ingrese un porcentaje válido.")
  .refine((value) => Number(value) >= 0 && Number(value) <= 20, "El margen debe estar entre 0 y 20 %.");

export const pricingSchema = z.object({
  sendFeePercent: percentField,
  walletSurchargePercent: percentField,
  fixedSendFeeUsd: moneyField,
  vaDeveloperFeePercent: percentField,
  fixedReceiveFeeUsd: moneyField,
  feeConfigEnabled: z.enum(["true", "false"]),
  bobMarkupPercent: percentField,
  fxMarkupPercent: percentField,
  bridgeOrchestrationPercent: percentField,
  bridgeVaOrchestrationPercent: percentField,
  bridgeUsdtSupportPercent: percentField,
  bridgeVaAccountFeeUsd: moneyField,
  bridgeVaAccountFeeMxn: moneyField,
  bridgeVaAccountFeeBrlCop: moneyField,
  bridgeWalletFeeUsd: moneyField,
  bridgeKycUsdYear: moneyField,
  bridgeKybUsdYear: moneyField,
});

export const registerSchema = z.object({
  contactName: z.string().trim().min(3, "Ingrese el nombre de la persona de contacto.").max(120),
  email,
  password,
  legalName: z.string().trim().min(3, "Ingrese la razón social.").max(180),
  tradeName: z.string().trim().min(2, "Ingrese el nombre comercial.").max(180),
  nit,
  phone: z.string().trim().min(6, "Ingrese un teléfono de contacto.").max(30),
  city: z.string().trim().min(2, "Ingrese la ciudad.").max(80),
  address: z.string().trim().min(5, "Ingrese la dirección de la empresa.").max(180),
  clientType: z.enum(["importador", "cuenta_eeuu", "exportador"], {
    errorMap: () => ({ message: "Seleccione el tipo de empresa." }),
  }),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "Debe aceptar las condiciones de uso para continuar." }),
  }),
  acceptConversion: z.literal(true, {
    errorMap: () => ({
      message: "Debe confirmar que entiende cómo funciona la conversión a bolivianos.",
    }),
  }),
});

export const beneficiarySchema = z
  .object({
    nickname: z.string().trim().min(2, "Ingrese un alias para el beneficiario.").max(80),
    rail: z.string().refine(isRail, "Seleccione un riel de pago."),
    accountOwnerName: z
      .string()
      .trim()
      .min(3, "El titular debe tener al menos 3 caracteres.")
      .max(35, "El titular no puede superar 35 caracteres."),
    bankName: z.string().trim().min(2, "Ingrese el banco del beneficiario.").max(120),
    accountNumber: z.string().trim().optional().default(""),
    routingNumber: z.string().trim().optional().default(""),
    iban: z.string().trim().optional().default(""),
    bic: z.string().trim().optional().default(""),
    clabe: z.string().trim().optional().default(""),
    pixKey: z.string().trim().optional().default(""),
    sortCode: z.string().trim().optional().default(""),
    street: z.string().trim().optional().default(""),
    city: z.string().trim().optional().default(""),
    state: z.string().trim().optional().default(""),
    postalCode: z.string().trim().optional().default(""),
    country: z.string().trim().optional().default(""),
    accountKind: z.enum(["checking", "savings"]).optional().default("checking"),
    chain: z.enum(["ethereum", "polygon", "base", "arbitrum", "solana", "tron"]).optional().default("base"),
  })
  .superRefine((value, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    if (value.rail === "ach" || value.rail === "wire") {
      if (!/^\d{9}$/.test(value.routingNumber)) issue("routingNumber", "El routing number debe tener 9 dígitos.");
      if (!/^\d{4,17}$/.test(value.accountNumber)) {
        issue("accountNumber", "Ingrese el número de cuenta, solo dígitos.");
      }
      if (value.street.length < 3) issue("street", "Ingrese la dirección del beneficiario.");
      if (value.city.length < 2) issue("city", "Ingrese la ciudad del beneficiario.");
      if (!/^[A-Za-z]{2}$/.test(value.state)) issue("state", "Ingrese el estado con dos letras.");
      if (value.postalCode.length < 3) issue("postalCode", "Ingrese el código postal.");
    }
    if (value.rail === "sepa") {
      const iban = value.iban.replace(/\s+/g, "");
      if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/i.test(iban)) issue("iban", "Ingrese un IBAN válido.");
      if (value.bic && !/^[A-Za-z]{4}[A-Za-z]{2}[A-Za-z0-9]{2}([A-Za-z0-9]{3})?$/.test(value.bic)) {
        issue("bic", "El BIC debe tener 8 u 11 caracteres.");
      }
    }
    if (value.rail === "spei" && !/^\d{18}$/.test(value.clabe)) {
      issue("clabe", "La CLABE debe tener 18 dígitos.");
    }
    if (value.rail === "pix" && value.pixKey.length < 5) {
      issue("pixKey", "Ingrese la llave Pix del beneficiario.");
    }
    if (value.rail === "fps") {
      if (!/^\d{8}$/.test(value.accountNumber)) issue("accountNumber", "La cuenta del Reino Unido tiene 8 dígitos.");
      if (!/^\d{6}$/.test(value.sortCode)) issue("sortCode", "El sort code tiene 6 dígitos.");
    }
  });

export const paymentSchema = z.object({
  beneficiaryId: z.string().min(1, "Seleccione un beneficiario."),
  amount,
  reference: z.string().trim().min(2, "Ingrese una referencia.").max(140, "La referencia es demasiado larga."),
  idempotencyKey: z.string().uuid("La clave de idempotencia no es válida."),
});

export const conversionSchema = z.object({
  direction: z.enum(["usdc_to_bob", "bob_to_usdc"], {
    errorMap: () => ({ message: "Seleccione la dirección de la conversión." }),
  }),
  amount,
  bolivianAccountId: z.string().min(1, "Seleccione la cuenta boliviana."),
  note: z.string().trim().max(280).optional().default(""),
});

export const bolivianAccountSchema = z.object({
  bankName: z.string().trim().min(2, "Ingrese el banco.").max(120),
  accountNumber: z.string().trim().min(5, "Ingrese el número de cuenta.").max(30),
  accountHolder: z.string().trim().min(3, "Ingrese el titular.").max(120),
  accountType: z.enum(["ahorro", "corriente"], {
    errorMap: () => ({ message: "Seleccione caja de ahorro o cuenta corriente." }),
  }),
});

export const inviteSchema = z.object({
  bridgeCustomerId: z.string().trim().min(4, "Ingrese el customer_id de Bridge.").max(64),
  legalName: z.string().trim().min(3, "Ingrese la razón social.").max(180),
  tradeName: z.string().trim().min(2, "Ingrese el nombre comercial.").max(180),
  nit,
  email,
  contactName: z.string().trim().min(3, "Ingrese el nombre del contacto.").max(120),
  phone: z.string().trim().min(6, "Ingrese un teléfono.").max(30),
  city: z.string().trim().min(2, "Ingrese la ciudad.").max(80),
  address: z.string().trim().min(5, "Ingrese la dirección.").max(180),
  clientType: z.enum(["importador", "cuenta_eeuu", "exportador"]),
  password,
});

export const markupSchema = z.object({
  bobMarkupPercent: percentField,
  fxMarkupPercent: percentField,
});

export const feeSchema = z.object({
  feePercent: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Ingrese un porcentaje válido.")
    .refine((value) => Number(value) >= 0 && Number(value) <= 5, "La comisión debe estar entre 0 y 5 %."),
});

export const conversionUpdateSchema = z.object({
  status: z.enum(["pendiente", "en_proceso", "pagado"]),
  reference: z.string().trim().max(80).optional().default(""),
  adminNote: z.string().trim().max(500).optional().default(""),
  settledAmount: z.string().trim().optional().default(""),
});

export const statementRequestSchema = z.object({
  year: z.coerce.number().int().min(2024).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const simulateDepositSchema = z.object({
  amount,
});
