/** Use for all auth lookups and stored `users.email` so login matches regardless of casing. */
export function normalizeAuthEmail(e: string): string {
  return e.trim().toLowerCase();
}

/** Emails listed in SUPER_ADMIN_EMAILS (comma-separated) become super_admin on registration. */
export function roleForNewRegistration(email: string): "user" | "super_admin" {
  const raw = process.env.SUPER_ADMIN_EMAILS ?? "";
  const allowed = new Set(
    raw
      .split(",")
      .map((s) => normalizeAuthEmail(s))
      .filter(Boolean),
  );
  return allowed.has(normalizeAuthEmail(email)) ? "super_admin" : "user";
}
