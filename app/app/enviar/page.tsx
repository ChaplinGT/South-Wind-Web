import { SendPaymentForm } from "@/components/send-payment";
import { prisma } from "@/lib/db";
import { canTransact } from "@/lib/kyb";
import { destinationPerUsdc } from "@/lib/send-rates";
import { companyBalance } from "@/lib/services/ledger";
import { getPricing } from "@/lib/settings";
import { requireClient, requireCompany } from "@/lib/session";

export const metadata = { title: "Enviar pago" };

export default async function SendPage() {
  const session = await requireClient();
  const company = await requireCompany(session.companyId);
  const beneficiaries = await prisma.beneficiary.findMany({
    where: { companyId: company.id, status: "active" },
    orderBy: { createdAt: "desc" },
  });
  const [balance, pricing, eur, gbp, mxn, brl] = await Promise.all([
    companyBalance(company.id),
    getPricing(),
    destinationPerUsdc("eur").catch(() => null),
    destinationPerUsdc("gbp").catch(() => null),
    destinationPerUsdc("mxn").catch(() => null),
    destinationPerUsdc("brl").catch(() => null),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Enviar pago</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-teal-950/75">
          El pago sale de su saldo USDC. Revise la comisión antes de confirmar.
        </p>
      </div>
      {canTransact(company.kybStatus) ? (
        <SendPaymentForm
          balance={balance}
          hasWallet={Boolean(company.bridgeWalletId)}
          sendFeePercent={pricing.sendFeePercent}
          walletSurchargePercent={pricing.walletSurchargePercent}
          achFixedFee={pricing.fixedSendFeeUsd}
          wireFixedFee={pricing.wireFixedFeeUsd}
          standardFixedFee={pricing.fixedSendFeeUsd}
          rates={{ usd: 1, eur, gbp, mxn, brl }}
          beneficiaries={beneficiaries.map((item) => ({
            id: item.id,
            nickname: item.nickname,
            accountOwnerName: item.accountOwnerName,
            rail: item.rail,
            accountLast4: item.accountLast4,
            bankName: item.bankName,
            currency: item.currency,
          }))}
        />
      ) : (
        <div className="card text-sm">Podrá enviar pagos cuando la verificación de su empresa esté aprobada.</div>
      )}
    </div>
  );
}
