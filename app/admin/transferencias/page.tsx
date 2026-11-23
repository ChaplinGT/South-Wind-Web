import { SyncTransferButton } from "@/components/forms";
import { TransferPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatAmount, formatDateTime } from "@/lib/format";
import { railLabel } from "@/lib/rails";

export const dynamic = "force-dynamic";
export const metadata = { title: "Transferencias" };

export default async function AdminTransfersPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { estado } = await searchParams;
  const transfers = await prisma.transfer.findMany({
    where: estado ? { state: estado } : undefined,
    include: { company: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="space-y-5">
      <h1 className="font-display text-4xl">Transferencias</h1>
      <form className="flex flex-wrap gap-2" method="get">
        <select className="input w-auto" name="estado" defaultValue={estado || ""}>
          <option value="">Todos los estados</option>
          {["payment_processed", "payment_submitted", "in_review", "awaiting_funds", "returned", "refunded", "canceled"].map((state) => (
            <option key={state} value={state}>{state}</option>
          ))}
        </select>
        <button className="btn-secondary" type="submit">Filtrar</button>
      </form>
      <div className="space-y-3">
        {transfers.map((transfer) => (
          <article key={transfer.id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{transfer.company.tradeName}</p>
                <p className="text-sm">{transfer.beneficiaryName} · {railLabel(transfer.rail)} · {transfer.reference}</p>
                <p className="text-xs text-teal-900/60">{formatDateTime(transfer.createdAt)} · {transfer.bridgeTransferId}</p>
              </div>
              <div className="text-right">
                <p className="font-display text-2xl">{formatAmount(transfer.totalDebit)}</p>
                <p className="text-xs text-teal-900/60">incluye comisión {formatAmount(transfer.developerFee)}</p>
                <div className="mt-2"><TransferPill state={transfer.state} /></div>
                <SyncTransferButton id={transfer.id} />
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
