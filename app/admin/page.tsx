import Link from "next/link";
import { KybPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDateShort } from "@/lib/format";
import { clientTypeLabel, labelOf } from "@/lib/labels";

export const metadata = { title: "Clientes" };

export default async function AdminClientsPage() {
  const companies = await prisma.company.findMany({ orderBy: { createdAt: "desc" }, include: { users: true } });
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">Clientes</h1>
          <p className="mt-1 text-sm text-teal-900/70">{companies.length} empresas en el portal.</p>
        </div>
        <Link className="btn-primary" href="/admin/vincular">Vincular cliente de Bridge</Link>
      </div>
      <div className="overflow-x-auto rounded-3xl bg-white shadow-card">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-teal-900/50">
            <tr>
              {["Empresa", "NIT", "Tipo", "KYB", "Origen", "Alta"].map((heading) => (
                <th key={heading} className="px-4 py-3 font-medium">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => (
              <tr key={company.id} className="border-t border-teal-50">
                <td className="px-4 py-3">
                  <Link className="font-semibold text-teal-900" href={`/admin/clientes/${company.id}`}>{company.legalName}</Link>
                  <p className="text-xs text-teal-900/60">{company.city}</p>
                </td>
                <td className="px-4 py-3">{company.nit}</td>
                <td className="px-4 py-3">{labelOf(clientTypeLabel, company.clientType)}</td>
                <td className="px-4 py-3"><KybPill status={company.kybStatus} /></td>
                <td className="px-4 py-3">{company.onboardingSource === "invited" ? "Vinculado" : "Registro"}</td>
                <td className="px-4 py-3">{formatDateShort(company.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
