import { GoogleButton, RegisterForm } from "@/components/forms";
import { AuthPanel, AuthSwitch } from "@/components/auth-panel";
import { googleEnabled } from "@/lib/google";

export const metadata = { title: "Crear cuenta" };

export default function RegisterPage() {
  return (
    <AuthPanel
      title="Crear cuenta"
      lede="Indique su nombre, correo, teléfono y contraseña para abrir su cuenta."
    >
      {googleEnabled() ? <div className="mt-4"><GoogleButton /></div> : null}
      <div className="mt-6">
        <RegisterForm />
      </div>
      <AuthSwitch prompt="¿Ya tienes cuenta?" href="/ingresar" label="Ingresar" />
    </AuthPanel>
  );
}
