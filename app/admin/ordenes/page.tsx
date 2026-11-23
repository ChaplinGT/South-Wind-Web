import { prisma } from "@/lib/db";
import { formatAmount, formatDateTime } from "@/lib/format";
import { reconcileWalletFees } from "@/lib/services/orders";
import { OrderActions } from "./actions";

export const metadata = { title: "Órdenes de pago" };

export default async function OrdersPage() {
  await reconcileWalletFees().catch(() => undefined);
  const orders = await prisma.paymentOrder.findMany({
    include: { beneficiary: true, company: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl">Órdenes de pago</h1>
      <p className="text-sm text-teal-950/75">En un depósito en bolivianos, South Wind envía el USDC y usted marca pagado con el hash. En un pago desde la billetera del cliente, el cargo fijo se confirma con el hash o con el RPC de la red, y el pago al beneficiario con el aviso de Bridge. La orden sigue pendiente hasta que lleguen los dos.</p>
      {orders.map((order) => (
        <article key={order.id} className="card">
          <p className="font-semibold">{order.company.legalName} → {order.beneficiary.nickname}</p>
          {order.kind === "wallet" ? (
            <p className="text-sm">
              Pago desde wallet · {order.usdcAmount} USDC a la liquidación · cargo fijo {order.fixedFeeUsd} USDC a {order.feeChain} · cargo {order.feeLegStatus || "pendiente"} · pago {order.paymentLegStatus || "pendiente"} · {order.status}
            </p>
          ) : (
            <p className="text-sm">
              {order.usdcAmount} USDC · tasa {order.rate} · principal {order.principalBob ? formatAmount(order.principalBob, "bob") : "—"} · cargo fijo {order.fixedFeeUsd || "—"} USD ({order.fixedFeeBob ? formatAmount(order.fixedFeeBob, "bob") : "—"}) · total {formatAmount(order.bobAmount, "bob")} · comisión de la dirección {order.feePercent} %
            </p>
          )}
          <p className="text-xs text-teal-900/60">{formatDateTime(order.createdAt)} · {order.status} {order.txHash ? `· ${order.txHash}` : ""} {order.feeTxHash ? `· cargo ${order.feeTxHash}` : ""} {order.paymentTxHash ? `· pago ${order.paymentTxHash}` : ""}</p>
          <p className="break-all text-xs">{order.kind === "wallet" ? order.feeAddress : order.beneficiary.liquidationAddress}</p>
          <OrderActions id={order.id} kind={order.kind} feeConfirmed={order.feeLegStatus === "confirmado"} />
        </article>
      ))}
      {orders.length === 0 ? <p className="text-sm">No hay órdenes.</p> : null}
    </div>
  );
}
