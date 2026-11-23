import Link from "next/link";
import { Logo } from "./logo";
import { legalEntity } from "@/lib/brand";

export function PublicHeader() {
  return (
    <header className="bg-teal-800">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="shrink-0">
          <Logo variant="horizontal" className="h-11 w-auto sm:h-14" />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link href="/ingresar" className="btn-ghost px-3 sm:px-5">
            Ingresar
          </Link>
          <Link href="/registro" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-teal-900">
            Crear cuenta
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="bg-teal-950 text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <Logo variant="horizontal" className="h-12 w-auto" />
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/75">
            {legalEntity.name}. {legalEntity.addressLines.join(" · ")}.
          </p>
        </div>
        <div className="text-sm leading-7 text-white/80">
          <p className="font-semibold text-white">Servicios</p>
          <p>Pagos a proveedores</p>
          <p>Recepción de dólares</p>
          <p>Solicitud de conversión USDC / bolivianos</p>
        </div>
        <div className="text-sm leading-7 text-white/80">
          <p className="font-semibold text-white">Aviso</p>
          <p>
            South Wind no es un banco. La conversión a bolivianos se atiende fuera de esta plataforma.
          </p>
        </div>
      </div>
    </footer>
  );
}

export function MockNotice({ children }: { children?: React.ReactNode }) {
  return (
    <div className="bg-gold-100 px-4 py-2 text-center text-sm text-gold-700">
      {children ?? "Modo demostración. Los saldos y los pagos son simulados: no se mueve dinero real."}
    </div>
  );
}
