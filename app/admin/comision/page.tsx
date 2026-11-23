import { FeeForm, MarkupForm } from "@/components/forms";
import { getBobMarkupPercent, getFeePercent, getFxMarkupPercent } from "@/lib/settings";

export const metadata = { title: "Comisión" };

export default async function FeePage() {
  const [feePercent, bob, fx] = await Promise.all([getFeePercent(), getBobMarkupPercent(), getFxMarkupPercent()]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Comisión y márgenes</h1>
        <p className="max-w-2xl text-sm leading-6 text-teal-950/75">
          La comisión de pagos se envía a Bridge como developer_fee. Los márgenes de tipo de cambio los lee el panel del cliente. Cada cambio queda en la auditoría con quién y cuándo.
        </p>
      </div>
      <FeeForm feePercent={feePercent} />
      <MarkupForm bob={bob} fx={fx} />
    </div>
  );
}
