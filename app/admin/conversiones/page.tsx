import { ConversionAdminForm } from "@/components/forms";
import { ConversionPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatAmount, formatDateTime } from "@/lib/format";
import { directionLabel, labelOf } from "@/lib/labels";

export const metadata = { title: "Conversiones" };

export default async function AdminConversionsPage() {
  const conversions = await prisma.conversionRequest.findMany({
    include: { company: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl">Solicitudes de conversión</h1>
      <p className="max-w-2xl text-sm text-teal-950/75">Cambie el estado, deje una referencia y, si corresponde, adjunte el comprobante del abono en bolivianos o de los USDC acreditados.</p>
      {conversions.map((item) => (
        <article key={item.id} className="card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{item.company.legalName}</p>
              <p className="text-sm">{labelOf(directionLabel, item.direction)} · {formatAmount(item.amount, item.sourceCurrency)}</p>
              <p className="text-sm text-teal-900/70">{item.bankSnapshot}</p>
              <p className="text-xs text-teal-900/60">{formatDateTime(item.createdAt)} {item.reference ? `· ${item.reference}` : ""}</p>
              {item.adminNote ? <p className="mt-1 text-sm">{item.adminNote}</p> : null}
            </div>
            <ConversionPill status={item.status} />
          </div>
          {item.receiptFile ? <a className="mt-2 inline-block text-sm font-semibold text-teal-800" href={`/api/admin/conversiones/${item.id}/archivo`}>Ver comprobante adjunto</a> : null}
          <ConversionAdminForm id={item.id} status={item.status} />
        </article>
      ))}
    </div>
  );
}
