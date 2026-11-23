"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "./ui";

export function EnableServiceForm() {
  const [kind, setKind] = useState("persona");
  const [funding, setFunding] = useState("bridge_wallet");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const router = useRouter();
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch("/api/servicios/habilitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = (await response.json()) as { error?: string; url?: string };
      if (!response.ok) throw new Error(body.error || "No se pudo habilitar el servicio.");
      setLink(body.url || null);
      router.refresh();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={onSubmit} className="card grid gap-3">
      {error ? <Alert tone="bad">{error}</Alert> : null}
      {link ? <Alert>Continúe la verificación de Bridge: <a className="font-semibold" href={link}>abrir enlace</a></Alert> : null}
      <label><span className="label">Perfil</span>
        <select className="input" name="kind" value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="persona">Persona</option>
          <option value="empresa">Empresa</option>
        </select>
      </label>
      {kind === "empresa" ? (
        <>
          <label><span className="label">Razón social</span><input className="input" name="legalName" required /></label>
          <label><span className="label">Nombre comercial</span><input className="input" name="tradeName" /></label>
          <label><span className="label">NIT</span><input className="input" name="nit" required /></label>
          <label><span className="label">Ciudad</span><input className="input" name="city" /></label>
          <label><span className="label">Dirección</span><input className="input" name="addressLine" /></label>
          <label><span className="label">Tipo</span>
            <select className="input" name="clientType">
              <option value="importador">Importador</option>
              <option value="cuenta_eeuu">Cuenta en EE.UU.</option>
              <option value="exportador">Exportador</option>
            </select>
          </label>
        </>
      ) : null}
      <label><span className="label">Cómo fondea los pagos</span>
        <select className="input" name="funding" value={funding} onChange={(event) => setFunding(event.target.value)}>
          <option value="bridge_wallet">Crear una billetera Bridge</option>
          <option value="external">Enviar USDC desde una billetera externa</option>
        </select>
      </label>
      {funding === "external" ? (
        <>
          <label><span className="label">Red</span>
            <select className="input" name="network">
              {["ethereum", "polygon", "base", "arbitrum", "solana", "tron"].map((network) => <option key={network}>{network}</option>)}
            </select>
          </label>
          <label><span className="label">Dirección</span><input className="input" name="address" placeholder="0x… o dirección de la red" /></label>
        </>
      ) : null}
      <button className="btn-primary" disabled={pending} type="submit">{pending ? "Creando…" : "Empezar verificación"}</button>
    </form>
  );
}

export function ReceiveAccountForm({
  profiles,
}: {
  profiles: { id: string; label: string; wallets: { id: string; label: string }[] }[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/servicios/cuenta-virtual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "No se pudo abrir la cuenta.");
      router.refresh();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={onSubmit} className="card grid gap-3">
      {error ? <Alert tone="bad">{error}</Alert> : null}
      <label><span className="label">Perfil Bridge</span>
        <select className="input" name="companyId">{profiles.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
      </label>
      <label><span className="label">Moneda de recepción</span>
        <select className="input" name="currency">
          <option value="usd">USD · ACH</option>
          <option value="eur">EUR · SEPA</option>
          <option value="brl">BRL · Pix</option>
          <option value="mxn">MXN · SPEI</option>
        </select>
      </label>
      <label><span className="label">Destino del USDC</span>
        <select className="input" name="destination">
          <option value="southwind">South Wind liquida en bolivianos</option>
          <option value="bridge_wallet">Mi billetera Bridge</option>
          <option value="external">Mi billetera externa registrada</option>
        </select>
      </label>
      <label><span className="label">Red, si liquida South Wind</span>
        <select className="input" name="chain" defaultValue="base">
          {["base", "ethereum", "polygon", "arbitrum", "solana"].map((chain) => <option key={chain}>{chain}</option>)}
        </select>
      </label>
      <label><span className="label">Billetera externa</span>
        <select className="input" name="externalWalletId">
          <option value="">—</option>
          {profiles.flatMap((item) => item.wallets).map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.label}</option>)}
        </select>
      </label>
      <button className="btn-primary" disabled={pending || profiles.length === 0} type="submit">Abrir cuenta virtual</button>
    </form>
  );
}
