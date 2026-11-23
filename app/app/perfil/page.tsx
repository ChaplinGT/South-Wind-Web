import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Perfil" };

export default async function ProfilePage() {
  const session = await requireUser();
  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  const profiles = await prisma.company.findMany({ where: { ownerUserId: session.sub } });
  const persona = profiles.find((item) => item.kind === "persona");
  const empresa = profiles.find((item) => item.kind === "empresa");
  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl">Perfil</h1>
      <section className="card">
        <h2 className="font-display text-2xl">Usuario South Wind</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-teal-900/60">Nombre</dt><dd className="font-semibold">{user?.name}</dd></div>
          <div><dt className="text-teal-900/60">Correo</dt><dd className="font-semibold">{user?.email}</dd></div>
          <div><dt className="text-teal-900/60">Teléfono</dt><dd className="font-semibold">{user?.phone || "No indicado"}</dd></div>
          <div><dt className="text-teal-900/60">Acceso</dt><dd className="font-semibold">{user?.googleSub ? "Google y, si definió clave, contraseña" : "Correo y contraseña"}</dd></div>
        </dl>
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <article className="card">
          <h2 className="font-display text-2xl">Persona</h2>
          {persona ? <ProfileFacts name={persona.legalName} status={persona.kybStatus} extra={persona.bridgeCustomerId || "Sin id de Bridge"} /> : <p className="mt-2 text-sm">Aún no registró un perfil personal en Bridge.</p>}
        </article>
        <article className="card">
          <h2 className="font-display text-2xl">Empresa</h2>
          {empresa ? <ProfileFacts name={empresa.legalName} status={empresa.kybStatus} extra={`NIT ${empresa.nit || "—"} · ${empresa.city}`} /> : <p className="mt-2 text-sm">Aún no registró una empresa en Bridge.</p>}
        </article>
      </section>
    </div>
  );
}

function ProfileFacts({ name, status, extra }: { name: string; status: string; extra: string }) {
  return (
    <div className="mt-2 text-sm">
      <p className="font-semibold">{name}</p>
      <p>Verificación: {status}</p>
      <p className="text-teal-900/70">{extra}</p>
    </div>
  );
}
