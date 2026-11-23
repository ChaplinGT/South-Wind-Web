import { InviteForm } from "@/components/forms";

export const metadata = { title: "Vincular cliente" };

export default function LinkCustomerPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-display text-4xl">Vincular un cliente existente</h1>
      <p className="text-sm leading-6 text-teal-950/75">
        Use esta pantalla para las empresas que ya están aprobadas en la cuenta de desarrollador de South Wind. El portal consulta el customer_id y no vuelve a pedir el KYB.
      </p>
      <InviteForm />
    </div>
  );
}
