import { BeneficiaryForm } from "@/components/forms";
import { prisma } from "@/lib/db";
import { railLabel } from "@/lib/rails";
import { requireClient } from "@/lib/session";

export const metadata = { title: "Beneficiarios" };

export default async function BeneficiariesPage() {
  const session = await requireClient();
  const beneficiaries = await prisma.beneficiary.findMany({
    where: { companyId: session.companyId },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <section className="space-y-4">
        <h1 className="font-display text-4xl">Beneficiarios</h1>
        <div className="space-y-3">
          {beneficiaries.map((item) => (
            <article key={item.id} className="card">
              <p className="text-xs uppercase tracking-wide text-teal-800">{railLabel(item.rail)}</p>
              <h2 className="mt-1 text-lg font-semibold">{item.nickname}</h2>
              <p className="text-sm">{item.accountOwnerName}</p>
              <p className="text-sm text-teal-900/70">{item.bankName} ···· {item.accountLast4}</p>
            </article>
          ))}
          {beneficiaries.length === 0 ? <p className="text-sm text-teal-900/70">Todavía no hay beneficiarios.</p> : null}
        </div>
      </section>
      <BeneficiaryForm />
    </div>
  );
}
