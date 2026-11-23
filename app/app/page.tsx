import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatAmount, formatDateTime } from "@/lib/format";
import { getBridge } from "@/lib/bridge";
import { readUsdcBalance } from "@/lib/chains";
import { kindLabel, labelOf, transferStateLabel } from "@/lib/labels";
import { canTransact } from "@/lib/kyb";
import { bobReference, fxWithMarkup } from "@/lib/rates";
import { accountStatusLabel, depositSummary, isActiveVirtualAccount, missingReceiveCurrencies, openAccountHref } from "@/lib/receive-summary";
import { getBobMarkupPercent, getFxMarkupPercent } from "@/lib/settings";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inicio" };

export default async function DashboardPage() {
  const session = await requireUser();
  if (session.role !== "client") return null;
  const profiles = await prisma.company.findMany({
    where: { ownerUserId: session.sub },
    include: { externalWallets: true, virtualAccounts: true },
  });
  const ids = profiles.map((item) => item.id);
  const movements = ids.length
    ? await prisma.ledgerEntry.findMany({
        where: { companyId: { in: ids } },
        orderBy: { postedAt: "desc" },
        take: 20,
      })
    : [];
  const transfers = ids.length ? await prisma.transfer.findMany({ where: { companyId: { in: ids } } }) : [];
  const transferById = new Map(transfers.map((item) => [item.id, item]));
  const [bobMarkup, fxMarkup] = await Promise.all([getBobMarkupPercent(), getFxMarkupPercent()]);
  let bob: Awaited<ReturnType<typeof bobReference>> | null = null;
  try {
    bob = await bobReference(Number(bobMarkup));
  } catch {
    bob = null;
  }
  const fxCodes = ["eur", "gbp", "mxn", "brl", "cop"] as const;
  const fxQuotes = await Promise.all(
    fxCodes.map(async (code) => {
      try {
        const quote = await getBridge().getExchangeRate("usd", code);
        return { code, ...fxWithMarkup(quote.buy_rate ?? null, quote.sell_rate ?? null, Number(fxMarkup)), at: new Date().toISOString() };
      } catch {
        return { code, buy: null, sell: null, at: null as string | null };
      }
    }),
  );
  const balances = await Promise.all(
    profiles.flatMap((profile) => {
      const rows: Promise<{ label: string; text: string }>[] = [];
      if (profile.bridgeWalletId && profile.bridgeCustomerId) {
        rows.push(
          getBridge()
            .listWallets(profile.bridgeCustomerId)
            .then((wallets) => {
              const match = wallets.data.find((item) => item.id === profile.bridgeWalletId);
              const amount = match?.balances.find((item) => item.currency === "usdc")?.balance;
              return { label: `Billetera · ${profile.kind === "persona" ? "Persona" : "Empresa"}`, text: amount ? `${amount} USDC` : "Saldo no disponible" };
            })
            .catch(() => ({ label: `Billetera · ${profile.kind === "persona" ? "Persona" : "Empresa"}`, text: "Saldo no disponible" })),
        );
      }
      for (const wallet of profile.externalWallets) {
        rows.push(
          readUsdcBalance(wallet.network, wallet.address).then((result) => ({
            label: `${wallet.network} · ${wallet.address.slice(0, 8)}…`,
            text: result.available ? `${result.amount} USDC` : "Saldo no disponible",
          })),
        );
      }
      return rows;
    }),
  );
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Hola, {session.name.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-teal-900/70">Bienvenido a su cuenta. Desde aquí puede pagar, recibir y consultar sus movimientos.</p>
      </div>
      <section className="grid gap-4 md:grid-cols-2">
        <article className="card">
          <p className="text-xs uppercase tracking-wide text-teal-800">USDC / bolivianos</p>
          <p className="mt-1 text-xs text-teal-900/60">Cotización de referencia para sus operaciones.</p>
          <RateTable
            rows={[{ code: "BOB", buy: bob?.compra ?? null, sell: bob?.venta ?? null }]}
          />
          <p className="mt-2 text-xs text-teal-900/50">{bob ? `Actualizado ${formatDateTime(bob.at)}` : "Cotización no disponible en este momento."}</p>
        </article>
        <article className="card">
          <p className="text-xs uppercase tracking-wide text-teal-800">Otras monedas</p>
          <p className="mt-1 text-xs text-teal-900/60">Cotización de referencia.</p>
          <RateTable
            rows={fxQuotes.map((quote) => ({ code: quote.code.toUpperCase(), buy: quote.buy, sell: quote.sell }))}
          />
          <p className="mt-2 text-xs text-teal-900/50">{fxQuotes[0]?.at ? `Actualizado ${formatDateTime(fxQuotes[0].at)}` : "Sin cotización"}</p>
        </article>
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        {(profiles.length === 0 ? [null] : profiles).map((profile) => {
          const enabled = profile ? canTransact(profile.kybStatus) : false;
          const accounts = (profile?.virtualAccounts ?? []).filter((account) => isActiveVirtualAccount(account.status));
          const missing = missingReceiveCurrencies(accounts.map((account) => account.currency));
          const profileLabel = profile ? (profile.kind === "persona" ? "Persona" : "Empresa") : "";
          return (
            <div key={profile?.id ?? "nuevo"} className="contents">
              <article className="card flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-2xl">Pagos</h2>
                  <StatusBadge enabled={enabled} />
                </div>
                {profiles.length > 1 && profile ? <p className="text-sm font-medium text-teal-900/70">{profileLabel} · {profile.legalName}</p> : null}
                {enabled ? (
                  <Link className="btn-primary w-full sm:w-auto" href="/app/enviar">Enviar pago</Link>
                ) : (
                  <Link className="btn-primary w-full sm:w-auto" href="/app/servicios/pagos">Habilitar</Link>
                )}
              </article>
              <article className="card flex flex-col gap-3">
                <h2 className="font-display text-2xl">Cuentas receptoras</h2>
                {profiles.length > 1 && profile ? <p className="text-sm font-medium text-teal-900/70">{profileLabel} · {profile.legalName}</p> : null}
                {accounts.length === 0 ? <p className="text-sm text-teal-900/70">Aún no tiene una cuenta para recibir.</p> : null}
                <ul className="space-y-2">
                  {accounts.map((account) => {
                    const summary = depositSummary(account.instructionsJson, account.currency);
                    return (
                      <li key={account.id}>
                        <Link href={profile ? `/app/cuenta?perfil=${profile.id}` : "/app/cuenta"} className="block rounded-2xl border border-teal-100 px-3 py-3 hover:bg-teal-50">
                          <p className="font-semibold">{summary.currency} · {accountStatusLabel(account.status)}</p>
                          {summary.bankName ? <p className="mt-1 text-sm text-teal-900/80">{summary.bankName}</p> : null}
                          {summary.accountNumber ? <p className="text-sm tabular-nums tracking-wide">{summary.accountNumber}</p> : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {accounts.length === 0 ? (
                  <Link className="btn-primary w-full sm:w-auto" href={openAccountHref(profile?.id)}>Abrir cuenta</Link>
                ) : null}
                {accounts.length > 0 && missing.length > 0 ? (
                  <Link className="btn-secondary w-full sm:w-auto" href={openAccountHref(profile?.id)}>Abrir cuenta en otra moneda</Link>
                ) : null}
              </article>
            </div>
          );
        })}
      </section>
      <section className="overflow-hidden rounded-[2rem] bg-teal-800 px-6 py-6 text-white">
        <p className="text-sm text-white/70">Acciones</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-teal-900" href="/app/enviar">Enviar pago</Link>
          <Link className="rounded-full px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/40" href="/app/conversiones">Solicitar conversión</Link>
          <Link className="rounded-full px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/40" href="/app/cuenta">Ver cuenta virtual</Link>
        </div>
      </section>
      <section className="card">
        <h2 className="font-display text-2xl">Saldos</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {balances.length === 0 ? <li>El saldo aparecerá cuando tenga una billetera asociada.</li> : null}
          {balances.map((item) => <li key={item.label}><span className="font-semibold">{item.label}.</span> {item.text}</li>)}
        </ul>
      </section>
      <section className="card">
        <h2 className="font-display text-2xl">Últimos 20 movimientos</h2>
        <div className="mt-3 divide-y divide-teal-50">
          {movements.map((entry) => {
            const transfer = entry.transferId ? transferById.get(entry.transferId) : undefined;
            const hash = transfer ? txHash(transfer.responseJson) : null;
            return (
              <div key={entry.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="font-medium">{transfer?.beneficiaryName || entry.description}</p>
                  <p className="text-xs text-teal-900/60">{formatDateTime(entry.postedAt)} · {entry.reference} · {transfer ? labelOf(transferStateLabel, transfer.state) : labelOf(kindLabel, entry.kind)}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{entry.credit !== "0.00" ? formatAmount(entry.credit) : formatAmount(entry.debit)}</p>
                  {transfer ? <a className="text-xs font-semibold text-teal-800" href={`/api/comprobantes/pago/${transfer.id}`}>Comprobante</a> : null}
                  {hash ? <p className="text-xs break-all text-teal-900/60">{hash}</p> : null}
                </div>
              </div>
            );
          })}
          {movements.length === 0 ? <p className="py-3 text-sm text-teal-900/70">Cuando habilite un servicio, los movimientos aparecerán aquí.</p> : null}
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${enabled ? "bg-emerald-100 text-emerald-800" : "bg-teal-100 text-teal-800"}`}>
      {enabled ? "Habilitado" : "No habilitado"}
    </span>
  );
}

function RateTable({ rows }: { rows: { code: string; buy: number | null; sell: number | null }[] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[16rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-teal-200 text-left text-xs uppercase tracking-wide text-teal-800">
            <th className="py-2 pr-3 font-semibold">Moneda</th>
            <th className="py-2 pl-3 text-right font-semibold">Compra</th>
            <th className="py-2 pl-3 text-right font-semibold">Venta</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.code} className="border-b border-teal-100 last:border-b-0">
              <td className="py-2.5 pr-3 font-medium">{row.code}</td>
              <td className="py-2.5 pl-3 text-right tabular-nums">{formatRate(row.buy)}</td>
              <td className="py-2.5 pl-3 text-right tabular-nums">{formatRate(row.sell)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatRate(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "—" : value.toFixed(4);
}

function txHash(raw: string): string | null {
  try {
    const body = JSON.parse(raw) as { destination_tx_hash?: string; receipt?: { destination_tx_hash?: string } };
    return body.destination_tx_hash || body.receipt?.destination_tx_hash || null;
  } catch {
    return null;
  }
}
