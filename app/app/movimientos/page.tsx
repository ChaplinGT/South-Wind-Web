import { TransferPill, ConversionPill, Pill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatAmount, formatDateShort } from "@/lib/format";
import { kindLabel, labelOf } from "@/lib/labels";
import { requireClient } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Movimientos" };

export default async function MovementsPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; desde?: string; hasta?: string; q?: string }>;
}) {
  const session = await requireClient();
  const filters = await searchParams;
  const [entries, transfers, conversions] = await Promise.all([
    prisma.ledgerEntry.findMany({ where: { companyId: session.companyId }, orderBy: { postedAt: "desc" } }),
    prisma.transfer.findMany({ where: { companyId: session.companyId } }),
    prisma.conversionRequest.findMany({ where: { companyId: session.companyId } }),
  ]);
  const transferById = new Map(transfers.map((item) => [item.id, item]));
  const conversionById = new Map(conversions.map((item) => [item.id, item]));
  const desde = filters.desde ? dayStart(filters.desde) : null;
  const hasta = filters.hasta ? dayEnd(filters.hasta) : null;
  const visible = entries.filter((entry) => {
    if (filters.tipo && entry.kind !== filters.tipo) return false;
    const time = entry.postedAt.getTime();
    if (desde && time < desde.getTime()) return false;
    if (hasta && time > hasta.getTime()) return false;
    if (filters.q && !`${entry.description} ${entry.reference}`.toLowerCase().includes(filters.q.toLowerCase())) return false;
    return true;
  });
  return (
    <div className="space-y-5">
      <h1 className="font-display text-4xl">Movimientos</h1>
      <form className="card grid gap-3 sm:grid-cols-4" method="get">
        <label><span className="label">Tipo</span>
          <select className="input" name="tipo" defaultValue={filters.tipo || ""}>
            <option value="">Todos</option>
            <option value="deposit">Depósitos</option>
            <option value="payout">Pagos</option>
            <option value="conversion_out">Conversión a bolivianos</option>
            <option value="conversion_in">Conversión a USDC</option>
          </select>
        </label>
        <label><span className="label">Desde</span><input className="input" type="date" name="desde" defaultValue={filters.desde || ""} /></label>
        <label><span className="label">Hasta</span><input className="input" type="date" name="hasta" defaultValue={filters.hasta || ""} /></label>
        <label><span className="label">Buscar</span><input className="input" name="q" defaultValue={filters.q || ""} placeholder="Referencia" /></label>
        <button className="btn-primary sm:col-span-4" type="submit">Filtrar</button>
      </form>
      <div className="space-y-3">
        {visible.map((entry) => {
          const transfer = entry.transferId ? transferById.get(entry.transferId) : undefined;
          const conversion = entry.conversionId ? conversionById.get(entry.conversionId) : undefined;
          return (
            <article key={entry.id} className="card flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-teal-900/60">{formatDateShort(entry.postedAt)} · {entry.reference} · {labelOf(kindLabel, entry.kind)}</p>
                <p className="mt-1 font-medium">{entry.description}</p>
                <div className="mt-2">
                  {transfer ? <TransferPill state={transfer.state} /> : null}
                  {conversion ? <ConversionPill status={conversion.status} /> : null}
                  {entry.kind === "deposit" ? <Pill tone="ok">Acreditado</Pill> : null}
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold">{entry.credit !== "0.00" ? formatAmount(entry.credit) : formatAmount(entry.debit)}</p>
                <p className="text-xs text-teal-900/60">{entry.credit !== "0.00" ? "Abono" : "Cargo"}</p>
                {transfer ? <a className="mt-2 inline-block text-sm font-semibold text-teal-800" href={`/api/comprobantes/pago/${transfer.id}`}>Comprobante</a> : null}
                {conversion ? <a className="mt-2 inline-block text-sm font-semibold text-teal-800" href={`/api/comprobantes/conversion/${conversion.id}`}>Comprobante</a> : null}
              </div>
            </article>
          );
        })}
        {visible.length === 0 ? <p className="text-sm text-teal-900/70">No hay movimientos con esos filtros.</p> : null}
      </div>
    </div>
  );
}

function dayStart(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 4, 0, 0));
}
function dayEnd(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1, 3, 59, 59, 999));
}
