import { createHash, createVerify } from "crypto";

export type SignatureResult = { ok: true } | { ok: false; error: string };

/**
 * Bridge firma SHA256(SHA256(`${timestamp}.${rawBody}`)) con RSA.
 * `crypto.verify` vuelve a hashear el mensaje, así que se le entrega el primer digest.
 * Formato del encabezado: `t=<ms>,v0=<firma base64>`.
 */
export function verifyBridgeSignature(
  rawBody: string | Buffer,
  signatureHeader: string | null | undefined,
  publicKeyPem: string,
  nowMs = Date.now(),
  toleranceMs = 10 * 60 * 1000,
): SignatureResult {
  if (!signatureHeader) return { ok: false, error: "Falta la firma del webhook." };
  if (!publicKeyPem.trim()) return { ok: false, error: "No está configurada la clave pública del webhook." };

  const parts: Record<string, string> = {};
  for (const part of signatureHeader.split(",")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    parts[part.slice(0, index).trim()] = part.slice(index + 1).trim();
  }
  const timestamp = parts.t;
  const signature = parts.v0;
  if (!timestamp || !signature) return { ok: false, error: "La firma del webhook está incompleta." };

  const stamp = Number(timestamp);
  if (!Number.isFinite(stamp)) return { ok: false, error: "La marca de tiempo del webhook no es válida." };
  if (Math.abs(nowMs - stamp) > toleranceMs) {
    return { ok: false, error: "El webhook está vencido. Se rechaza para evitar un reenvío tardío." };
  }

  const payload = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
  const digest = createHash("sha256").update(`${timestamp}.${payload}`).digest();
  try {
    const verifier = createVerify("SHA256");
    verifier.update(digest);
    verifier.end();
    const valid = verifier.verify(normalizePem(publicKeyPem), signature, "base64");
    return valid ? { ok: true } : { ok: false, error: "La firma del webhook no es válida." };
  } catch {
    return { ok: false, error: "No se pudo verificar la firma del webhook." };
  }
}

export function normalizePem(value: string): string {
  return value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
}

export function summarizeCustomers(body: { count?: number; data?: { status?: string | null }[] | null }) {
  const data = body.data ?? [];
  const statuses: Record<string, number> = {};
  for (const customer of data) {
    const status = customer.status || "sin_estado";
    statuses[status] = (statuses[status] ?? 0) + 1;
  }
  return { count: body.count ?? data.length, returned: data.length, statuses };
}
