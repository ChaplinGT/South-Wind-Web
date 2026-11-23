import { GoogleButton, RegisterForm } from "@/components/forms";
import { Logo } from "@/components/logo";
import { MockNotice } from "@/components/site";
import { DEMO_PASSWORD, demoCompanies } from "@/lib/demo-data";
import { isMockMode } from "@/lib/env";
import { googleEnabled } from "@/lib/google";

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
          <h1 className="font-display text-4xl">Cuenta South Wind</h1>
          <p className="mt-2 text-sm leading-6 text-teal-900/70">
            Aquí entra o crea su usuario de South Wind. Esto no abre una cuenta en Bridge. La verificación de persona o empresa empieza cuando habilita un servicio.
          </p>
          {googleEnabled() ? <div className="mt-4"><GoogleButton /></div> : null}
          <form action="/api/auth/login" method="post" className="mt-6 grid gap-3">
            <label><span className="label">Correo</span><input className="input" name="email" type="email" required /></label>
            <label><span className="label">Contraseña</span><input className="input" name="password" type="password" required /></label>
            <button className="btn-primary" type="submit">Entrar</button>
          </form>
          <div id="crear" className="mt-8 border-t border-teal-100 pt-6">
            <h2 className="font-display text-2xl">Crear cuenta South Wind</h2>
            <p className="mt-1 mb-4 text-sm text-teal-900/70">Solo nombre, correo, teléfono y contraseña. Cualquier correo sirve.</p>
            <RegisterForm />
          </div>
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
