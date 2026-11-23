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
  { href: "/app/perfil", label: "Perfil" },
];

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session) redirect("/api/auth/logout");
  if (session.role !== "client") redirect("/admin");
  const company = session.companyId
    ? await prisma.company.findUnique({ where: { id: session.companyId } })
    : null;
  return (
    <PortalShell items={items} user={{ name: company?.tradeName || session.name, email: session.email }} eyebrow="Su cuenta" mock={isMockMode()}>
      {children}
    </PortalShell>
  );
}
