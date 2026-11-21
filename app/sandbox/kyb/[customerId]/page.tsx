import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { ApproveKybButton } from "@/components/forms";
import { prisma } from "@/lib/db";
import { isMockMode } from "@/lib/env";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SandboxKybPage({ params }: { params: Promise<{ customerId: string }> }) {
  if (!isMockMode()) notFound();
  const { customerId } = await params;
  const company = await prisma.company.findUnique({ where: { bridgeCustomerId: customerId } });
  const session = await readSession();
  const allowed = session && company && (session.role === "admin" || session.companyId === company.id);
  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <div className="card space-y-4">
        <Logo variant="horizontal" className="h-12 w-auto rounded-xl" />
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-800">Simulación de Bridge · sandbox</p>
        <h1 className="font-display text-3xl">Verificación de la empresa</h1>
        <p className="text-sm leading-6 text-teal-950/75">
          En producción este paso ocurre en el enlace alojado por Bridge. Aquí solo se simula la aprobación para poder recorrer el portal sin una clave.
        </p>
        {company ? <p className="font-semibold">{company.legalName}</p> : <p>No encontramos la empresa de este enlace.</p>}
        {company?.kybStatus === "approved" ? <p className="text-sm text-emerald-700">La verificación ya figura como aprobada.</p> : null}
        {allowed && company && company.kybStatus !== "approved" ? <ApproveKybButton customerId={customerId} /> : null}
        {!allowed && company ? <p className="text-sm">Inicie sesión con el usuario de esta empresa para continuar.</p> : null}
      </div>
    </main>
  );
}
