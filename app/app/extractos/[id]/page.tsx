import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { legalEntity } from "@/lib/brand";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { formatAmount, formatDate, formatDateTime, monthLabel } from "@/lib/format";
import { readLines } from "@/lib/services/statements";
import { requireClient } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function StatementPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireClient();
  const { id } = await params;
  const statement = await prisma.statement.findFirst({
    where: { id, companyId: session.companyId },
    include: { company: true },
  });
  if (!statement) notFound();
  const lines = readLines(statement.linesJson);
  const company = statement.company;
  const start = statement.periodStart;
  const label = monthLabel(start.getUTCMonth() === 11 && start.getUTCDate() === 1 ? start.getUTCFullYear() : start.getUTCFullYear(), start.getUTCMonth() + 1);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">Extracto</h1>
        <a className="btn-primary" href={`/api/extractos/${statement.id}/pdf`}>Descargar PDF</a>
      </div>
      <article className="overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-teal-100">
        <header className="flex items-center justify-between bg-teal-800 px-6 py-4 text-white">
          <Logo variant="horizontal" className="h-12 w-auto" />
          <div className="text-right">
            <p className="font-display text-lg">Extracto de cuenta</p>
            <p className="text-xs text-white/70">{legalEntity.name}</p>
          </div>
        </header>
        <div className="grid gap-6 px-6 py-6 md:grid-cols-2">
          <div className="text-sm leading-6">
            <p className="font-semibold">Emisor</p>
            <p>{legalEntity.name}</p>
            {legalEntity.addressLines.map((line) => <p key={line}>{line}</p>)}
          </div>
          <div className="text-sm leading-6">
            <p className="font-semibold">Cliente</p>
            <p>{company.legalName}</p>
            <p>NIT {company.nit}</p>
            <p>{company.address}</p>
            <p>{company.city}, Bolivia</p>
          </div>
        </div>
        <div className="grid gap-3 px-6 pb-6 sm:grid-cols-4">
          {[
            ["Extracto", statement.statementNumber],
            ["Período", label],
            ["Emitido", formatDateTime(statement.generatedAt)],
            ["Saldo final", formatAmount(statement.closingBalance)],
          ].map(([name, value]) => (
            <div key={name} className="rounded-2xl bg-teal-50 p-3">
              <p className="text-xs text-teal-900/60">{name}</p>
              <p className="font-semibold">{value}</p>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto px-2 pb-4">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-teal-900 text-white">
              <tr>
                {["Fecha", "Referencia", "Descripción", "Débito", "Crédito", "Saldo"].map((heading) => (
                  <th key={heading} className="px-3 py-2 font-medium">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={`${line.reference}-${line.postedAt}`} className="border-b border-teal-50">
                  <td className="px-3 py-2">{formatDate(line.postedAt)}</td>
                  <td className="px-3 py-2">{line.reference}</td>
                  <td className="px-3 py-2">{line.description}</td>
                  <td className="px-3 py-2 text-right">{line.debit === "0.00" ? "—" : formatAmount(line.debit)}</td>
                  <td className="px-3 py-2 text-right">{line.credit === "0.00" ? "—" : formatAmount(line.credit)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatAmount(line.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="grid gap-4 px-6 py-6 text-sm md:grid-cols-[1fr_auto]">
          <div>
            <p className="font-semibold">Código de verificación {statement.verificationCode}</p>
            <p className="mt-1 break-all text-teal-800">{appUrl()}/verificar/{statement.verificationCode}</p>
            <p className="mt-3 text-xs leading-5 text-teal-900/60">
              {legalEntity.name} no es un banco. Este extracto resume los movimientos de su cuenta.
            </p>
          </div>
        </footer>
      </article>
    </div>
  );
}
