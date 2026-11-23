import QRCode from "qrcode";
import { BeneficiaryForm } from "@/components/forms";
import { BeneficiaryActions } from "@/components/beneficiary-actions";
import { CopyButton } from "@/components/copy-button";
import { prisma } from "@/lib/db";
import { feeAmount } from "@/lib/money";
import { railLabel } from "@/lib/rails";
import { requireClient } from "@/lib/session";
import { reconcileWalletFees } from "@/lib/services/orders";
import { getPricing } from "@/lib/settings";
import { TwoSends } from "@/components/two-sends";

export const metadata = { title: "Beneficiarios" };

export default async function BeneficiariesPage() {
  const session = await requireClient();
  await reconcileWalletFees(session.companyId).catch(() => undefined);
  const [beneficiaries, company, pricing, walletOrders] = await Promise.all([
    prisma.beneficiary.findMany({ where: { companyId: session.companyId }, orderBy: { createdAt: "desc" } }),
    prisma.company.findUnique({ where: { id: session.companyId } }),
    getPricing(),
    prisma.paymentOrder.findMany({
      where: { companyId: session.companyId, kind: "wallet", status: "pendiente" },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const cards = await Promise.all(
    beneficiaries.map(async (item) => ({
      item,
      qr: item.liquidationAddress ? await QRCode.toDataURL(item.liquidationAddress, { margin: 1, width: 160 }) : null,
      orders: await Promise.all(
        walletOrders
          .filter((order) => order.beneficiaryId === item.id && order.feeAddress && item.liquidationAddress)
          .map(async (order) => ({
            order,
            feeQr: await QRCode.toDataURL(order.feeAddress || "", { margin: 1, width: 180 }),
            paymentQr: await QRCode.toDataURL(item.liquidationAddress || "", { margin: 1, width: 180 }),
            sendFeeUsdc: feeLabel(order.usdcAmount, order.feePercent),
          })),
      ),
    })),
  );
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="space-y-4">
        <h1 className="font-display text-4xl">Beneficiarios</h1>
        <p className="text-sm leading-6 text-teal-950/75">
          Al registrar un beneficiario se crea su cuenta externa en Bridge y una dirección de liquidación en USDC. Esa dirección es la que recibe el pago.
        </p>
        {cards.map(({ item, qr, orders }) => (
          <article key={item.id} className="card">
            <p className="text-xs uppercase tracking-wide text-teal-800">{railLabel(item.rail)} · USDC en {item.liquidationChain || "—"}</p>
            <h2 className="mt-1 text-lg font-semibold">{item.nickname}</h2>
            <p className="text-sm">{item.accountOwnerName}</p>
            <p className="text-sm text-teal-900/70">{item.bankName} ···· {item.accountLast4}</p>
            {item.liquidationAddress && qr ? (
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <img src={qr} alt="Código QR de la dirección de liquidación" className="h-28 w-28 rounded-xl bg-white" />
                <div className="min-w-0">
                  <p className="text-xs text-teal-900/60">Dirección de liquidación</p>
                  <p className="break-all text-sm font-medium">{item.liquidationAddress}</p>
                  <div className="mt-2"><CopyButton value={item.liquidationAddress} /></div>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-teal-900/70">Sin dirección de liquidación.</p>
            )}
            {orders.map(({ order, feeQr, paymentQr, sendFeeUsdc }) => (
              <TwoSends
                key={order.id}
                feeAmount={order.fixedFeeUsd || ""}
                feeAddress={order.feeAddress || ""}
                feeChain={order.feeChain || item.liquidationChain || ""}
                feeQr={feeQr}
                feeStatus={order.feeLegStatus || "pendiente"}
                paymentAmount={order.usdcAmount}
                paymentAddress={item.liquidationAddress || ""}
                paymentQr={paymentQr}
                paymentStatus={order.paymentLegStatus || "pendiente"}
                sendFeePercent={order.feePercent}
                sendFeeUsdc={sendFeeUsdc}
              />
            ))}
            <BeneficiaryActions
              beneficiaryId={item.id}
              sendFeePercent={pricing.sendFeePercent}
              walletSurchargePercent={pricing.walletSurchargePercent}
              fixedSendFeeUsd={pricing.fixedSendFeeUsd}
              hasWallet={Boolean(company?.bridgeWalletId)}
            />
          </article>
        ))}
        {cards.length === 0 ? <p className="text-sm text-teal-900/70">Todavía no hay beneficiarios.</p> : null}
      </section>
      <BeneficiaryForm />
    </div>
  );
}

function feeLabel(amount: string, percent: string): string {
  try {
    return feeAmount(amount, percent);
  } catch {
    return "";
  }
}
