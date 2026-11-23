"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "./ui";

export function BeneficiaryActions({
  beneficiaryId,
  directFee,
  walletFee,
  hasWallet,
}: {
  beneficiaryId: string;
  directFee: string;
  walletFee: string;
  hasWallet: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function order(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const response = await fetch("/api/ordenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beneficiaryId, bobAmount: data.bobAmount }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "No se pudo crear la orden.");
      event.currentTarget.reset();
      router.refresh();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function walletPay(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const response = await fetch("/api/pagos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiaryId,
          amount: data.amount,
          reference: data.reference,
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
      <div>
        <p className="text-sm font-semibold">1. Pago directo</p>
        <p className="mt-1 text-xs leading-5 text-teal-900/70">
          Deposite bolivianos en South Wind. South Wind vende USDC y lo envía a la dirección de liquidación. También puede enviar USDC usted mismo desde cualquier billetera a esa dirección. No hace falta una billetera Bridge. Comisión de esta vía: {directFee} %.
        </p>
        <form onSubmit={order} className="mt-2 flex flex-wrap items-end gap-2">
          <label><span className="label">Monto en bolivianos</span><input className="input w-40" name="bobAmount" placeholder="1000.00" required /></label>
          <button className="btn-secondary" disabled={pending} type="submit">Crear orden de pago</button>
        </form>
      </div>
      <div>
        <p className="text-sm font-semibold">2. Desde la billetera Bridge</p>
        <p className="mt-1 text-xs leading-5 text-teal-900/70">
          Fondee su billetera Bridge y pida la transferencia al beneficiario. Esta vía puede tener más comisiones de procesamiento de Bridge que el pago directo. La tarifa exacta se definirá; hoy la comisión South Wind de esta vía es {walletFee} %.
        </p>
        {hasWallet ? (
          <form onSubmit={walletPay} className="mt-2 flex flex-wrap items-end gap-2">
            <label><span className="label">Monto USDC</span><input className="input w-36" name="amount" placeholder="100.00" required /></label>
            <label><span className="label">Referencia</span><input className="input w-40" name="reference" required /></label>
            <button className="btn-primary" disabled={pending} type="submit">Enviar desde billetera</button>
          </form>
        ) : (
          <p className="mt-2 text-xs text-teal-900/70">Este perfil todavía no tiene billetera Bridge.</p>
        )}
      </div>
    </div>
  );
}
