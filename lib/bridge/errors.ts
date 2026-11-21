export class BridgeError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "BridgeError";
  }
}

export function bridgeErrorMessage(status: number, body: string, apiKey: string): string {
  const safe = sanitize(body, apiKey);
  const parsed = readMessage(safe);
  if (status === 401) return "No se pudo autenticar con Bridge. Revise la clave configurada en el servidor.";
  if (status === 404) return parsed || "Bridge no encontró el recurso solicitado.";
  if (status === 409) return parsed || "Bridge rechazó la operación por un conflicto de idempotencia.";
  if (status === 422 || status === 400) return parsed || "Bridge no pudo procesar la operación. Revise los datos.";
  if (status === 429) return "Bridge limitó las solicitudes. Intente nuevamente en unos minutos.";
  return parsed || `Bridge respondió con un error (${status}). Intente nuevamente.`;
}

function readMessage(body: string): string | null {
  try {
    const json = JSON.parse(body) as { message?: unknown; error?: unknown; code?: unknown };
    if (typeof json.message === "string" && json.message.trim()) return json.message.slice(0, 240);
    if (typeof json.error === "string" && json.error.trim()) return json.error.slice(0, 240);
    if (json.error && typeof json.error === "object" && "message" in json.error) {
      const message = (json.error as { message?: unknown }).message;
      if (typeof message === "string") return message.slice(0, 240);
    }
  } catch {
    return null;
  }
  return null;
}

export function sanitize(text: string, apiKey: string): string {
  let out = text ?? "";
  if (apiKey) out = out.split(apiKey).join("[clave]");
  out = out.replace(/sk[-_][A-Za-z0-9_\-]{6,}/g, "[clave]");
  return out.slice(0, 500);
}
