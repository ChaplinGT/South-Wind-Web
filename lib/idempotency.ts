import { createHash } from "crypto";
import { prisma } from "./db";
import { AppError } from "./errors";

export function hashRequest(body: unknown): string {
  return createHash("sha256").update(stableStringify(body)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

export type IdempotencyStart =
  | { kind: "start" }
  | { kind: "replay"; statusCode: number; body: unknown }
  | { kind: "conflict" }
  | { kind: "processing" };

export async function beginIdempotency(key: string, requestHash: string): Promise<IdempotencyStart> {
  const existing = await prisma.idempotencyRecord.findUnique({ where: { key } });
  if (!existing) {
    try {
      await prisma.idempotencyRecord.create({
        data: { key, requestHash, statusCode: 0, responseJson: "{}", state: "processing" },
      });
      return { kind: "start" };
    } catch {
      const again = await prisma.idempotencyRecord.findUnique({ where: { key } });
      if (!again) throw new AppError("No se pudo registrar la operación. Intente de nuevo.", 409);
      return classify(again, requestHash);
    }
  }
  return classify(existing, requestHash);
}

function classify(
  existing: { requestHash: string; state: string; statusCode: number; responseJson: string },
  requestHash: string,
): IdempotencyStart {
  if (existing.requestHash !== requestHash) return { kind: "conflict" };
  if (existing.state === "done") {
    return { kind: "replay", statusCode: existing.statusCode, body: JSON.parse(existing.responseJson) };
  }
  return { kind: "processing" };
}

export async function finishIdempotency(key: string, statusCode: number, body: unknown) {
  await prisma.idempotencyRecord.update({
    where: { key },
    data: { statusCode, responseJson: JSON.stringify(body), state: "done" },
  });
}

export function assertIdempotency(result: IdempotencyStart) {
  if (result.kind === "conflict") {
    throw new AppError("Esta operación no coincide con un envío anterior. Vuelva a intentarlo.", 409);
  }
  if (result.kind === "processing") {
    throw new AppError("Esta operación ya se está procesando. Espere un momento y no la reenvíe.", 409);
  }
}
