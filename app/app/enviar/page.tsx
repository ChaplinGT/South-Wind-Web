import { PaymentForm } from "@/components/forms";
import { prisma } from "@/lib/db";
import { canTransact } from "@/lib/kyb";
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
  const [balance, pricing] = await Promise.all([companyBalance(company.id), getPricing()]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Enviar pago</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-teal-950/75">
          El dinero sale de su saldo USDC hacia el beneficiario. Verá la comisión de South Wind antes de confirmar.
        </p>
      </div>
      {canTransact(company.kybStatus) ? (
        <PaymentForm
          balance={balance}
          sendFeePercent={pricing.sendFeePercent}
          walletSurchargePercent={pricing.walletSurchargePercent}
          fixedSendFeeUsd={pricing.fixedSendFeeUsd}
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
