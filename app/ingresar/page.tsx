import { Logo } from "@/components/logo";
import { MockNotice } from "@/components/site";
import { DEMO_PASSWORD, demoCompanies } from "@/lib/demo-data";
import { isMockMode } from "@/lib/env";

export const metadata = { title: "Ingresar" };

const demos = [
  ["Equipo South Wind", "admin@southwind.example"],
  ...demoCompanies.map((company) => [company.tradeName, company.email] as [string, string]),
];

export default function LoginPage() {
  const mock = isMockMode();
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <section className="flex flex-col justify-between bg-teal-800 px-6 py-8 text-white lg:px-12">
        {mock ? <MockNotice /> : <span />}
        <Logo variant="stacked" className="mx-auto mt-8 w-full max-w-sm" />
        <p className="mx-auto mt-6 max-w-sm text-center text-sm text-white/80">Portal de clientes de South Wind Global Services LLC.</p>
      </section>
      <section className="flex items-center px-4 py-10">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 lg:hidden">
            <Logo variant="horizontal" className="h-14 w-auto rounded-xl" />
          </div>
          <h1 className="font-display text-4xl">Ingresar</h1>
          <p className="mt-2 text-sm text-teal-900/70">Use el correo de su empresa. El equipo de South Wind ingresa con el perfil de administración.</p>
          <form action="/api/auth/login" method="post" className="mt-6 grid gap-3">
            <label><span className="label">Correo</span><input className="input" name="email" type="email" required /></label>
            <label><span className="label">Contraseña</span><input className="input" name="password" type="password" required /></label>
            <button className="btn-primary" type="submit">Entrar</button>
          </form>
          <p className="mt-4 text-sm">¿Aún no tiene cuenta? <a className="font-semibold text-teal-800" href="/abrir-cuenta">Abrir una</a></p>
          {mock ? (
            <div className="mt-8 rounded-3xl bg-white p-4 ring-1 ring-teal-100">
              <p className="text-sm font-semibold">Accesos de demostración</p>
              <p className="mt-1 text-xs text-teal-900/70">Contraseña: {DEMO_PASSWORD}</p>
              <div className="mt-3 grid gap-2">
                {demos.map(([label, email]) => (
                  <form key={email} action="/api/auth/login" method="post">
                    <input type="hidden" name="email" value={email} />
                    <input type="hidden" name="password" value={DEMO_PASSWORD} />
                    <button className="w-full rounded-2xl bg-teal-50 px-3 py-2 text-left text-sm hover:bg-teal-100" type="submit">
                      <span className="block font-semibold">{label}</span>
                      <span className="text-xs text-teal-900/70">{email}</span>
                    </button>
                  </form>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
