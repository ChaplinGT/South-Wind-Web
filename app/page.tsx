import Link from "next/link";
import { Logo } from "@/components/logo";
import { MockNotice, PublicFooter, PublicHeader } from "@/components/site";
import { isMockMode } from "@/lib/env";

const services = [
  {
    index: "01",
    title: "Importadores",
    text: "Pague a sus proveedores desde su cuenta: ACH y wire en Estados Unidos, SEPA en Europa, SPEI en México, Pix en Brasil y Faster Payments en el Reino Unido.",
  },
  {
    index: "02",
    title: "Empresas con cuenta en EE.UU.",
    text: "Si ya tiene una cuenta americana, solicite la conversión de bolivianos a dólares y recíbalos en esa cuenta propia.",
  },
  {
    index: "03",
    title: "Exportadores",
    text: "Reciba dólares del exterior en una cuenta virtual. Los fondos se acreditan en USDC y, cuando usted lo pida, se convierten a bolivianos.",
  },
];

export default function HomePage() {
  const mock = isMockMode();
  return (
    <div>
      {mock ? <MockNotice /> : null}
      <PublicHeader />
      <main>
        <section className="bg-teal-800 text-white">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 lg:grid-cols-[1.15fr_0.85fr] lg:py-20">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">Empresas bolivianas · pagos al mundo</p>
              <h1 className="mt-4 font-display text-4xl leading-tight sm:text-6xl">Su empresa, con la claridad de un banco amigo.</h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-white/85">
                South Wind acompaña a importadores, exportadores y pymes para cobrar y pagar en el exterior. Usted opera en este portal; nosotros hablamos con Bridge.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-teal-900" href="/abrir-cuenta">Abrir una cuenta</Link>
                <Link className="rounded-full px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/40" href="/ingresar">Ya soy cliente</Link>
              </div>
            </div>
            <div className="rounded-[2rem] bg-white p-6 text-ink shadow-card">
              <div className="flex items-center justify-between">
                <Logo variant="markOnLight" className="h-12 w-12" />
                <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-900">Ejemplo ilustrativo</span>
              </div>
              <p className="mt-8 text-sm text-teal-900/70">Saldo disponible</p>
              <p className="font-display text-4xl text-teal-900">18.450,00 USDC</p>
              <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-teal-50 p-3"><p className="text-teal-900/60">Cuenta virtual</p><p className="font-semibold">USD · ACH y wire</p></div>
                <div className="rounded-2xl bg-teal-50 p-3"><p className="text-teal-900/60">Conversión</p><p className="font-semibold">Solicitud a bolivianos</p></div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="font-display text-3xl sm:text-4xl">Tres formas de trabajar con nosotros</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {services.map((service) => (
              <article key={service.index} className="card">
                <div className="flex items-center justify-between">
                  <Logo variant="markOnLight" className="h-10 w-10" />
                  <span className="font-display text-2xl text-teal-800/50">{service.index}</span>
                </div>
                <h3 className="mt-4 font-display text-2xl">{service.title}</h3>
                <p className="mt-2 text-sm leading-6 text-teal-950/75">{service.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-3">
            {[
              ["1", "Abra su cuenta", "Registre su empresa. Si ya es cliente de Bridge con South Wind, lo vinculamos sin repetir el KYB. Si es nuevo, completa la verificación en el enlace de Bridge."],
              ["2", "Mueva dólares", "Reciba en su cuenta virtual o envíe a un beneficiario, con la comisión a la vista antes de confirmar."],
              ["3", "Pida bolivianos", "La conversión USDC ↔ bolivianos la atiende un PSAV licenciado en Bolivia. Usted deja la solicitud; nosotros le informamos el estado."],
            ].map(([step, title, text]) => (
              <div key={step}>
                <p className="font-display text-4xl text-teal-800">{step}</p>
                <h3 className="mt-2 text-xl font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-teal-950/75">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="rounded-[2rem] bg-teal-900 px-6 py-10 text-white sm:px-10">
            <h2 className="font-display text-3xl">Hecho para presentarse con formalidad</h2>
            <p className="mt-3 max-w-2xl text-white/80">Extractos de cuenta con saldo inicial y final, comprobantes por operación y un código para verificar que el documento salió de South Wind.</p>
            <Link className="mt-6 inline-flex rounded-full bg-white px-5 py-3 text-sm font-semibold text-teal-900" href="/abrir-cuenta">Empezar</Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
