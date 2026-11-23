import { GoogleButton, RegisterForm } from "@/components/forms";
import { AuthPanel, AuthSwitch } from "@/components/auth-panel";
import { googleEnabled } from "@/lib/google";

export const metadata = { title: "Crear cuenta" };

export default function RegisterPage() {
  return (
    <AuthPanel
      title="Crear cuenta"
      lede="Solo nombre, correo, teléfono y contraseña. Esto crea su usuario de South Wind, no un cliente en Bridge. La verificación empieza cuando habilita un servicio."
    >
      {googleEnabled() ? <div className="mt-4"><GoogleButton /></div> : null}
      <div className="mt-6">
        <RegisterForm />
      </div>
      <AuthSwitch prompt="¿Ya tienes cuenta?" href="/ingresar" label="Ingresar" />
    </AuthPanel>
  );
}
