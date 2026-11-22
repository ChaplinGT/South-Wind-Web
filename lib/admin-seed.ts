/** Cuenta de admin creada por error. El seed solo toca este correo. */
export const STALE_ADMIN_EMAIL = "gabriel@southwindglobalservices.com";

/** Null si el admin vigente es esa misma cuenta, para no desactivarla. */
export function staleAdminEmail(currentAdminEmail: string): string | null {
  const current = currentAdminEmail.trim().toLowerCase();
  if (current === STALE_ADMIN_EMAIL) return null;
  return STALE_ADMIN_EMAIL;
}
