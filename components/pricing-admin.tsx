"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PricingSettings } from "@/lib/pricing";
import { Alert } from "./ui";

type FormValues = Omit<PricingSettings, "feeConfigEnabled"> & { feeConfigEnabled: string };

const fields: { name: keyof FormValues; label: string; help?: string }[] = [
  { name: "vaDeveloperFeePercent", label: "Comisión de recepción (%)", help: "Se envía como developer_fee_percent o como fee_percent dentro de fee_config." },
  { name: "fixedReceiveFeeUsd", label: "Cargo fijo por depósito recibido (USD)" },
  { name: "sendFeePercent", label: "Comisión de envío (%)", help: "custom_developer_fee_percent de la dirección de liquidación." },
  { name: "fixedSendFeeUsd", label: "Cargo fijo ACH y demás rieles (USD)", help: "Aplica a ACH, SEPA, PIX, SPEI y Faster Payments." },
  { name: "wireFixedFeeUsd", label: "Cargo fijo Wire (USD)", help: "Solo transferencias bancarias Wire." },
  { name: "walletSurchargePercent", label: "Recargo extra de la billetera Bridge (%)" },
  { name: "bobMarkupPercent", label: "Margen USDT/BOB (%)", help: "Compra de Binance más este margen. Venta de Binance menos este margen." },
  { name: "fxMarkupPercent", label: "Margen EUR, GBP, MXN, BRL y COP (%)" },
  { name: "bridgeOrchestrationPercent", label: "Costo Bridge: orquestación básica (%)" },
  { name: "bridgeVaOrchestrationPercent", label: "Costo Bridge: orquestación de cuenta virtual (%)" },
  { name: "bridgeUsdtSupportPercent", label: "Costo Bridge: soporte USDT (%)" },
  { name: "bridgeVaAccountFeeUsd", label: "Costo Bridge: cuenta virtual USD, GBP y EUR" },
  { name: "bridgeVaAccountFeeMxn", label: "Costo Bridge: cuenta virtual MXN" },
  { name: "bridgeVaAccountFeeBrlCop", label: "Costo Bridge: cuenta virtual BRL y COP" },
  { name: "bridgeWalletFeeUsd", label: "Costo Bridge: billetera (USD)" },
  { name: "bridgeKycUsdYear", label: "Costo Bridge: KYC (USD al año)" },
  { name: "bridgeKybUsdYear", label: "Costo Bridge: KYB (USD al año)" },
];

export function PricingAdminForm({ values }: { values: FormValues }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setNote(null);
    try {
      const response = await fetch("/api/admin/tarifas-ruta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())),
      });
      const body = (await response.json()) as { error?: string; updatedVirtualAccounts?: number; updatedLiquidations?: number; failures?: number };
      if (!response.ok) throw new Error(body.error || "No se pudieron guardar las tarifas.");
      const failed = body.failures ? ` ${body.failures} actualizaciones en Bridge no se completaron.` : "";
      setNote(`Guardado. Cuentas virtuales actualizadas: ${body.updatedVirtualAccounts ?? 0}. Direcciones de liquidación: ${body.updatedLiquidations ?? 0}.${failed}`);
      router.refresh();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card max-w-3xl space-y-3">
      {error ? <Alert tone="bad">{error}</Alert> : null}
      {note ? <Alert>{note}</Alert> : null}
      <h2 className="font-display text-2xl">Tarifas y costos de contrato</h2>
      <label>
        <span className="label">fee_config habilitado en Bridge</span>
        <select className="input" name="feeConfigEnabled" defaultValue={values.feeConfigEnabled}>
          <option value="false">No. Solo developer_fee_percent. El cargo fijo de recepción se descuenta en la liquidación a bolivianos.</option>
          <option value="true">Sí. Las cuentas virtuales usan fee_config (monto fijo primero, porcentaje sobre el resto).</option>
        </select>
        <p className="help">Bridge tiene que haber habilitado fee_config. No se envía junto con developer_fee_percent. Al guardar, se actualizan las cuentas virtuales y las direcciones de liquidación ya creadas.</p>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <label key={field.name}>
            <span className="label">{field.label}</span>
            <input className="input" name={field.name} defaultValue={values[field.name]} />
            {field.help ? <p className="help">{field.help}</p> : null}
          </label>
        ))}
      </div>
      <button className="btn-primary" disabled={pending} type="submit">{pending ? "Guardando…" : "Guardar tarifas"}</button>
    </form>
  );
}
