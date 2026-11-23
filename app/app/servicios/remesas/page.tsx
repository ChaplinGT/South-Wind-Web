import { BobAccountForm } from "@/components/forms";
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
        Puede pedir que South Wind liquide el USDC en bolivianos (el destino es la billetera de South Wind y el abono va a su banco en Bolivia) o que Bridge deposite el USDC en su propia billetera.
      </p>
      <section className="card">
        <h2 className="font-display text-2xl">Cuenta en Bolivia</h2>
        <BobAccountForm />
      </section>
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
