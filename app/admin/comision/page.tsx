import { WalletAddressForm } from "@/components/forms";
import { PricingAdminForm } from "@/components/pricing-admin";
import { MARGIN_REFERENCE_USD, marginSummary } from "@/lib/pricing";
import { getPricing, getSouthWindWallet } from "@/lib/settings";

export const metadata = { title: "Comisión" };

export default async function FeePage() {
  const chains = ["base", "ethereum", "polygon", "arbitrum", "solana", "tron"];
  const [pricing, ...addresses] = await Promise.all([
    getPricing(),
    ...chains.map((chain) => getSouthWindWallet(chain)),
  ]);
  const margins = marginSummary(pricing);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Comisión y márgenes</h1>
        <p className="max-w-2xl text-sm leading-6 text-teal-950/75">
          Estas tarifas las lee el portal al cobrar y al mostrar el desglose. Cada cambio queda en la auditoría con quién y cuándo. Guardar también actualiza en Bridge las cuentas virtuales y las direcciones de liquidación ya creadas. Si un deploy anterior dejó la recepción en 0,50 %, cámbiela aquí a 1,25 %: el seed no pisa un valor que ya está guardado.
        </p>
      </div>
      <section className="card max-w-3xl space-y-3">
        <h2 className="font-display text-2xl">Margen bruto estimado</h2>
        <p className="text-sm text-teal-900/70">
          Sobre un movimiento de referencia de USD {MARGIN_REFERENCE_USD}. Cada fila es independiente. El costo de la cuenta virtual y el de KYC o KYB no entran en el porcentaje: son cargos de cuenta o anuales.
        </p>
        <ul className="space-y-3 text-sm">
          {margins.map((row) => (
            <li key={row.route}>
              <p className="font-semibold">{row.route} · {row.grossMarginPercent} %</p>
              <p className="text-teal-900/70">{row.detail}</p>
            </li>
          ))}
        </ul>
        <p className="text-xs leading-5 text-teal-900/60">
          Cuenta virtual: USD {pricing.bridgeVaAccountFeeUsd} en USD, GBP y EUR; USD {pricing.bridgeVaAccountFeeMxn} en MXN; USD {pricing.bridgeVaAccountFeeBrlCop} en BRL y COP.
          KYC USD {pricing.bridgeKycUsdYear} al año. KYB USD {pricing.bridgeKybUsdYear} al año. Billetera USD {pricing.bridgeWalletFeeUsd} por el costo de contrato, ya restado en la fila de envío desde billetera.
        </p>
      </section>
      <PricingAdminForm values={{ ...pricing, feeConfigEnabled: pricing.feeConfigEnabled ? "true" : "false" }} />
      <WalletAddressForm wallets={chains.map((chain, index) => ({ chain, address: addresses[index] || "" }))} />
    </div>
  );
}
