"use client";

import { CopyButton } from "./copy-button";

export function TwoSends({
  feeAmount,
  feeAddress,
  feeChain,
  feeQr,
  feeStatus,
  paymentAmount,
  paymentAddress,
  paymentQr,
  paymentStatus,
  sendFeePercent,
  sendFeeUsdc,
}: {
  feeAmount: string;
  feeAddress: string;
  feeChain: string;
  feeQr: string;
  feeStatus: string;
  paymentAmount: string;
  paymentAddress: string;
  paymentQr: string;
  paymentStatus: string;
  sendFeePercent?: string;
  sendFeeUsdc?: string;
}) {
  return (
    <div className="mt-3 grid gap-3 rounded-2xl bg-teal-50 p-3 sm:grid-cols-2">
      <SendCard
        title="1. Cargo fijo a South Wind"
        amount={`${feeAmount} USDC`}
        detail={`Red ${feeChain}. La orden sigue pendiente hasta que este envío y el del beneficiario estén confirmados.`}
        address={feeAddress}
        qr={feeQr}
        status={feeStatus}
      />
      <SendCard
        title="2. Pago a la dirección de liquidación"
        amount={`${paymentAmount} USDC`}
        detail={sendFeePercent ? `Bridge retiene ${sendFeeUsdc ?? ""} USDC (${sendFeePercent} %) de este envío.` : "Envío del monto al beneficiario."}
        address={paymentAddress}
        qr={paymentQr}
        status={paymentStatus}
      />
    </div>
  );
}

function SendCard({
  title,
  amount,
  detail,
  address,
  qr,
  status,
}: {
  title: string;
  amount: string;
  detail: string;
  address: string;
  qr: string;
  status: string;
}) {
  return (
    <div className="flex gap-3">
      <img src={qr} alt={`Código QR para ${title}`} className="h-24 w-24 shrink-0 rounded-xl bg-white" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-sm">{amount}</p>
        <p className="text-xs leading-5 text-teal-900/70">{detail}</p>
        <p className="mt-1 break-all text-xs">{address}</p>
        <p className="mt-1 text-xs font-semibold">{status === "confirmado" ? "Confirmado" : "Pendiente"}</p>
        <div className="mt-2"><CopyButton value={address} /></div>
      </div>
    </div>
  );
}
