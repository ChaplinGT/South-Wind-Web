const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

export function isValidEmail(value: string): boolean {
  return EMAIL.test(value.trim());
}

/** Correo del admin a sembrar. Si ADMIN_EMAIL viene definido y no es un correo, lanza un error sin incluir el valor. */
export function resolveAdminEmail(raw: string | undefined): string {
  if (raw === undefined || raw.trim() === "") return "admin@southwind.example";
  const email = raw.trim().toLowerCase();
  if (!isValidEmail(email)) {
    throw new Error("ADMIN_EMAIL no es un correo válido. El seed se detiene y el valor no se imprime.");
  }
  return email;
}

/** Otros admins: un correo inválido se borra si no hay FKs; si las hay, se desactiva. El resto se desactiva. */
export function otherAdminAction(email: string, hasForeignKeys: boolean): "delete" | "deactivate" {
  if (!isValidEmail(email) && !hasForeignKeys) return "delete";
  return "deactivate";
}
