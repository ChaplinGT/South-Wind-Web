import { GoogleButton } from "@/components/forms";
import { AuthPanel, AuthSwitch } from "@/components/auth-panel";
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
    <AuthPanel
      title="Ingresar"
      lede="Entre con su usuario de South Wind. Esto no abre una cuenta en Bridge."
    >
      {googleEnabled() ? <div className="mt-4"><GoogleButton /></div> : null}
      <form action="/api/auth/login" method="post" className="mt-6 grid gap-3">
        <label><span className="label">Correo</span><input className="input" name="email" type="email" autoComplete="email" required /></label>
        <label><span className="label">Contraseña</span><input className="input" name="password" type="password" autoComplete="current-password" required /></label>
        <button className="btn-primary" type="submit">Entrar</button>
      </form>
      <AuthSwitch prompt="¿No tienes cuenta?" href="/registro" label="Crear cuenta" />
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
    </AuthPanel>
  );
}
