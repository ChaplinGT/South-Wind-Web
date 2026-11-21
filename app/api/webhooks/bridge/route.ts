import { NextResponse } from "next/server";
import { normalizePem, verifyBridgeSignature } from "@/lib/bridge/webhook";
import { processBridgeWebhook } from "@/lib/services/webhooks";
import type { BridgeWebhookEvent } from "@/lib/bridge/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-webhook-signature");
  const verification = verifyBridgeSignature(raw, signature, normalizePem(process.env.BRIDGE_WEBHOOK_PUBLIC_KEY || ""));
  if (!verification.ok) {
    return NextResponse.json({ error: verification.error }, { status: 400 });
  }
  let event: BridgeWebhookEvent;
  try {
    event = JSON.parse(raw) as BridgeWebhookEvent;
  } catch {
    return NextResponse.json({ error: "El cuerpo del webhook no es JSON válido." }, { status: 400 });
  }
  const result = await processBridgeWebhook(event);
  return NextResponse.json({ ok: true, status: result.status });
}
