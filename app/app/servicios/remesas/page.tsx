import { ReceiveAccountForm } from "@/components/service-forms";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Recibir" };

export default async function RemittancesPage() {
  const session = await requireUser();
  const profiles = await prisma.company.findMany({
    where: { ownerUserId: session.sub, bridgeCustomerId: { not: null } },
    include: { externalWallets: true },
  });
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="font-display text-4xl">Recibir del exterior</h1>
      <p className="text-sm leading-6 text-teal-950/75">
        Cada cuenta virtual queda ligada a una billetera USDC, de Bridge o una dirección que usted registró. Bridge deposita ahí el USDC convertido.
      </p>
      <ReceiveAccountForm
        profiles={profiles.map((item) => ({
          id: item.id,
          label: `${item.kind === "persona" ? "Persona" : "Empresa"} · ${item.legalName}`,
          wallets: item.externalWallets.map((wallet) => ({ id: wallet.id, label: `${wallet.network} · ${wallet.address.slice(0, 10)}` })),
        }))}
      />
    </div>
  );
}
