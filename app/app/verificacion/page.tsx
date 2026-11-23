import { KybButton } from "@/components/forms";
import { KybPill } from "@/components/ui";
import { kybLabel, labelOf } from "@/lib/labels";
import { requireClient, requireCompany } from "@/lib/session";

export const metadata = { title: "Verificación" };

export default async function VerificationPage() {
  const session = await requireClient();
  const company = await requireCompany(session.companyId);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="font-display text-4xl">Verificación de la empresa</h1>
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold">{company.legalName}</p>
          <KybPill status={company.kybStatus} />
        </div>
        <p className="text-sm leading-6 text-teal-950/75">
          Estado: {labelOf(kybLabel, company.kybStatus)}. Si ya estaba aprobada, no hace falta repetirla. Si es nueva, continúe la verificación.
        </p>
        {company.kybStatus === "approved" ? (
          <p className="text-sm text-emerald-700">Su empresa ya puede recibir y enviar pagos.</p>
        ) : (
          <KybButton hasLink={Boolean(company.kybLinkUrl)} />
        )}
        {company.kybLinkUrl && company.kybStatus !== "approved" ? (
          <a className="inline-flex text-sm font-semibold text-teal-800" href={company.kybLinkUrl} target="_blank" rel="noreferrer">
            Abrir verificación
          </a>
        ) : null}
      </div>
    </div>
  );
}
