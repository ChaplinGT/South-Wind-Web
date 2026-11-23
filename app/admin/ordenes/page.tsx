import { prisma } from "@/lib/db";
import { formatAmount, formatDateTime } from "@/lib/format";
import { OrderActions } from "./actions";

export const metadata = { title: "Órdenes de pago" };

export default async function OrdersPage() {
  const orders = await prisma.paymentOrder.findMany({
    include: { beneficiary: true, company: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl">Órdenes de pago</h1>
      <p className="text-sm text-teal-950/75">El cliente pidió que South Wind venda USDC y lo envíe a la dirección de liquidación. Al marcar pagado, indique el hash.</p>
      {orders.map((order) => (
        <article key={order.id} className="card">
          <p className="font-semibold">{order.company.legalName} → {order.beneficiary.nickname}</p>
          <p className="text-sm">{formatAmount(order.bobAmount, "bob")} · tasa {order.rate} · {order.usdcAmount} USDC · comisión {order.feePercent} %</p>
          <p className="text-xs text-teal-900/60">{formatDateTime(order.createdAt)} · {order.status} {order.txHash ? `· ${order.txHash}` : ""}</p>
          <p className="break-all text-xs">{order.beneficiary.liquidationAddress}</p>
          <OrderActions id={order.id} />
        </article>
      ))}
      {orders.length === 0 ? <p className="text-sm">No hay órdenes.</p> : null}
    </div>
  );
}
