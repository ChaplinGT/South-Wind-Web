"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { feeAmount, add } from "@/lib/money";
import { formatAmount } from "@/lib/format";
import { rails, railLabel, type RailKey } from "@/lib/rails";
import { directionLabel } from "@/lib/labels";
import { FieldError, Alert } from "./ui";

type FieldErrors = Record<string, string>;

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    fields?: FieldErrors | null;
    redirect?: string;
    transferId?: string;
    message?: string;
  };
  if (!response.ok) throw Object.assign(new Error(data.error || "No se pudo completar la operación."), { fields: data.fields });
  return data;
}

function useFormError() {
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  return { error, fields, pending, setError, setFields, setPending };
}

export function RegisterForm() {
  const form = useFormError();
  const router = useRouter();
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    form.setPending(true);
    form.setError(null);
    form.setFields({});
    try {
      const result = await postJson("/api/auth/registro", {
        name: data.get("name"),
        email: data.get("email"),
        phone: data.get("phone"),
        password: data.get("password"),
      });
      router.push(result.redirect || "/app");
      router.refresh();
    } catch (error) {
      const known = error as Error & { fields?: FieldErrors };
      form.setError(known.message);
      form.setFields(known.fields ?? {});
    } finally {
      form.setPending(false);
    }
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      {form.error ? <Alert tone="bad">{form.error}</Alert> : null}
      <label><span className="label">Nombre</span><input className="input" name="name" required /><FieldError message={form.fields.name} /></label>
      <label><span className="label">Correo</span><input className="input" name="email" type="email" required /><FieldError message={form.fields.email} /></label>
      <label><span className="label">Teléfono</span><input className="input" name="phone" required /><FieldError message={form.fields.phone} /></label>
      <label><span className="label">Contraseña</span><input className="input" name="password" type="password" required /><FieldError message={form.fields.password} /></label>
      <button className="btn-primary" disabled={form.pending} type="submit">{form.pending ? "Creando cuenta…" : "Crear cuenta South Wind"}</button>
    </form>
  );
}

export function GoogleButton() {
  return (
    <a className="btn-secondary w-full" href="/api/auth/google">
      Continuar con Google
    </a>
  );
}

export function PaymentForm({
  beneficiaries,
  feePercent,
  balance,
}: {
  beneficiaries: { id: string; nickname: string; accountOwnerName: string; rail: string; accountLast4: string; bankName: string; currency: string }[];
  feePercent: string;
  balance: string;
}) {
  const [step, setStep] = useState(1);
  const [beneficiaryId, setBeneficiaryId] = useState(beneficiaries[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const form = useFormError();
  const beneficiary = beneficiaries.find((item) => item.id === beneficiaryId);
  const preview = useMemo(() => {
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) return null;
    const fee = feeAmount(amount, feePercent);
    return { fee, total: add(amount, fee) };
  }, [amount, feePercent]);

  function review(event: React.FormEvent) {
    event.preventDefault();
    if (!beneficiary || !preview) {
      form.setError("Revise el beneficiario y el monto.");
      return;
    }
    form.setError(null);
    if (!idempotencyKey) setIdempotencyKey(crypto.randomUUID());
    setStep(2);
  }

  async function confirm() {
    form.setPending(true);
    form.setError(null);
    try {
      const result = await postJson("/api/pagos", { beneficiaryId, amount, reference, idempotencyKey });
      setDone(result.transferId ?? null);
      setStep(3);
    } catch (error) {
      form.setError((error as Error).message);
    } finally {
      form.setPending(false);
    }
  }

  if (beneficiaries.length === 0) {
    return <Alert>Agregue un beneficiario antes de enviar un pago.</Alert>;
  }
  if (step === 3 && done) {
    return (
      <div className="card space-y-3">
        <h2 className="font-display text-3xl">Pago registrado</h2>
        <p className="text-sm text-teal-900/80">La instrucción quedó registrada. Puede descargar el comprobante o volver a sus movimientos.</p>
        <div className="flex flex-wrap gap-2">
          <a className="btn-primary" href={`/api/comprobantes/pago/${done}`}>Descargar comprobante</a>
          <a className="btn-secondary" href="/app/movimientos">Ver movimientos</a>
        </div>
      </div>
    );
  }
  if (step === 2 && beneficiary && preview) {
    return (
      <div className="card space-y-4">
        <p className="text-xs uppercase tracking-[0.16em] text-teal-800">Confirmación</p>
        <h2 className="font-display text-3xl">Revise el pago antes de enviarlo</h2>
        {form.error ? <Alert tone="bad">{form.error}</Alert> : null}
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-teal-900/60">Beneficiario</dt><dd className="font-semibold">{beneficiary.accountOwnerName}</dd></div>
          <div><dt className="text-teal-900/60">Riel</dt><dd className="font-semibold">{railLabel(beneficiary.rail)} ···· {beneficiary.accountLast4}</dd></div>
          <div><dt className="text-teal-900/60">Monto</dt><dd className="font-semibold">{formatAmount(amount)}</dd></div>
          <div><dt className="text-teal-900/60">Comisión South Wind ({feePercent} %)</dt><dd className="font-semibold">{formatAmount(preview.fee)}</dd></div>
          <div><dt className="text-teal-900/60">Total a debitar</dt><dd className="font-display text-2xl text-teal-900">{formatAmount(preview.total)}</dd></div>
          <div><dt className="text-teal-900/60">Referencia</dt><dd className="font-semibold">{reference}</dd></div>
        </dl>
        <p className="text-sm text-teal-900/70">
          El saldo disponible es {formatAmount(balance)}. En ACH y wire el monto sale de su saldo USDC. En SEPA, SPEI, Pix y Faster Payments, Bridge aplica el tipo de cambio al procesar el pago.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" type="button" onClick={() => setStep(1)}>Volver</button>
          <button className="btn-primary" type="button" disabled={form.pending} onClick={confirm}>
            {form.pending ? "Enviando…" : "Confirmar pago"}
          </button>
        </div>
      </div>
    );
  }
  return (
    <form onSubmit={review} className="card grid gap-4">
      {form.error ? <Alert tone="bad">{form.error}</Alert> : null}
      <label>
        <span className="label">Beneficiario</span>
        <select className="input" value={beneficiaryId} onChange={(event) => setBeneficiaryId(event.target.value)}>
          {beneficiaries.map((item) => (
            <option key={item.id} value={item.id}>
              {item.nickname} · {railLabel(item.rail)} ···· {item.accountLast4}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="label">Monto en USDC</span>
        <input className="input" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="1000.00" required />
        {preview ? <p className="help">Comisión estimada {formatAmount(preview.fee)} · Total {formatAmount(preview.total)}</p> : <p className="help">Saldo disponible {formatAmount(balance)}</p>}
      </label>
      <label>
        <span className="label">Referencia</span>
        <input className="input" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Factura 1044" required />
      </label>
      <button className="btn-primary" type="submit">Continuar a la confirmación</button>
    </form>
  );
}

export function BeneficiaryForm() {
  const [rail, setRail] = useState<RailKey>("ach");
  const form = useFormError();
  const router = useRouter();
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    form.setPending(true);
    form.setError(null);
    form.setFields({});
    try {
      await postJson("/api/beneficiarios", data);
      router.refresh();
      event.currentTarget.reset();
      setRail("ach");
    } catch (error) {
      const known = error as Error & { fields?: FieldErrors };
      form.setError(known.message);
      form.setFields(known.fields ?? {});
    } finally {
      form.setPending(false);
    }
  }
  return (
    <form onSubmit={onSubmit} className="card grid gap-3">
      <h2 className="font-display text-2xl">Nuevo beneficiario</h2>
      {form.error ? <Alert tone="bad">{form.error}</Alert> : null}
      <label><span className="label">Alias</span><input className="input" name="nickname" required /><FieldError message={form.fields.nickname} /></label>
      <label><span className="label">Red de la dirección de liquidación (USDC)</span>
        <select className="input" name="chain" defaultValue="base">
          {["ethereum", "polygon", "base", "arbitrum", "solana", "tron"].map((chain) => <option key={chain} value={chain}>{chain}</option>)}
        </select>
      </label>
      <label>
        <span className="label">Riel</span>
        <select className="input" name="rail" value={rail} onChange={(event) => setRail(event.target.value as RailKey)}>
          {Object.entries(rails).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
        </select>
      </label>
      <label><span className="label">Titular</span><input className="input" name="accountOwnerName" required /><FieldError message={form.fields.accountOwnerName} /></label>
      <label><span className="label">Banco</span><input className="input" name="bankName" required /><FieldError message={form.fields.bankName} /></label>
      {(rail === "ach" || rail === "wire") && (
        <>
          <label><span className="label">Routing (9 dígitos)</span><input className="input" name="routingNumber" /><FieldError message={form.fields.routingNumber} /></label>
          <label><span className="label">Número de cuenta</span><input className="input" name="accountNumber" /><FieldError message={form.fields.accountNumber} /></label>
          <label><span className="label">Tipo</span><select className="input" name="accountKind"><option value="checking">Checking</option><option value="savings">Savings</option></select></label>
          <label><span className="label">Dirección</span><input className="input" name="street" /><FieldError message={form.fields.street} /></label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label><span className="label">Ciudad</span><input className="input" name="city" /><FieldError message={form.fields.city} /></label>
            <label><span className="label">Estado</span><input className="input" name="state" placeholder="CA" /><FieldError message={form.fields.state} /></label>
            <label><span className="label">Código postal</span><input className="input" name="postalCode" /><FieldError message={form.fields.postalCode} /></label>
          </div>
        </>
      )}
      {rail === "sepa" && (
        <>
          <label><span className="label">IBAN</span><input className="input" name="iban" /><FieldError message={form.fields.iban} /></label>
          <label><span className="label">BIC (opcional)</span><input className="input" name="bic" /><FieldError message={form.fields.bic} /></label>
          <label><span className="label">País (ISO alfa-3)</span><input className="input" name="country" placeholder="DEU" /></label>
        </>
      )}
      {rail === "spei" && <label><span className="label">CLABE (18 dígitos)</span><input className="input" name="clabe" /><FieldError message={form.fields.clabe} /></label>}
      {rail === "pix" && <label><span className="label">Llave Pix</span><input className="input" name="pixKey" /><FieldError message={form.fields.pixKey} /></label>}
      {rail === "fps" && (
        <>
          <label><span className="label">Account number (8)</span><input className="input" name="accountNumber" /><FieldError message={form.fields.accountNumber} /></label>
          <label><span className="label">Sort code (6)</span><input className="input" name="sortCode" /><FieldError message={form.fields.sortCode} /></label>
        </>
      )}
      <button className="btn-primary" disabled={form.pending} type="submit">{form.pending ? "Guardando…" : "Guardar beneficiario"}</button>
    </form>
  );
}

export function BobAccountForm() {
  const form = useFormError();
  const router = useRouter();
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.setPending(true);
    form.setError(null);
    try {
      await postJson("/api/cuentas-bob", Object.fromEntries(new FormData(event.currentTarget).entries()));
      router.refresh();
      event.currentTarget.reset();
    } catch (error) {
      form.setError((error as Error).message);
    } finally {
      form.setPending(false);
    }
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      {form.error ? <div className="sm:col-span-2"><Alert tone="bad">{form.error}</Alert></div> : null}
      <label><span className="label">Banco</span><input className="input" name="bankName" required /></label>
      <label><span className="label">Número de cuenta</span><input className="input" name="accountNumber" required /></label>
      <label><span className="label">Titular</span><input className="input" name="accountHolder" required /></label>
      <label><span className="label">Tipo</span><select className="input" name="accountType"><option value="ahorro">Caja de ahorro</option><option value="corriente">Cuenta corriente</option></select></label>
      <button className="btn-primary sm:col-span-2" disabled={form.pending} type="submit">Guardar cuenta boliviana</button>
    </form>
  );
}

export function ConversionForm({ accounts }: { accounts: { id: string; label: string }[] }) {
  const form = useFormError();
  const router = useRouter();
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.setPending(true);
    form.setError(null);
    try {
      await postJson("/api/conversiones", Object.fromEntries(new FormData(event.currentTarget).entries()));
      router.refresh();
      event.currentTarget.reset();
    } catch (error) {
      form.setError((error as Error).message);
    } finally {
      form.setPending(false);
    }
  }
  return (
    <form onSubmit={onSubmit} className="card grid gap-3">
      <h2 className="font-display text-2xl">Nueva solicitud</h2>
      <p className="text-sm text-teal-900/70">Gabriel coordina la conversión como PSAV. El saldo USDC se mueve cuando la solicitud figura como pagada.</p>
      {form.error ? <Alert tone="bad">{form.error}</Alert> : null}
      <label>
        <span className="label">Dirección</span>
        <select className="input" name="direction">
          <option value="usdc_to_bob">{directionLabel.usdc_to_bob}</option>
          <option value="bob_to_usdc">{directionLabel.bob_to_usdc}</option>
        </select>
      </label>
      <label><span className="label">Monto de origen</span><input className="input" name="amount" placeholder="1000.00" required /><p className="help">USDC si convierte a bolivianos. Bolivianos si envía Bs para recibir USDC.</p></label>
      <label>
        <span className="label">Cuenta en Bolivia</span>
        <select className="input" name="bolivianAccountId" required>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}
        </select>
      </label>
      <label><span className="label">Nota (opcional)</span><textarea className="input" name="note" rows={3} /></label>
      <button className="btn-primary" disabled={form.pending || accounts.length === 0} type="submit">Enviar solicitud</button>
    </form>
  );
}

export function InviteForm() {
  const form = useFormError();
  const [created, setCreated] = useState<string | null>(null);
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.setPending(true);
    form.setError(null);
    form.setFields({});
    try {
      const data = await postJson("/api/admin/vincular", Object.fromEntries(new FormData(event.currentTarget).entries()));
      setCreated(data.message || "Cliente vinculado.");
    } catch (error) {
      const known = error as Error & { fields?: FieldErrors };
      form.setError(known.message);
      form.setFields(known.fields ?? {});
    } finally {
      form.setPending(false);
    }
  }
  if (created) return <Alert tone="info">{created}</Alert>;
  return (
    <form onSubmit={onSubmit} className="card grid gap-3 sm:grid-cols-2">
      {form.error ? <div className="sm:col-span-2"><Alert tone="bad">{form.error}</Alert></div> : null}
      <label className="sm:col-span-2"><span className="label">customer_id de Bridge</span><input className="input" name="bridgeCustomerId" placeholder="e55e55e5-5555-4555-8555-555555555555" required /><FieldError message={form.fields.bridgeCustomerId} /><p className="help">En demostración puede vincular Distribuidora Illimani con el id de ejemplo. No se repite el KYB.</p></label>
      <label><span className="label">Razón social</span><input className="input" name="legalName" required /></label>
      <label><span className="label">Nombre comercial</span><input className="input" name="tradeName" required /></label>
      <label><span className="label">NIT</span><input className="input" name="nit" required /><FieldError message={form.fields.nit} /></label>
      <label><span className="label">Contacto</span><input className="input" name="contactName" required /></label>
      <label><span className="label">Correo de acceso</span><input className="input" name="email" type="email" required /></label>
      <label><span className="label">Contraseña temporal</span><input className="input" name="password" required /><FieldError message={form.fields.password} /></label>
      <label><span className="label">Teléfono</span><input className="input" name="phone" required /></label>
      <label><span className="label">Ciudad</span><input className="input" name="city" required /></label>
      <label className="sm:col-span-2"><span className="label">Dirección</span><input className="input" name="address" required /></label>
      <label className="sm:col-span-2"><span className="label">Tipo</span>
        <select className="input" name="clientType">
          <option value="importador">Importador</option>
          <option value="cuenta_eeuu">Empresa con cuenta en EE.UU.</option>
          <option value="exportador">Exportador</option>
        </select>
      </label>
      <button className="btn-primary sm:col-span-2" disabled={form.pending} type="submit">{form.pending ? "Vinculando…" : "Vincular cliente existente"}</button>
    </form>
  );
}

export function FeeForm({ feePercent }: { feePercent: string }) {
  const form = useFormError();
  const router = useRouter();
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.setPending(true);
    form.setError(null);
    try {
      await postJson("/api/admin/comision", Object.fromEntries(new FormData(event.currentTarget).entries()));
      router.refresh();
    } catch (error) {
      form.setError((error as Error).message);
    } finally {
      form.setPending(false);
    }
  }
  return (
    <form onSubmit={onSubmit} className="card max-w-lg space-y-3">
      {form.error ? <Alert tone="bad">{form.error}</Alert> : null}
      <label>
        <span className="label">Comisión South Wind (%)</span>
        <input className="input" name="feePercent" defaultValue={feePercent} />
        <p className="help">Valor de referencia del MVP. No es la tarifa comercial definitiva. Se envía a Bridge como developer_fee.</p>
      </label>
      <button className="btn-primary" disabled={form.pending} type="submit">Guardar comisión</button>
    </form>
  );
}

export function RouteFeeForm({
  direct,
  wallet,
  vaFee,
  wallets,
}: {
  direct: string;
  wallet: string;
  vaFee: string;
  wallets: { chain: string; address: string }[];
}) {
  const form = useFormError();
  const router = useRouter();
  async function saveFees(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.setPending(true);
    form.setError(null);
    try {
      await postJson("/api/admin/tarifas-ruta", Object.fromEntries(new FormData(event.currentTarget).entries()));
      router.refresh();
    } catch (error) {
      form.setError((error as Error).message);
    } finally {
      form.setPending(false);
    }
  }
  async function saveWallet(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.setPending(true);
    form.setError(null);
    try {
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      await postJson("/api/admin/tarifas-ruta", { kind: "wallet", ...data });
      router.refresh();
    } catch (error) {
      form.setError((error as Error).message);
    } finally {
      form.setPending(false);
    }
  }
  return (
    <div className="space-y-4">
      {form.error ? <Alert tone="bad">{form.error}</Alert> : null}
      <form onSubmit={saveFees} className="card max-w-lg space-y-3">
        <h2 className="font-display text-2xl">Comisiones por vía</h2>
        <label><span className="label">Pago directo a la dirección de liquidación (%)</span><input className="input" name="payoutDirectFeePercent" defaultValue={direct} /></label>
        <label><span className="label">Pago desde billetera Bridge (%)</span><input className="input" name="payoutWalletFeePercent" defaultValue={wallet} /></label>
        <label><span className="label">developer_fee_percent de cuentas virtuales</span><input className="input" name="vaDeveloperFeePercent" defaultValue={vaFee} /></label>
        <p className="help">Las dos primeras empiezan en 0 hasta que defina la tarifa. La de cuentas virtuales es el porcentaje que Bridge retiene al recibir.</p>
        <button className="btn-primary" disabled={form.pending} type="submit">Guardar tarifas</button>
      </form>
      <form onSubmit={saveWallet} className="card max-w-lg space-y-3">
        <h2 className="font-display text-2xl">Billeteras USDC de South Wind</h2>
        <p className="text-sm text-teal-900/70">Destino cuando el cliente elige que South Wind liquide el depósito en bolivianos.</p>
        <ul className="text-xs text-teal-900/70">{wallets.map((item) => <li key={item.chain}>{item.chain}: {item.address || "sin configurar"}</li>)}</ul>
        <label><span className="label">Red</span>
          <select className="input" name="chain">{["base", "ethereum", "polygon", "arbitrum", "solana", "tron"].map((chain) => <option key={chain}>{chain}</option>)}</select>
        </label>
        <label><span className="label">Dirección</span><input className="input" name="address" required /></label>
        <button className="btn-secondary" disabled={form.pending} type="submit">Guardar dirección</button>
      </form>
    </div>
  );
}

export function MarkupForm({ bob, fx }: { bob: string; fx: string }) {
  const form = useFormError();
  const router = useRouter();
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.setPending(true);
    form.setError(null);
    try {
      await postJson("/api/admin/tasas", Object.fromEntries(new FormData(event.currentTarget).entries()));
      router.refresh();
    } catch (error) {
      form.setError((error as Error).message);
    } finally {
      form.setPending(false);
    }
  }
  return (
    <form onSubmit={onSubmit} className="card max-w-lg space-y-3">
      {form.error ? <Alert tone="bad">{form.error}</Alert> : null}
      <label>
        <span className="label">Margen USDT/BOB (%)</span>
        <input className="input" name="bobMarkupPercent" defaultValue={bob} />
        <p className="help">Se suma al precio de compra de Binance y se resta al de venta. Valor inicial 0,50 %.</p>
      </label>
      <label>
        <span className="label">Margen del resto de monedas (%)</span>
        <input className="input" name="fxMarkupPercent" defaultValue={fx} />
        <p className="help">EUR y cualquier moneda distinta de BOB: se suma al buy_rate de Bridge y se resta al sell_rate. Valor inicial 0,10 %.</p>
      </label>
      <button className="btn-primary" disabled={form.pending} type="submit">Guardar márgenes</button>
    </form>
  );
}

export function ConversionAdminForm({ id, status }: { id: string; status: string }) {
  const form = useFormError();
  const router = useRouter();
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.setPending(true);
    form.setError(null);
    try {
      const body = new FormData(event.currentTarget);
      const response = await fetch(`/api/admin/conversiones/${id}`, { method: "POST", body });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "No se pudo actualizar.");
      router.refresh();
    } catch (error) {
      form.setError((error as Error).message);
    } finally {
      form.setPending(false);
    }
  }
  return (
    <form onSubmit={onSubmit} className="mt-3 grid gap-2 border-t border-teal-100 pt-3 sm:grid-cols-2">
      {form.error ? <div className="sm:col-span-2"><Alert tone="bad">{form.error}</Alert></div> : null}
      <label><span className="label">Estado</span>
        <select className="input" name="status" defaultValue={status}>
          <option value="pendiente">Pendiente</option>
          <option value="en_proceso">En proceso</option>
          <option value="pagado">Pagado</option>
        </select>
      </label>
      <label><span className="label">Referencia</span><input className="input" name="reference" /></label>
      <label><span className="label">USDC acreditados (solo Bs → USDC al pagar)</span><input className="input" name="settledAmount" placeholder="1000.00" /></label>
      <label><span className="label">Comprobante (PDF o imagen)</span><input className="input" name="receipt" type="file" accept="application/pdf,image/png,image/jpeg" /></label>
      <label className="sm:col-span-2"><span className="label">Nota interna</span><input className="input" name="adminNote" /></label>
      <button className="btn-primary sm:col-span-2" disabled={form.pending} type="submit">Actualizar solicitud</button>
    </form>
  );
}

export function StatementForm() {
  const now = new Date();
  const form = useFormError();
  const router = useRouter();
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.setPending(true);
    form.setError(null);
    try {
      await postJson("/api/extractos", Object.fromEntries(new FormData(event.currentTarget).entries()));
      router.refresh();
    } catch (error) {
      form.setError((error as Error).message);
    } finally {
      form.setPending(false);
    }
  }
  return (
    <form onSubmit={onSubmit} className="card flex flex-wrap items-end gap-3">
      <label><span className="label">Año</span><input className="input w-28" name="year" defaultValue={now.getFullYear()} /></label>
      <label><span className="label">Mes</span><input className="input w-24" name="month" defaultValue={now.getMonth() + 1} /></label>
      <button className="btn-primary" disabled={form.pending} type="submit">Generar extracto</button>
      {form.error ? <p className="error-text w-full">{form.error}</p> : null}
    </form>
  );
}

export function KybButton({ hasLink }: { hasLink: boolean }) {
  const form = useFormError();
  const router = useRouter();
  async function start() {
    form.setPending(true);
    form.setError(null);
    try {
      await postJson("/api/onboarding/kyb", {});
      router.refresh();
    } catch (error) {
      form.setError((error as Error).message);
    } finally {
      form.setPending(false);
    }
  }
  return (
    <div className="space-y-2">
      {form.error ? <Alert tone="bad">{form.error}</Alert> : null}
      <button className="btn-primary" type="button" onClick={start} disabled={form.pending}>
        {form.pending ? "Generando enlace…" : hasLink ? "Actualizar enlace de verificación" : "Continuar verificación"}
      </button>
    </div>
  );
}

export function SimulateDepositForm() {
  const form = useFormError();
  const router = useRouter();
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.setPending(true);
    form.setError(null);
    try {
      await postJson("/api/cuenta/simular-deposito", Object.fromEntries(new FormData(event.currentTarget).entries()));
      router.refresh();
    } catch (error) {
      form.setError((error as Error).message);
    } finally {
      form.setPending(false);
    }
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
      <label><span className="label">Simular depósito USD (sandbox)</span><input className="input w-40" name="amount" placeholder="250.00" /></label>
      <button className="btn-secondary" disabled={form.pending} type="submit">Acreditar</button>
      {form.error ? <p className="error-text w-full">{form.error}</p> : null}
    </form>
  );
}

export function ApproveKybButton({ customerId }: { customerId: string }) {
  const form = useFormError();
  const router = useRouter();
  async function approve() {
    form.setPending(true);
    form.setError(null);
    try {
      await postJson("/api/sandbox/kyb", { customerId });
      router.push("/app");
      router.refresh();
    } catch (error) {
      form.setError((error as Error).message);
    } finally {
      form.setPending(false);
    }
  }
  return (
    <div className="space-y-2">
      {form.error ? <Alert tone="bad">{form.error}</Alert> : null}
      <button className="btn-primary" type="button" onClick={approve} disabled={form.pending}>Simular aprobación de KYB</button>
    </div>
  );
}

export function SyncTransferButton({ id }: { id: string }) {
  const form = useFormError();
  const router = useRouter();
  return (
    <button
      className="text-sm font-semibold text-teal-800 underline-offset-2 hover:underline"
      type="button"
      disabled={form.pending}
      onClick={async () => {
        form.setPending(true);
        try {
          await postJson(`/api/admin/transferencias/${id}/sincronizar`, {});
          router.refresh();
        } catch (error) {
          form.setError((error as Error).message);
        } finally {
          form.setPending(false);
        }
      }}
    >
      {form.pending ? "Sincronizando…" : form.error ?? "Actualizar desde Bridge"}
    </button>
  );
}
