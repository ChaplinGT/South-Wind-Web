import Link from "next/link";
import { StatementForm } from "@/components/forms";
import { prisma } from "@/lib/db";
import { formatAmount, formatDate } from "@/lib/format";
import { requireClient } from "@/lib/session";

export const metadata = { title: "Extractos" };

export default async function StatementsPage() {
  const session = await requireClient();
  const statements = await prisma.statement.findMany({
    where: { companyId: session.companyId },
    orderBy: { periodStart: "desc" },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Extractos de cuenta</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-teal-950/75">
          Cada extracto queda numerado y lleva un código para que un tercero confirme su autenticidad.
        </p>
      </div>
      <StatementForm />
      <div className="space-y-3">
        {statements.map((statement) => (
          <article key={statement.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">{statement.statementNumber}</p>
              <p className="text-sm text-teal-900/70">{formatDate(statement.periodStart)} — {formatDate(statement.periodEnd)}</p>
              <p className="text-xs text-teal-900/60">Código {statement.verificationCode}</p>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl">{formatAmount(statement.closingBalance)}</p>
              <div className="mt-2 flex gap-3 text-sm font-semibold text-teal-800">
                <Link href={`/app/extractos/${statement.id}`}>Ver</Link>
                <a href={`/api/extractos/${statement.id}/pdf`}>PDF</a>
              </div>
            </div>
          </article>
        ))}
        {statements.length === 0 ? <p className="text-sm text-teal-900/70">Aún no hay extractos generados.</p> : null}
      </div>
    </div>
  );
}
