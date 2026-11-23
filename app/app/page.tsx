import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatAmount, formatDateTime } from "@/lib/format";
import { getBridge } from "@/lib/bridge";
import { readUsdcBalance } from "@/lib/chains";
import { kybLabel, kindLabel, labelOf, transferStateLabel } from "@/lib/labels";
import { bobReference, fxWithMarkup } from "@/lib/rates";
import { getBobMarkupPercent, getFxMarkupPercent } from "@/lib/settings";
import { railsFromEndorsements } from "@/lib/service-rails";
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
  const railNotes = await Promise.all(
    profiles.map(async (profile) => {
      if (!profile.bridgeCustomerId) return { id: profile.id, rails: [] as string[] };
      try {
        const remote = await getBridge().getCustomer(profile.bridgeCustomerId);
        return { id: profile.id, rails: railsFromEndorsements(remote.endorsements) };
      } catch {
        return { id: profile.id, rails: [] as string[] };
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
          <p className="text-xs uppercase tracking-wide text-teal-800">Tipo de cambio USDC / bolivianos</p>
          <p className="mt-1 text-xs text-teal-900/60">Cotización de referencia para sus operaciones.</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div><p className="text-sm text-teal-900/60">Compra</p><p className="font-display text-3xl">{bob?.compra ? bob.compra.toFixed(2) : "—"}</p></div>
            <div><p className="text-sm text-teal-900/60">Venta</p><p className="font-display text-3xl">{bob?.venta ? bob.venta.toFixed(2) : "—"}</p></div>
          </div>
          <p className="mt-2 text-xs text-teal-900/50">{bob ? `Actualizado ${formatDateTime(bob.at)}` : "Cotización no disponible en este momento."}</p>
        </article>
        <article className="card">
          <p className="text-xs uppercase tracking-wide text-teal-800">Otras monedas</p>
          <p className="mt-1 text-xs text-teal-900/60">EUR, GBP, MXN, BRL y COP. Cotización de referencia.</p>
          <ul className="mt-3 space-y-2 text-sm">
            {fxQuotes.map((quote) => (
              <li key={quote.code} className="flex justify-between gap-3">
                <span className="font-semibold">{quote.code.toUpperCase()}</span>
                <span>Compra {quote.buy ? quote.buy.toFixed(4) : "—"} · Venta {quote.sell ? quote.sell.toFixed(4) : "—"}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-teal-900/50">{fxQuotes[0]?.at ? `Actualizado ${formatDateTime(fxQuotes[0].at)}` : "Sin cotización"}</p>
        </article>
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <article className="card space-y-3">
          <h2 className="font-display text-2xl">Pagos transfronterizos</h2>
          {profiles.length === 0 ? <p className="text-sm">Todavía no hay un perfil de persona ni de empresa.</p> : null}
          {profiles.map((profile) => {
            const rails = railNotes.find((item) => item.id === profile.id)?.rails ?? [];
            return (
              <div key={profile.id}>
                <p className="font-semibold">{profile.kind === "persona" ? "Persona" : "Empresa"} · {profile.legalName}</p>
                <p className="text-sm text-teal-900/70">{rails.length ? rails.join(" · ") : "Sin vías de pago habilitadas"} · verificación {labelOf(kybLabel, profile.kybStatus)}</p>
              </div>
            );
          })}
          <Link className="btn-primary" href="/app/servicios/pagos">Habilitar o continuar</Link>
        </article>
        <article className="card space-y-3">
          <h2 className="font-display text-2xl">Remesas transfronterizas</h2>
          <p className="text-sm text-teal-900/70">Reciba dólares, euros y otras monedas, y acredítelos en USDC.</p>
          {profiles.flatMap((profile) => profile.virtualAccounts).map((account) => (
            <p key={account.id} className="text-sm">{account.currency.toUpperCase()} · {account.status}</p>
          ))}
          <Link className="btn-secondary" href="/app/servicios/remesas">Abrir cuenta virtual</Link>
        </article>
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

function txHash(raw: string): string | null {
  try {
    const body = JSON.parse(raw) as { destination_tx_hash?: string; receipt?: { destination_tx_hash?: string } };
    return body.destination_tx_hash || body.receipt?.destination_tx_hash || null;
  } catch {
    return null;
  }
}
