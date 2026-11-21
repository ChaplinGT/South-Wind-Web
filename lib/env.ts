export function isMockMode(): boolean {
  return process.env.BRIDGE_MOCK !== "false";
}

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function bridgeBaseUrl(): string {
  return (process.env.BRIDGE_API_BASE_URL || "https://api.sandbox.bridge.xyz/v0").replace(/\/$/, "");
}
