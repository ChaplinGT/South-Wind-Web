/** Sin clave de Bridge siempre es simulado. Con clave, solo el API real si BRIDGE_MOCK=false. */
export function isMockMode(): boolean {
  if (!process.env.BRIDGE_API_KEY) return true;
  return process.env.BRIDGE_MOCK !== "false";
}

/**
 * URL pública para QR de extractos y enlaces de verificación.
 * APP_URL gana (el dominio definitivo). Luego NEXTAUTH_URL. En Vercel, VERCEL_URL.
 */
export function appUrl(): string {
  const explicit = process.env.APP_URL || process.env.NEXTAUTH_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.replace(/^https?:\/\//, "");
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export function bridgeBaseUrl(): string {
  return (process.env.BRIDGE_API_BASE_URL || "https://api.sandbox.bridge.xyz/v0").replace(/\/$/, "");
}
