import { GoogleButton } from "@/components/forms";
import { AuthPanel, AuthSwitch } from "@/components/auth-panel";
import { googleEnabled } from "@/lib/google";

export const metadata = { title: "Ingresar" };

export default function LoginPage() {
  return (
    <AuthPanel
      title="Ingresar"
      lede="Entre con su correo y contraseña."
    >
      {googleEnabled() ? <div className="mt-4"><GoogleButton /></div> : null}
      <form action="/api/auth/login" method="post" className="mt-6 grid gap-3">
        <label><span className="label">Correo</span><input className="input" name="email" type="email" autoComplete="email" required /></label>
        <label><span className="label">Contraseña</span><input className="input" name="password" type="password" autoComplete="current-password" required /></label>
        <button className="btn-primary" type="submit">Entrar</button>
      </form>
      <AuthSwitch prompt="¿No tienes cuenta?" href="/registro" label="Crear cuenta" />
    </AuthPanel>
  );
}
