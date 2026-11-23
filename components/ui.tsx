import { kybLabel, transferStateLabel, conversionStatusLabel, labelOf } from "@/lib/labels";

export function Pill({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "ok" | "wait" | "bad" | "info";
}) {
  const tones = {
    ok: "bg-emerald-50 text-emerald-800 ring-emerald-100",
    wait: "bg-amber-50 text-amber-800 ring-amber-100",
    bad: "bg-rose-50 text-rose-800 ring-rose-100",
    info: "bg-teal-100 text-teal-900 ring-teal-200",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function kybTone(status: string): "ok" | "wait" | "bad" | "info" {
  if (status === "approved") return "ok";
  if (status === "rejected") return "bad";
  if (status === "under_review" || status === "pending" || status === "incomplete" || status === "restricted") return "wait";
  return "info";
}

export function KybPill({ status }: { status: string }) {
  return <Pill tone={kybTone(status)}>{labelOf(kybLabel, status)}</Pill>;
}

export function stateTone(state: string): "ok" | "wait" | "bad" | "info" {
  if (state === "payment_processed" || state === "pagado" || state === "acreditado") return "ok";
  if (["canceled", "cancelled", "returned", "refunded", "undeliverable", "error", "rejected"].includes(state)) return "bad";
  if (state === "pendiente" || state === "en_proceso" || state === "payment_submitted" || state === "in_review" || state === "awaiting_funds" || state === "funds_received") return "wait";
  return "info";
}

export function TransferPill({ state }: { state: string }) {
  return <Pill tone={stateTone(state)}>{labelOf(transferStateLabel, state)}</Pill>;
}

export function ConversionPill({ status }: { status: string }) {
  return <Pill tone={stateTone(status)}>{labelOf(conversionStatusLabel, status)}</Pill>;
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="error-text">{message}</p>;
}

export function Alert({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" | "bad" }) {
  const tones = {
    info: "bg-teal-100 text-teal-950",
    warn: "bg-amber-50 text-amber-950",
    bad: "bg-rose-50 text-rose-900",
  };
  return <div className={`rounded-2xl px-4 py-3 text-sm ${tones[tone]}`}>{children}</div>;
}
