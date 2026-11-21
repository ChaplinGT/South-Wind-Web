import Link from "next/link";
import { KybPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatAmount, formatDateShort } from "@/lib/format";
import { clientTypeLabel, kindLabel, labelOf } from "@/lib/labels";
import { companyBalance } from "@/lib/services/ledger";
import { requireClient, requireCompany } from "@/lib/session";

export const metadata = { title: "Inicio" };

export default async function DashboardPage() {
  const session = await requireClient();
  const company = await requireCompany(session.companyId);
  const balance = await companyBalance(company.id);
  const movements = await prisma.ledgerEntry.findMany({
    where: { companyId: company.id },
    orderBy: { postedAt: "desc" },
    take: 5,
  });
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-teal-900/70">{labelOf(clientTypeLabel, company.clientType)} · NIT {company.nit}</p>
        <h1 className="font-display text-4xl">{company.tradeName}</h1>
      </div>
      {company.kybStatus !== "approved" ? (
        <div className="rounded-3xl bg-amber-50 px-5 py-4 text-sm">
          Su verificación está {company.kybStatus === "pending" ? "pendiente" : "en curso"}.{" "}
          <Link className="font-semibold text-teal-800" href="/app/verificacion">Continuar</Link>
        </div>
      ) : null}
      <section className="overflow-hidden rounded-[2rem] bg-teal-800 text-white">
        <div className="px-6 py-7">
          <p className="text-sm text-white/70">Saldo disponible</p>
          <p className="mt-2 font-display text-5xl">{formatAmount(balance)}</p>
          <p className="mt-3 max-w-lg text-sm text-white/75">Cuenta en USDC. Los dólares que recibe se acreditan aquí. La conversión a bolivianos se solicita aparte.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-teal-900" href="/app/enviar">Enviar pago</Link>
            <Link className="rounded-full px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/40" href="/app/conversiones">Solicitar conversión</Link>
            <Link className="rounded-full px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/40" href="/app/cuenta">Ver cuenta virtual</Link>
          </div>
        </div>
      </section>
      <section className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl">Últimos movimientos</h2>
            <Link className="text-sm font-semibold text-teal-800" href="/app/movimientos">Ver todos</Link>
          </div>
          <div className="divide-y divide-teal-100">
            {movements.map((movement) => (
              <div key={movement.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">{movement.description}</p>
                  <p className="text-xs text-teal-900/60">{formatDateShort(movement.postedAt)} · {movement.reference} · {labelOf(kindLabel, movement.kind)}</p>
                </div>
                <p className={movement.credit !== "0.00" ? "font-semibold text-emerald-700" : "font-semibold"}>
                  {movement.credit !== "0.00" ? `+${formatAmount(movement.credit)}` : `−${formatAmount(movement.debit)}`}
                </p>
              </div>
            ))}
            {movements.length === 0 ? <p className="text-sm text-teal-900/70">Todavía no hay movimientos.</p> : null}
          </div>
        </div>
        <aside className="card h-fit space-y-3">
          <h2 className="font-display text-2xl">Empresa</h2>
          <p className="text-sm">{company.legalName}</p>
          <KybPill status={company.kybStatus} />
          <p className="text-sm text-teal-900/70">{company.city}, Bolivia</p>
        </aside>
      </section>
    </div>
  );
}
