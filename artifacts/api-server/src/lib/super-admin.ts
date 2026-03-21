const norm = (e: string) => e.trim().toLowerCase();

/** Emails listed in SUPER_ADMIN_EMAILS (comma-separated) become super_admin on registration. */
export function roleForNewRegistration(email: string): "user" | "super_admin" {
  const raw = process.env.SUPER_ADMIN_EMAILS ?? "";
  const allowed = new Set(
    raw
      .split(",")
      .map((s) => norm(s))
      .filter(Boolean),
  );
  return allowed.has(norm(email)) ? "super_admin" : "user";
}
