import { FeeForm } from "@/components/forms";
import { getFeePercent } from "@/lib/settings";

export const metadata = { title: "Comisión" };

export default async function FeePage() {
  const feePercent = await getFeePercent();
  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl">Comisión South Wind</h1>
      <p className="max-w-2xl text-sm leading-6 text-teal-950/75">
        Porcentaje que se muestra al cliente y se envía a Bridge como <span className="font-semibold">developer_fee</span> al crear una transferencia. El valor inicial es un marcador de posición.
      </p>
      <FeeForm feePercent={feePercent} />
    </div>
  );
}
