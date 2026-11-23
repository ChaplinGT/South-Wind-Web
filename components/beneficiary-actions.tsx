"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatAmount } from "@/lib/format";
import { quoteWalletSend } from "@/lib/pricing";
import { Alert } from "./ui";

type DirectQuote = {
  rate: string;
  usdcAmount: string;
  principalBob: string;
  fixedFeeUsd: string;
  fixedFeeBob: string;
  bobAmount: string;
  sendFeePercent: string;
  sendFeeUsdc: string;
  beneficiaryUsdc: string;
};

export function BeneficiaryActions({
  beneficiaryId,
  sendFeePercent,
  walletSurchargePercent,
  fixedSendFeeUsd,
  hasWallet,
}: {
  beneficiaryId: string;
  sendFeePercent: string;
  walletSurchargePercent: string;
  fixedSendFeeUsd: string;
  hasWallet: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [directQuote, setDirectQuote] = useState<DirectQuote | null>(null);
  const [directUsdc, setDirectUsdc] = useState("");
  const [walletAmount, setWalletAmount] = useState("");
  const [walletReference, setWalletReference] = useState("");
  const [walletReady, setWalletReady] = useState(false);
  const [created, setCreated] = useState<DirectQuote | null>(null);

  async function quoteDirect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setCreated(null);
    try {
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const usdcAmount = String(data.usdcAmount || "");
      const response = await fetch("/api/ordenes/cotizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beneficiaryId, usdcAmount }),
      });
      const body = (await response.json()) as DirectQuote & { error?: string };
      if (!response.ok) throw new Error(body.error || "No se pudo cotizar la orden.");
      setDirectUsdc(usdcAmount);
      setDirectQuote(body);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function confirmDirect() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/ordenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beneficiaryId, usdcAmount: directUsdc }),
      });
      const body = (await response.json()) as DirectQuote & { error?: string };
      if (!response.ok) throw new Error(body.error || "No se pudo crear la orden.");
      setCreated(body);
      setDirectQuote(null);
      router.refresh();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setPending(false);
    }
  }

  function reviewWallet(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const amount = String(data.amount || "");
    if (!safeWalletQuote(amount, sendFeePercent, walletSurchargePercent, fixedSendFeeUsd)) {
      setWalletReady(false);
      setError("Ingrese un monto válido, con hasta dos decimales.");
      return;
    }
    setWalletAmount(amount);
    setWalletReference(String(data.reference || ""));
    setWalletReady(true);
  }

  const walletQuote = walletReady ? safeWalletQuote(walletAmount, sendFeePercent, walletSurchargePercent, fixedSendFeeUsd) : null;

  async function confirmWallet() {
    if (!walletQuote) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/pagos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiaryId,
          amount: walletAmount,
          reference: walletReference,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "No se pudo enviar el pago.");
      router.push("/app/movimientos");
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4 space-y-4 border-t border-teal-100 pt-4">
      {error ? <Alert tone="bad">{error}</Alert> : null}
      {created ? (
        <Alert>
          Orden registrada. Deposite {formatAmount(created.bobAmount, "bob")} ({created.usdcAmount} USDC a {created.rate} Bs, más {formatAmount(created.fixedFeeBob, "bob")} del cargo fijo).
        </Alert>
      ) : null}
      <div>
        <p className="text-sm font-semibold">1. Pago directo</p>
        <p className="mt-1 text-xs leading-5 text-teal-900/70">
          Deposite bolivianos en South Wind. South Wind compra USDC al precio de compra de Binance más el margen y lo envía a la dirección de liquidación. No hace falta una billetera Bridge.
          Al llegar, Bridge retiene {sendFeePercent} %. Si usted envía el USDC por su cuenta a esa dirección, ese porcentaje igual se retiene, pero el cargo fijo de USD {fixedSendFeeUsd} no se puede cobrar.
        </p>
        {directQuote ? (
          <div className="mt-3 space-y-2 rounded-2xl bg-teal-50 p-3 text-sm">
            <p>USDC que envía South Wind: {directQuote.usdcAmount}</p>
            <p>Tipo de cambio de compra: {directQuote.rate} Bs por USDC</p>
            <p>Bolivianos por el USDC: {formatAmount(directQuote.principalBob, "bob")}</p>
            <p>Cargo fijo USD {directQuote.fixedFeeUsd}: {formatAmount(directQuote.fixedFeeBob, "bob")}</p>
            <p className="font-semibold">Total a depositar: {formatAmount(directQuote.bobAmount, "bob")}</p>
            <p>Bridge retiene {directQuote.sendFeeUsdc} USDC ({directQuote.sendFeePercent} %). El beneficiario recibe cerca de {directQuote.beneficiaryUsdc} USDC.</p>
            <p className="text-xs text-teal-900/70">Al confirmar se vuelve a leer Binance. La cotización guardada no tiene más de 60 segundos.</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" type="button" onClick={() => setDirectQuote(null)}>Volver</button>
              <button className="btn-primary" type="button" disabled={pending} onClick={confirmDirect}>{pending ? "Creando…" : "Confirmar orden"}</button>
            </div>
          </div>
        ) : (
          <form onSubmit={quoteDirect} className="mt-2 flex flex-wrap items-end gap-2">
            <label><span className="label">USDC a enviar</span><input className="input w-40" name="usdcAmount" placeholder="100.00" required /></label>
            <button className="btn-secondary" disabled={pending} type="submit">Ver desglose</button>
          </form>
        )}
      </div>
      <div>
        <p className="text-sm font-semibold">2. Desde la billetera Bridge</p>
        <p className="mt-1 text-xs leading-5 text-teal-900/70">
          Esta vía puede tener más comisiones de procesamiento de Bridge. El developer_fee es el monto por ({sendFeePercent} % + {walletSurchargePercent} % de recargo) más USD {fixedSendFeeUsd}.
        </p>
        {!hasWallet ? <p className="mt-2 text-xs text-teal-900/70">Este perfil todavía no tiene billetera Bridge.</p> : null}
        {hasWallet && walletQuote ? (
          <div className="mt-3 space-y-2 rounded-2xl bg-teal-50 p-3 text-sm">
            <p>Monto: {formatAmount(walletQuote.usdcAmount)}</p>
            <p>Comisión {sendFeePercent} % + recargo {walletSurchargePercent} %: {formatAmount(walletQuote.variable, "usd")}</p>
            <p>Cargo fijo: {formatAmount(walletQuote.fixed, "usd")}</p>
            <p className="font-semibold">developer_fee: {formatAmount(walletQuote.fee, "usd")}</p>
            <p className="font-semibold">Total a debitar: {formatAmount(walletQuote.total)}</p>
            <p>Referencia: {walletReference}</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" type="button" onClick={() => setWalletReady(false)}>Volver</button>
              <button className="btn-primary" type="button" disabled={pending} onClick={confirmWallet}>{pending ? "Enviando…" : "Confirmar transferencia"}</button>
            </div>
          </div>
        ) : null}
        {hasWallet && !walletQuote ? (
          <form onSubmit={reviewWallet} className="mt-2 flex flex-wrap items-end gap-2">
            <label><span className="label">Monto USDC</span><input className="input w-36" name="amount" placeholder="100.00" required /></label>
            <label><span className="label">Referencia</span><input className="input w-40" name="reference" required /></label>
            <button className="btn-primary" type="submit">Ver desglose</button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

function safeWalletQuote(amount: string, sendFeePercent: string, walletSurchargePercent: string, fixedSendFeeUsd: string) {
  try {
    return quoteWalletSend(amount, sendFeePercent, walletSurchargePercent, fixedSendFeeUsd);
  } catch {
    return null;
  }
}
