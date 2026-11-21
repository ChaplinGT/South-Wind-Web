import { RegisterForm } from "@/components/forms";
import { PublicFooter, PublicHeader, MockNotice } from "@/components/site";
import { isMockMode } from "@/lib/env";

export const metadata = { title: "Abrir cuenta" };

export default function OpenAccountPage() {
  return (
    <div>
      {isMockMode() ? <MockNotice /> : null}
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-800">Nueva empresa</p>
        <h1 className="mt-2 font-display text-4xl">Abra su cuenta</h1>
        <p className="mt-3 text-sm leading-6 text-teal-950/75">
          Después del registro le pediremos completar la verificación de Bridge. Si su empresa ya fue aprobada en el panel de South Wind, no use este formulario: pida al administrador que vincule su customer_id.
        </p>
        <div className="mt-6">
          <RegisterForm />
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
