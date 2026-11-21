import { isMockMode, bridgeBaseUrl } from "../env";
import { BridgeError } from "./errors";
import { BridgeHttpClient } from "./http";
import { getMockBridge } from "./mock";
import type { BridgeClient } from "./types";

export function getBridge(): BridgeClient {
  if (isMockMode()) return getMockBridge();
  const apiKey = process.env.BRIDGE_API_KEY;
  if (!apiKey) {
    throw new BridgeError("La clave de Bridge no está configurada en el servidor.", 500);
  }
  return new BridgeHttpClient({ apiKey, baseUrl: bridgeBaseUrl() });
}

export { BridgeHttpClient } from "./http";
export { getMockBridge, MockBridge } from "./mock";
export { summarizeCustomers, verifyBridgeSignature } from "./webhook";
export type { BridgeClient } from "./types";
