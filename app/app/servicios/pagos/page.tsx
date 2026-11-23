import { EnableServiceForm } from "@/components/service-forms";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Habilitar pagos" };

export default async function EnablePaymentsPage() {
  const session = await requireUser();
  if (session.role !== "client") return null;
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="font-display text-4xl">Habilitar pagos</h1>
      <p className="text-sm leading-6 text-teal-950/75">
        Elija si opera como persona o como empresa. Luego complete la verificación e indique si fondea con la billetera de su cuenta o con una dirección propia.
      </p>
      <EnableServiceForm />
    </div>
  );
}
