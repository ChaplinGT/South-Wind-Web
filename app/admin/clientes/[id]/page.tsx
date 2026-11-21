import Link from "next/link";
import { notFound } from "next/navigation";
import { KybPill, TransferPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { getBridge } from "@/lib/bridge";
import { formatAmount, formatDateTime } from "@/lib/format";
import { companyBalance } from "@/lib/services/ledger";

export const dynamic = "force-dynamic";

export default async function AdminClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await prisma.company.findUnique({
    where: { id },
    include: { users: true, transfers: { orderBy: { createdAt: "desc" }, take: 8 } },
  });
  if (!company) notFound();
  const balance = await companyBalance(company.id);
  let bridgeNote = "Sin customer_id de Bridge.";
  let endorsements: { name: string; status: string }[] = [];
  if (company.bridgeCustomerId) {
    try {
      const remote = await getBridge().getCustomer(company.bridgeCustomerId);
      bridgeNote = `Bridge: ${remote.status}`;
      endorsements = remote.endorsements ?? [];
    } catch {
      bridgeNote = "No se pudo consultar a Bridge en este momento.";
    }
  }
  return (
    <div className="space-y-6">
      <Link className="text-sm font-semibold text-teal-800" href="/admin">← Clientes</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">{company.legalName}</h1>
          <p className="text-sm text-teal-900/70">NIT {company.nit} · {company.city}</p>
        </div>
        <KybPill status={company.kybStatus} />
      </div>
      <section className="grid gap-4 md:grid-cols-3">
        <div className="card"><p className="text-xs text-teal-900/60">Saldo USDC</p><p className="font-display text-3xl">{formatAmount(balance)}</p></div>
        <div className="card"><p className="text-xs text-teal-900/60">Bridge</p><p className="font-semibold">{bridgeNote}</p><p className="mt-1 break-all text-xs">{company.bridgeCustomerId}</p></div>
        <div className="card"><p className="text-xs text-teal-900/60">Usuarios</p>{company.users.map((user) => <p key={user.id} className="text-sm">{user.name} · {user.email}</p>)}</div>
      </section>
      {endorsements.length > 0 ? (
        <section className="card">
          <h2 className="font-display text-2xl">Endosos</h2>
          <ul className="mt-2 text-sm">{endorsements.map((item) => <li key={item.name}>{item.name}: {item.status}</li>)}</ul>
        </section>
      ) : null}
      <section className="card">
        <h2 className="font-display text-2xl">Transferencias recientes</h2>
        <ul className="mt-3 space-y-3 text-sm">
          {company.transfers.map((transfer) => (
            <li key={transfer.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>{formatDateTime(transfer.createdAt)} · {transfer.reference} · {transfer.beneficiaryName}</span>
              <TransferPill state={transfer.state} />
            </li>
          ))}
          {company.transfers.length === 0 ? <li>Sin transferencias.</li> : null}
        </ul>
      </section>
    </div>
  );
}
