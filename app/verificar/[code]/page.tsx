import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { prisma } from "@/lib/db";
import { formatAmount, formatDate } from "@/lib/format";
import { legalEntity } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function VerifyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const statement = await prisma.statement.findUnique({
    where: { verificationCode: code.toUpperCase() },
    include: { company: true },
  });
  if (!statement) notFound();
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <div className="overflow-hidden rounded-[2rem] bg-white shadow-card">
        <div className="bg-teal-800 px-6 py-6">
          <Logo variant="horizontal" className="h-12 w-auto" />
        </div>
        <div className="space-y-4 px-6 py-6">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">Documento auténtico</p>
          <h1 className="font-display text-3xl">Extracto verificado</h1>
          <p className="text-sm leading-6 text-teal-950/75">
            Este código corresponde a un extracto emitido por {legalEntity.name}.
          </p>
          <dl className="grid gap-3 text-sm">
            <div><dt className="text-teal-900/60">Extracto</dt><dd className="font-semibold">{statement.statementNumber}</dd></div>
            <div><dt className="text-teal-900/60">Cliente</dt><dd className="font-semibold">{statement.company.legalName}</dd></div>
            <div><dt className="text-teal-900/60">NIT</dt><dd className="font-semibold">{statement.company.nit}</dd></div>
            <div><dt className="text-teal-900/60">Período</dt><dd className="font-semibold">{formatDate(statement.periodStart)} — {formatDate(statement.periodEnd)}</dd></div>
            <div><dt className="text-teal-900/60">Saldo final</dt><dd className="font-display text-2xl text-teal-900">{formatAmount(statement.closingBalance)}</dd></div>
            <div><dt className="text-teal-900/60">Código</dt><dd className="font-semibold">{statement.verificationCode}</dd></div>
          </dl>
        </div>
      </div>
    </main>
  );
}
