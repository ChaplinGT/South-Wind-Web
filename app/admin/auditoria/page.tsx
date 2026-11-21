import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { auditActionLabel, labelOf } from "@/lib/labels";

export const metadata = { title: "Auditoría" };

export default async function AuditPage() {
  const logs = await prisma.auditLog.findMany({
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl">Auditoría</h1>
      <p className="text-sm text-teal-950/75">Queda registro de pagos, beneficiarios, conversiones, extractos, comisiones y webhooks.</p>
      <div className="overflow-x-auto rounded-3xl bg-white shadow-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-teal-900/50">
            <tr>{["Fecha", "Quién", "Acción", "Detalle"].map((heading) => <th key={heading} className="px-4 py-3 font-medium">{heading}</th>)}</tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-teal-50 align-top">
                <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                <td className="px-4 py-3">{log.actor?.name || "Sistema"}</td>
                <td className="px-4 py-3">{labelOf(auditActionLabel, log.action)}</td>
                <td className="px-4 py-3 text-xs text-teal-900/70">{log.entityType} {log.entityId || ""} {log.metadata !== "{}" ? log.metadata : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
