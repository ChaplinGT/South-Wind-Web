import { ReceiveAccountForm } from "@/components/service-forms";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { missingReceiveCurrencies, RECEIVE_CURRENCY_LABELS } from "@/lib/receive-summary";
import { getPricing } from "@/lib/settings";
import { requireClient } from "@/lib/session";

export const metadata = { title: "Cuenta virtual" };

type Instructions = {
  source_deposit_instructions?: {
    currency?: string;
    payment_rails?: string[];
    bank_name?: string;
    bank_address?: string;
    bank_beneficiary_name?: string;
    bank_beneficiary_address?: string;
    bank_account_number?: string;
    bank_routing_number?: string;
  };
  destination?: { currency?: string; payment_rail?: string; address?: string };
  status?: string;
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ perfil?: string }> }) {
  const session = await requireClient();
  const { perfil } = await searchParams;
  const requestedId = perfil || session.companyId;
  const include = { externalWallets: true, virtualAccounts: { orderBy: { createdAt: "desc" as const } } };
  const company =
    (await prisma.company.findFirst({
      where: {
        id: requestedId,
        OR: [{ ownerUserId: session.sub }, { id: session.companyId }],
      },
      include,
    })) ??
    (await prisma.company.findFirst({
      where: { id: session.companyId },
      include,
    }));
  if (!company) throw new AppError("No encontramos la empresa.", 404);
  const accounts = company.virtualAccounts;
  const wallets = company.externalWallets;
  const account = accounts[0];
  const pricing = await getPricing();
  const instructions = account ? (JSON.parse(account.instructionsJson) as Instructions) : null;
  const deposit = instructions?.source_deposit_instructions;
  const rows = deposit
    ? [
        ["Moneda", (deposit.currency || "usd").toUpperCase()],
        ["Rieles", (deposit.payment_rails || []).join(", ")],
        ["Banco", deposit.bank_name || "—"],
        ["Dirección del banco", deposit.bank_address || "—"],
        ["Beneficiario", deposit.bank_beneficiary_name || company.legalName],
        ["Dirección del beneficiario", deposit.bank_beneficiary_address || "—"],
        ["Número de cuenta", deposit.bank_account_number || "—"],
        ["Routing", deposit.bank_routing_number || "—"],
      ]
    : [];
  const missing = missingReceiveCurrencies(accounts.filter((item) => item.status !== "deactivated").map((item) => item.currency));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Cuenta virtual</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-teal-950/75">
          Comparta estos datos con quien le va a pagar. El depósito se acredita en USDC.
        </p>
      </div>
      {!account || !deposit ? (
        <div className="card text-sm">La cuenta virtual se habilita cuando la verificación queda aprobada.</div>
      ) : (
        <section className="card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-2xl">Instrucciones de depósito</h2>
            <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-900">{account.status}</span>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs uppercase tracking-wide text-teal-900/50">{label}</dt>
                <dd className="mt-1 break-all font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm leading-6 text-teal-900/75">
            Comisión: {pricing.vaDeveloperFeePercent} % de cada depósito.
            {account.feeMode === "fee_config" || account.destinationMode === "southwind"
              ? ` Cargo fijo: USD ${pricing.fixedReceiveFeeUsd} por depósito.`
              : " Los depósitos a su billetera no tienen cargo fijo."}
            {account.destinationMode === "southwind" ? " Si liquida en bolivianos, el tipo de cambio se confirma al abonar." : ""}
          </p>
          {company.walletAddress ? (
            <p className="mt-6 text-sm text-teal-900/70">
              Copie esta dirección para recibir USDC{instructions?.destination?.payment_rail ? ` · ${instructions.destination.payment_rail}` : ""} · {company.walletAddress}
            </p>
          ) : null}
        </section>
      )}
      <section id="abrir-cuenta" className="scroll-mt-24 space-y-3">
        <h2 className="font-display text-3xl">Abrir nueva cuenta</h2>
        {missing.length === 0 ? (
          <p className="text-sm text-teal-900/70">Ya tiene una cuenta en cada moneda disponible.</p>
        ) : (
          <ReceiveAccountForm
            feePercent={pricing.vaDeveloperFeePercent}
            fixedFeeUsd={pricing.fixedReceiveFeeUsd}
            feeConfigEnabled={pricing.feeConfigEnabled}
            currencies={missing.map((code) => ({ value: code, label: RECEIVE_CURRENCY_LABELS[code] }))}
            profiles={[
              {
                id: company.id,
                label: `${company.kind === "persona" ? "Persona" : "Empresa"} · ${company.legalName}`,
                wallets: wallets.map((wallet) => ({ id: wallet.id, label: `${wallet.network} · ${wallet.address.slice(0, 10)}` })),
              },
            ]}
          />
        )}
      </section>
    </div>
  );
}
