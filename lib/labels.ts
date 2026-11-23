export const clientTypeLabel: Record<string, string> = {
  importador: "Importador",
  cuenta_eeuu: "Empresa con cuenta en EE.UU.",
  exportador: "Exportador",
  persona: "Persona",
};

export const kybLabel: Record<string, string> = {
  not_started: "Sin iniciar",
  pending: "Pendiente",
  incomplete: "Incompleto",
  under_review: "En revisión",
  approved: "Aprobado",
  rejected: "Rechazado",
  restricted: "Depósitos restringidos",
};

export const transferStateLabel: Record<string, string> = {
  awaiting_funds: "Esperando fondos",
  in_review: "En revisión",
  funds_received: "Fondos recibidos",
  payment_submitted: "Pago enviado",
  payment_processed: "Pago procesado",
  canceled: "Cancelado",
  cancelled: "Cancelado",
  undeliverable: "No entregable",
  returned: "Devuelto",
  refunded: "Reembolsado",
  error: "Con error",
  submitting: "Enviando",
};

export const conversionStatusLabel: Record<string, string> = {
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  pagado: "Pagado",
};

export const directionLabel: Record<string, string> = {
  usdc_to_bob: "USDC → bolivianos",
  bob_to_usdc: "Bolivianos → USDC",
};

export const kindLabel: Record<string, string> = {
  deposit: "Depósito",
  payout: "Pago",
  payout_reversal: "Reverso de pago",
  conversion_out: "Conversión a bolivianos",
  conversion_in: "Conversión a USDC",
};

export const auditActionLabel: Record<string, string> = {
  "transfer.create": "Pago enviado",
  "transfer.update": "Pago actualizado",
  "beneficiary.create": "Beneficiario registrado",
  "conversion.create": "Solicitud de conversión",
  "conversion.update": "Conversión actualizada",
  "customer.invite": "Cliente vinculado",
  "customer.register": "Empresa registrada",
  "kyb.link": "Enlace de verificación generado",
  "kyb.approved": "Verificación aprobada",
  "statement.generate": "Extracto generado",
  "fee.update": "Comisión actualizada",
  "markup.update": "Márgenes de tipo de cambio actualizados",
  "deposit.simulated": "Depósito simulado",
  "webhook.processed": "Evento de Bridge procesado",
};

export function labelOf(map: Record<string, string>, key: string): string {
  return map[key] ?? key;
}
