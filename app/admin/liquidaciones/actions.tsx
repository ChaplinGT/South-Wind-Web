"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LiquidacionActions({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await fetch(`/api/admin/liquidaciones/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(body.error || "No se pudo actualizar.");
      return;
    }
    router.refresh();
  }
  return (
    <form onSubmit={onSubmit} className="mt-3 grid gap-2 sm:grid-cols-2">
      {error ? <p className="text-sm text-rose-700 sm:col-span-2">{error}</p> : null}
      <select className="input" name="status" defaultValue="en_proceso">
        <option value="pendiente">Pendiente</option>
        <option value="en_proceso">En proceso</option>
        <option value="pagado">Pagado</option>
      </select>
      <input className="input" name="reference" placeholder="Referencia del abono" />
      <input className="input sm:col-span-2" name="adminNote" placeholder="Nota" />
      <button className="btn-primary" type="submit">Actualizar liquidación</button>
    </form>
  );
}
