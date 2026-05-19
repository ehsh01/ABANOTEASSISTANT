/**
 * Billing configuration read from environment variables.
 *
 * Backward-compatibility contract:
 * - When `STRIPE_SECRET_KEY` is unset, every `/billing/*` route returns 503 and `BILLING_ENFORCEMENT`
 *   is forced to `off`. The existing `/notes/generate` and `/notes/:id/save` paths behave exactly
 *   as before (only `ENFORCE_COMPLIMENTARY_ACCESS` still gates generation).
 * - When `BILLING_ENFORCEMENT=off` (the default), webhooks/ledger still work but no request is ever
 *   blocked because of billing state — production can run with Stripe wired but enforcement off
 *   while the team verifies usage data.
 */

export type BillingEnforcementMode = "off" | "soft" | "hard";

export type BillingPlanKey = "starter" | "growth" | "high";

export type BillingPlanConfig = {
  key: BillingPlanKey;
  label: string;
  /**
   * Number of notes a company may save in a single Stripe billing period before being blocked
   * (hard) or warned (soft). Display purposes only when the plan is not configured for this deploy.
   */
  savedNotesQuota: number;
  /** Display-only USD/month price. Actual amounts charged come from the Stripe Price. */
  priceUsdMonthly: number;
  /** Stripe Price ID from env. Undefined when the deploy has not configured this plan yet. */
  stripePriceId: string | undefined;
};

/**
 * Plan definitions. Quotas and prices are kept in code so the marketing page can match exactly;
 * Stripe Prices remain the billing source of truth. To add a plan: extend BillingPlanKey + this map.
 */
export const PLAN_DEFINITIONS: Readonly<Record<BillingPlanKey, Omit<BillingPlanConfig, "stripePriceId">>> = {
  starter: { key: "starter", label: "Starter", savedNotesQuota: 30, priceUsdMonthly: 19 },
  growth: { key: "growth", label: "Growth", savedNotesQuota: 100, priceUsdMonthly: 39 },
  high: { key: "high", label: "High Volume", savedNotesQuota: 200, priceUsdMonthly: 59 },
};

function envTrim(name: string): string | undefined {
  const raw = process.env[name];
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getStripeSecretKey(): string | undefined {
  return envTrim("STRIPE_SECRET_KEY");
}

export function getStripeWebhookSecret(): string | undefined {
  return envTrim("STRIPE_WEBHOOK_SECRET");
}

/** Days for Stripe-native trial (subscription_data.trial_period_days). Default: 0 (no trial). */
export function getTrialDays(): number {
  const raw = envTrim("STRIPE_TRIAL_DAYS");
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/**
 * Maximum number of notes a trial company may save during their app-managed trial. Trial ends
 * whichever comes first: `STRIPE_TRIAL_DAYS` of calendar time OR this many saved notes.
 *
 * Default `0` = no cap (trial limited only by `STRIPE_TRIAL_DAYS`). When the trial cap is hit
 * during `BILLING_ENFORCEMENT=hard`, the save endpoint returns 402 and the user must subscribe
 * to keep going (same gate the regular plan quota uses).
 */
export function getTrialNoteCap(): number {
  const raw = envTrim("STRIPE_TRIAL_NOTE_CAP");
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/** Days a company stays usable after a failed invoice before save itself is blocked. Default: 7. */
export function getGracePeriodDays(): number {
  const raw = envTrim("BILLING_GRACE_PERIOD_DAYS");
  if (!raw) return 7;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 7;
  return Math.floor(n);
}

/**
 * Read enforcement mode. Always returns `off` if Stripe is not configured — this is the safety
 * net that guarantees the legacy install continues to work without billing env vars.
 */
export function getEnforcementMode(): BillingEnforcementMode {
  if (!getStripeSecretKey()) return "off";
  const raw = envTrim("BILLING_ENFORCEMENT")?.toLowerCase();
  if (raw === "hard" || raw === "soft") return raw;
  return "off";
}

export function isStripeConfigured(): boolean {
  return !!getStripeSecretKey();
}

export function getPlanConfig(key: BillingPlanKey): BillingPlanConfig {
  const def = PLAN_DEFINITIONS[key];
  const envKey =
    key === "starter"
      ? "STRIPE_PRICE_STARTER"
      : key === "growth"
        ? "STRIPE_PRICE_GROWTH"
        : "STRIPE_PRICE_HIGH";
  return { ...def, stripePriceId: envTrim(envKey) };
}

export function listPlanConfigs(): BillingPlanConfig[] {
  return (Object.keys(PLAN_DEFINITIONS) as BillingPlanKey[]).map(getPlanConfig);
}

export function findPlanByPriceId(priceId: string | null | undefined): BillingPlanConfig | undefined {
  if (!priceId) return undefined;
  return listPlanConfigs().find((p) => p.stripePriceId === priceId);
}

/**
 * Parse the `APP_ORIGIN` allowlist (comma-separated). Used by the checkout endpoint to make sure
 * a malicious caller cannot direct Stripe to redirect the user to an attacker-controlled host.
 */
export function getAllowedRedirectOrigins(): string[] {
  const raw = envTrim("APP_ORIGIN");
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter((s) => s.length > 0);
}

export function isAllowedRedirectUrl(url: string): boolean {
  const allowed = getAllowedRedirectOrigins();
  if (allowed.length === 0) {
    // No allowlist configured — accept any https URL so single-host deploys keep working.
    try {
      const u = new URL(url);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  }
  try {
    const u = new URL(url);
    const origin = `${u.protocol}//${u.host}`;
    return allowed.includes(origin);
  } catch {
    return false;
  }
}
