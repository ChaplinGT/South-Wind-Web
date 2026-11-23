import { BobAccountForm, ConversionForm } from "@/components/forms";
import { ConversionPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatAmount, formatDateShort } from "@/lib/format";
import { directionLabel, labelOf } from "@/lib/labels";
import { canTransact } from "@/lib/kyb";
import { requireClient, requireCompany } from "@/lib/session";

export const metadata = { title: "Conversiones" };

export default async function ConversionsPage() {
  const session = await requireClient();
  const company = await requireCompany(session.companyId);
  const [accounts, conversions] = await Promise.all([
    prisma.bolivianAccount.findMany({ where: { companyId: company.id } }),
    prisma.conversionRequest.findMany({ where: { companyId: company.id }, orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Conversiones</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-teal-950/75">
          Indique el monto y su cuenta en Bolivia. Le informamos cuando la conversión esté pendiente, en proceso o pagada.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {canTransact(company.kybStatus) ? (
          <ConversionForm accounts={accounts.map((account) => ({ id: account.id, label: `${account.bankName} · ${account.accountNumber}` }))} />
        ) : (
          <div className="card text-sm">La solicitud se habilita con la verificación aprobada.</div>
        )}
        <section className="card">
          <h2 className="font-display text-2xl">Cuentas en Bolivia</h2>
          <ul className="my-3 space-y-2 text-sm">
            {accounts.map((account) => (
              <li key={account.id}>{account.bankName} · {account.accountType === "ahorro" ? "Caja de ahorro" : "Cuenta corriente"} · {account.accountNumber}</li>
            ))}
          </ul>
          <BobAccountForm />
        </section>
      </div>
      <section className="space-y-3">
        {conversions.map((item) => (
          <article key={item.id} className="card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{labelOf(directionLabel, item.direction)}</p>
                <p className="text-sm text-teal-900/70">{formatDateShort(item.createdAt)} · {item.reference || "Sin referencia"} · {item.bankSnapshot}</p>
              </div>
              <div className="text-right">
                <p className="font-display text-2xl">{formatAmount(item.amount, item.sourceCurrency)}</p>
                <ConversionPill status={item.status} />
              </div>
            </div>
            {item.status === "pagado" ? <a className="mt-3 inline-block text-sm font-semibold text-teal-800" href={`/api/comprobantes/conversion/${item.id}`}>Descargar comprobante</a> : null}
          </article>
        ))}
      </section>
    </div>
  );
}
