import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-4 py-20 text-center">
      <Logo variant="mark" className="mx-auto h-16 w-16 rounded-2xl" />
      <h1 className="mt-6 font-display text-4xl">No encontramos esta página</h1>
      <p className="mt-2 text-sm text-teal-900/70">El enlace puede estar incompleto o el documento no existe.</p>
      <Link className="btn-primary mt-6" href="/">Volver al inicio</Link>
    </main>
  );
}
