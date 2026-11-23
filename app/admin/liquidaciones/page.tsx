import { prisma } from "@/lib/db";
import { formatAmount, formatDateTime } from "@/lib/format";
import { LiquidacionActions } from "./actions";

export const metadata = { title: "Liquidaciones a bolivianos" };

export default async function LiquidacionesPage() {
  const rows = await prisma.liquidacionBob.findMany({
    include: { company: true },
    orderBy: { createdAt: "desc" },
  });
  const banks = await prisma.bolivianAccount.findMany({ where: { companyId: { in: rows.map((row) => row.companyId) } } });
  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl">Liquidaciones a bolivianos</h1>
      <p className="text-sm text-teal-950/75">Depósitos recibidos en una cuenta virtual cuyo USDC entra a South Wind. Abone el equivalente a la cuenta boliviana del cliente.</p>
      {rows.map((row) => {
        const bank = banks.find((item) => item.id === row.bolivianAccountId) || banks.find((item) => item.companyId === row.companyId);
        return (
          <article key={row.id} className="card">
            <p className="font-semibold">{row.company.legalName}</p>
            <p className="text-sm">
              {row.usdcAmount} USDC recibidos
              {row.fixedFeeBearer === "portal" ? ` · cargo fijo ${row.fixedFeeUsd} USD descontado aquí` : ""}
              {row.fixedFeeBearer === "bridge" ? " · cargo fijo ya retenido por Bridge" : ""}
              {row.netUsdcAmount ? ` · neto ${row.netUsdcAmount} USDC` : ""}
              {row.rate ? ` · tasa ${row.rate}` : " · tasa al marcar pagado"}
              {row.bobAmount ? ` · ${formatAmount(row.bobAmount, "bob")}` : ""}
              {" · "}{row.status}
            </p>
            <p className="text-sm text-teal-900/70">{bank ? `${bank.bankName} · ${bank.accountNumber} · ${bank.accountHolder}` : "Sin cuenta boliviana registrada"}</p>
            <p className="text-xs text-teal-900/60">{formatDateTime(row.createdAt)} · {row.reference}</p>
            <LiquidacionActions id={row.id} />
          </article>
        );
      })}
      {rows.length === 0 ? <p className="text-sm">No hay liquidaciones.</p> : null}
    </div>
  );
}
