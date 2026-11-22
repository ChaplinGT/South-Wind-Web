import { redirect } from "next/navigation";
import { PortalShell } from "@/components/shell";
import { isMockMode } from "@/lib/env";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const items = [
  { href: "/admin", label: "Clientes" },
  { href: "/admin/vincular", label: "Vincular cliente" },
  { href: "/admin/transferencias", label: "Transferencias" },
  { href: "/admin/conversiones", label: "Conversiones" },
  { href: "/admin/comision", label: "Comisión" },
  { href: "/admin/auditoria", label: "Auditoría" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session) redirect("/api/auth/logout");
  if (session.role !== "admin") redirect("/app");
  return (
    <PortalShell items={items} user={{ name: session.name, email: session.email }} eyebrow="Administración" mock={isMockMode()}>
      {children}
    </PortalShell>
  );
}
