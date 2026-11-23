import { createHmac, randomBytes } from "crypto";
import { appUrl } from "./env";

export function googleEnabled(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleRedirectUri(): string {
  return `${appUrl()}/api/auth/google/callback`;
}

export function googleAuthUrl(state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID || "");
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export function signOAuthState(state: string): string {
  return createHmac("sha256", process.env.AUTH_SECRET || "southwind").update(state).digest("hex");
}

export function newOAuthState(): { state: string; signature: string } {
  const state = randomBytes(16).toString("hex");
  return { state, signature: signOAuthState(state) };
}
