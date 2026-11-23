"use client";

import { useMemo, useState } from "react";
import { formatAmount } from "@/lib/format";
import {
  combinedSendPercent,
  methodsForCurrency,
  quoteFromReceiveAmount,
  quoteFromSendAmount,
  type SendBreakdown,
  type TransferChoice,
} from "@/lib/send-quote";
import { destinationRows, parseBankDetails, type StoredBankDetails } from "@/lib/beneficiary-bank";
import { CopyButton } from "./copy-button";
import { Alert } from "./ui";

type Beneficiary = {
  id: string;
  nickname: string;
  accountOwnerName: string;
  rail: string;
  accountLast4: string;
  bankName: string;
  currency: string;
  details: StoredBankDetails;
};

type Instructions = {
  transferId?: string;
  blockchain: string;
  address: string;
  amount: string;
  qr?: string;
  bankName: string;
  accountOwnerName: string;
  railLabel: string;
  destinationCurrency: string;
  accountLast4: string;
  fiatAmount: string;
  bobAmount: string;
  bobPayee: string;
};

export function SendPaymentForm({
  beneficiaries,
  hasWallet,
  balance,
  sendFeePercent,
  walletSurchargePercent,
  achFixedFee,
  wireFixedFee,
  standardFixedFee,
  rates,
}: {
  beneficiaries: Beneficiary[];
  hasWallet: boolean;
  balance: string;
  sendFeePercent: string;
  walletSurchargePercent: string;
  achFixedFee: string;
  wireFixedFee: string;
  standardFixedFee: string;
  rates: Record<string, number | null>;
}) {
  const [step, setStep] = useState<"form" | "confirm" | "done" | "instructions">("form");
  const [beneficiaryId, setBeneficiaryId] = useState(beneficiaries[0]?.id ?? "");
  const [methodId, setMethodId] = useState("");
  const [fiatInput, setFiatInput] = useState("");
  const [usdcInput, setUsdcInput] = useState("");
  const [reference, setReference] = useState("");
  const [lastEdited, setLastEdited] = useState<"fiat" | "usdc">("fiat");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [doneId, setDoneId] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<Instructions | null>(null);

  const beneficiary = beneficiaries.find((item) => item.id === beneficiaryId);
  const methods = useMemo(
    () => methodsForCurrency(beneficiary?.currency || "usd", { ach: achFixedFee, wire: wireFixedFee, standard: standardFixedFee }),
    [beneficiary?.currency, achFixedFee, wireFixedFee, standardFixedFee],
  );
  const method = methods.find((item) => item.id === methodId) ?? methods[0];
  const percent = combinedSendPercent(sendFeePercent, walletSurchargePercent, hasWallet);
  const fx = method ? rates[method.currency] ?? (method.currency === "usd" ? 1 : null) : null;

  const quote = useMemo(
    () => buildQuote(lastEdited, fiatInput, usdcInput, method, percent, fx),
    [lastEdited, fiatInput, usdcInput, method, percent, fx],
  );

  function selectBeneficiary(id: string) {
    setBeneficiaryId(id);
    setMethodId("");
    setFiatInput("");
    setUsdcInput("");
    setError(null);
  }

  function editFiat(value: string) {
    setLastEdited("fiat");
    setFiatInput(value);
    if (!method || fx === null || !isMoney(value)) return;
    try {
      const next = quoteFromReceiveAmount({ fiatAmount: value, fxPerUsd: fx, fixedFee: method.fixedFee, percent });
      setUsdcInput(next.usdcTotal);
    } catch {
      setUsdcInput("");
    }
  }

  function editUsdc(value: string) {
    setLastEdited("usdc");
    setUsdcInput(value);
    if (!method || fx === null || !isMoney(value)) return;
    const next = quoteFromSendAmount({ usdcTotal: value, fxPerUsd: fx, fixedFee: method.fixedFee, percent });
    setFiatInput(next?.fiatAmount ?? "");
  }

  function review(event: React.FormEvent) {
    event.preventDefault();
    if (!beneficiary || !method || !quote) {
      setError("Revise el beneficiario, el tipo de transferencia y los montos.");
      return;
    }
    if (reference.trim().length < 2) {
      setError("Ingrese una referencia.");
      return;
    }
    setError(null);
    if (!idempotencyKey) setIdempotencyKey(crypto.randomUUID());
    setStep("confirm");
  }

  async function confirm() {
    if (!beneficiary || !method || !quote) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/pagos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiaryId,
          amount: quote.principalUsdc,
          fiatAmount: quote.fiatAmount,
          rail: method.id,
          reference,
          idempotencyKey,
        }),
      });
      const body = (await response.json()) as Instructions & { error?: string; mode?: string; transferId?: string };
      if (!response.ok) throw new Error(body.error || "No se pudo enviar el pago.");
      if (body.mode === "instructions") {
        setInstructions(body);
        setStep("instructions");
      } else {
        setDoneId(body.transferId ?? null);
        setStep("done");
      }
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setPending(false);
    }
  }

  if (beneficiaries.length === 0) return <Alert>Agregue un beneficiario antes de enviar un pago.</Alert>;

  if (step === "done" && doneId && beneficiary && method) {
    return (
      <div className="card space-y-3">
        <h2 className="font-display text-3xl">Pago registrado</h2>
        <p className="text-sm text-teal-900/80">La instrucción quedó registrada. Puede descargar el comprobante o volver a sus movimientos.</p>
        <DestinationBlock beneficiary={beneficiary} methodLabel={method.label} />
        <div className="flex flex-wrap gap-2">
          <a className="btn-primary" href={`/api/comprobantes/pago/${doneId}`}>Descargar comprobante</a>
          <a className="btn-secondary" href="/app/movimientos">Ver movimientos</a>
        </div>
      </div>
    );
  }

  if (step === "instructions" && instructions && beneficiary && method) {
    return (
      <div className="card space-y-6">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-teal-800">Instrucciones de pago</p>
          <h2 className="font-display text-3xl">Cómo completar el envío</h2>
        </div>
        <section className="space-y-3">
          <h3 className="font-semibold">Opción 1 — Enviar USDC</h3>
          <div className="flex flex-wrap items-start gap-4">
            {instructions.qr ? <img src={instructions.qr} alt="Código QR de la dirección de depósito" className="h-28 w-28 rounded-xl bg-white" /> : null}
            <dl className="grid flex-1 gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-teal-900/60">Blockchain</dt><dd className="font-semibold capitalize">{instructions.blockchain}</dd></div>
              <div><dt className="text-teal-900/60">Moneda</dt><dd className="font-semibold">USDC</dd></div>
              <div className="sm:col-span-2"><dt className="text-teal-900/60">Dirección de depósito</dt><dd className="break-all font-semibold">{instructions.address}</dd><div className="mt-2"><CopyButton value={instructions.address} /></div></div>
              <div><dt className="text-teal-900/60">Monto exacto</dt><dd className="font-semibold">{formatAmount(instructions.amount)}</dd></div>
            </dl>
          </div>
          <DestinationBlock beneficiary={beneficiary} methodLabel={method.label} />
          {instructions.transferId ? <a className="btn-secondary" href={`/api/instrucciones/${instructions.transferId}/pdf`}>Descargar instrucciones (PDF)</a> : null}
        </section>
        <section className="space-y-2 border-t border-teal-100 pt-4">
          <h3 className="font-semibold">Opción 2 — Depositar en bolivianos</h3>
          <p className="text-sm">Deposite {formatAmount(instructions.bobAmount, "bob")} a nombre de {instructions.bobPayee}.</p>
          <p className="text-sm text-teal-900/70">El beneficiario del depósito en Bolivia es {instructions.bobPayee}.</p>
        </section>
        <a className="btn-secondary" href="/app/movimientos">Ver movimientos</a>
      </div>
    );
  }

  if (step === "confirm" && beneficiary && method && quote) {
    return (
      <div className="card space-y-4">
        <p className="text-xs uppercase tracking-[0.16em] text-teal-800">Confirmación de envío</p>
        <h2 className="font-display text-3xl">Revise el pago antes de enviarlo</h2>
        {error ? <Alert tone="bad">{error}</Alert> : null}
        <Summary beneficiary={beneficiary} method={method} quote={quote} reference={reference} />
        {hasWallet ? <p className="text-sm text-teal-900/70">Saldo disponible {formatAmount(balance)}. El pago sale de su billetera.</p> : <p className="text-sm text-teal-900/70">Al confirmar verá las instrucciones para enviar USDC o depositar bolivianos.</p>}
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" type="button" onClick={() => setStep("form")}>Volver</button>
          <button className="btn-primary" type="button" disabled={pending} onClick={confirm}>{pending ? "Enviando…" : "Confirmar pago"}</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={review} className="card grid gap-5">
      {error ? <Alert tone="bad">{error}</Alert> : null}
      <label>
        <span className="label">Beneficiario</span>
        <select className="input" value={beneficiaryId} onChange={(event) => selectBeneficiary(event.target.value)}>
          {beneficiaries.map((item) => (
            <option key={item.id} value={item.id}>{item.nickname} · {item.accountOwnerName} ···· {item.accountLast4}</option>
          ))}
        </select>
      </label>
      {method ? (
        <fieldset className="space-y-2">
          <legend className="label">Tipo de transferencia</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {methods.map((item) => {
              const selected = item.id === method.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { setMethodId(item.id); setFiatInput(""); setUsdcInput(""); }}
                  className={`rounded-2xl px-4 py-3 text-left ring-1 ${selected ? "bg-teal-50 ring-2 ring-teal-800" : "ring-teal-200"}`}
                >
                  <span className="block font-semibold">{item.label}</span>
                  <span className="text-sm text-teal-900/70">({formatAmount(item.fixedFee, "usd")})</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="label">Monto a recibir ({(method?.currency || "usd").toUpperCase()})</span>
          <input className="input" inputMode="decimal" value={fiatInput} onChange={(event) => editFiat(event.target.value)} placeholder="1000.00" required />
          <p className="help">Especifique el monto exacto que quiere que reciba el destinatario</p>
        </label>
        <label>
          <span className="label">Monto total a enviar (USDC)</span>
          <input className="input" inputMode="decimal" value={usdcInput} onChange={(event) => editUsdc(event.target.value)} placeholder="1000.00" required />
          <p className="help">Se calcula automáticamente e incluye todas las comisiones</p>
        </label>
      </div>
      {quote && method ? <Breakdown method={method} quote={quote} /> : fx === null ? <p className="text-sm text-teal-900/70">Cotización no disponible para esta moneda.</p> : null}
      <label>
        <span className="label">Referencia</span>
        <input className="input" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Factura 1044" required />
      </label>
      <button className="btn-primary" type="submit">Continuar a la confirmación</button>
    </form>
  );
}

function Breakdown({ method, quote }: { method: TransferChoice; quote: SendBreakdown }) {
  return (
    <div className="rounded-2xl bg-teal-50 p-4">
      <p className="text-sm font-semibold">Desglose de comisiones</p>
      <dl className="mt-2 space-y-1 text-sm">
        <Row label={method.feeTitle} value={formatAmount(quote.fixedFee)} />
        <Row label={`Comisión porcentual (${quote.percent} %)`} value={formatAmount(quote.percentFee)} />
        <Row label="Comisiones totales" value={formatAmount(quote.totalFees)} />
        {method.currency !== "usd" ? <Row label="Tipo de cambio aplicado" value={`1 USDC = ${quote.fxPerUsd.toFixed(4)} ${method.currency.toUpperCase()}`} /> : null}
        <Row label={`Monto a recibir en ${method.currency.toUpperCase()}`} value={formatAmount(quote.fiatAmount, method.currency)} />
        <Row label="Monto total a enviar" value={formatAmount(quote.usdcTotal)} />
      </dl>
    </div>
  );
}

function Summary({
  beneficiary,
  method,
  quote,
  reference,
}: {
  beneficiary: Beneficiary;
  method: TransferChoice;
  quote: SendBreakdown;
  reference: string;
}) {
  return (
    <div className="space-y-3 text-sm">
      <DestinationBlock beneficiary={beneficiary} methodLabel={method.label} />
      <dl className="grid gap-3 sm:grid-cols-2">
        <div><dt className="text-teal-900/60">Monto a recibir</dt><dd className="font-semibold">{formatAmount(quote.fiatAmount, method.currency)}</dd></div>
        <div><dt className="text-teal-900/60">Monto total a enviar</dt><dd className="font-display text-2xl text-teal-900">{formatAmount(quote.usdcTotal)}</dd></div>
        <div><dt className="text-teal-900/60">Referencia</dt><dd className="font-semibold">{reference}</dd></div>
      </dl>
      <Breakdown method={method} quote={quote} />
    </div>
  );
}

function DestinationBlock({ beneficiary, methodLabel }: { beneficiary: Beneficiary; methodLabel: string }) {
  const rows = destinationRows({
    owner: beneficiary.accountOwnerName,
    bank: beneficiary.bankName,
    currency: beneficiary.currency,
    methodLabel,
    rail: beneficiary.rail,
    last4: beneficiary.accountLast4,
    details: beneficiary.details,
  });
  return (
    <dl className="grid gap-3 rounded-2xl bg-white p-3 ring-1 ring-teal-100 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label}>
          <dt className="text-teal-900/60">{row.label}</dt>
          <dd className="break-all font-semibold">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-teal-100 py-1 last:border-0">
      <dt className="text-teal-900/70">{label}</dt>
      <dd className="text-right font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function isMoney(value: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(value) && Number(value) > 0;
}

function buildQuote(
  edited: "fiat" | "usdc",
  fiat: string,
  usdc: string,
  method: TransferChoice | undefined,
  percent: string,
  fx: number | null,
): SendBreakdown | null {
  if (!method || fx === null) return null;
  if (edited === "usdc" && isMoney(usdc)) return quoteFromSendAmount({ usdcTotal: usdc, fxPerUsd: fx, fixedFee: method.fixedFee, percent });
  if (isMoney(fiat)) {
    try {
      return quoteFromReceiveAmount({ fiatAmount: fiat, fxPerUsd: fx, fixedFee: method.fixedFee, percent });
    } catch {
      return null;
    }
  }
  if (isMoney(usdc)) return quoteFromSendAmount({ usdcTotal: usdc, fxPerUsd: fx, fixedFee: method.fixedFee, percent });
  return null;
}
