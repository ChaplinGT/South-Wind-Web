export class BridgeError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "BridgeError";
  }
}

export function bridgeErrorMessage(_status: number, body: string, apiKey: string): string {
  sanitize(body, apiKey);
  return "No se pudo completar la operación. Intente nuevamente.";
}

export function sanitize(text: string, apiKey: string): string {
  let out = text ?? "";
  if (apiKey) out = out.split(apiKey).join("[clave]");
  out = out.replace(/sk[-_][A-Za-z0-9_\-]{6,}/g, "[clave]");
  return out.slice(0, 500);
}
