import { redirect } from "next/navigation";
import { PortalShell } from "@/components/shell";
import { prisma } from "@/lib/db";
import { isMockMode } from "@/lib/env";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const items = [
  { href: "/app", label: "Inicio" },
  { href: "/app/cuenta", label: "Cuenta virtual" },
  { href: "/app/enviar", label: "Enviar pago" },
  { href: "/app/beneficiarios", label: "Beneficiarios" },
  { href: "/app/conversiones", label: "Conversiones" },
  { href: "/app/movimientos", label: "Movimientos" },
  { href: "/app/extractos", label: "Extractos" },
  { href: "/app/verificacion", label: "Verificación" },
];

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session) redirect("/ingresar");
  if (session.role !== "client" || !session.companyId) redirect("/admin");
  const company = await prisma.company.findUnique({ where: { id: session.companyId } });
  if (!company) redirect("/ingresar");
  return (
    <PortalShell items={items} user={{ name: company.tradeName, email: session.email }} eyebrow="Su cuenta" mock={isMockMode()}>
      {children}
    </PortalShell>
  );
}
