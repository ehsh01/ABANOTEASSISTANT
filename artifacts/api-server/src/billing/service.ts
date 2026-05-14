import { and, count, eq, gte, lt } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@workspace/db";
import {
  companiesTable,
  noteUsageLedgerTable,
  processedStripeEventsTable,
} from "@workspace/db/schema";
import type { Company } from "@workspace/db/schema";
import {
  type BillingEnforcementMode,
  type BillingPlanConfig,
  type BillingPlanKey,
  findPlanByPriceId,
  getEnforcementMode,
  getGracePeriodDays,
  getPlanConfig,
  getTrialNoteCap,
  isStripeConfigured,
} from "./config";

export type DerivedBillingMode = "complimentary" | "trial" | "subscription" | "suspended";

export type BillingDecision = {
  company: Company;
  enforcement: BillingEnforcementMode;
  derivedMode: DerivedBillingMode;
  plan: BillingPlanConfig | undefined;
  /** Quota notes saved in the current billing period (0 when complimentary). */
  savedThisPeriod: number;
  /** Quota cap (`plan.savedNotesQuota`). `null` when no quota / unlimited. */
  savedQuota: number | null;
  /** True when within payment_failed_at..grace_period_until window. */
  inGracePeriod: boolean;
  /**
   * Higher-level booleans the route handlers use. Always permissive when enforcement is `off`.
   */
  generationAllowed: boolean;
  saveAllowed: boolean;
  blockedReason: string | null;
  periodStart: Date;
  periodEnd: Date;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * For Stripe-backed subscriptions we use `current_period_start..current_period_end` from the
 * subscription row. For complimentary or pre-checkout state, fall back to calendar month UTC so
 * "saves this month" is still a meaningful number on the status panel.
 */
function resolveBillingPeriod(company: Company): { start: Date; end: Date } {
  if (company.currentPeriodStart && company.currentPeriodEnd) {
    return { start: company.currentPeriodStart, end: company.currentPeriodEnd };
  }
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

export function isComplimentary(company: Pick<Company, "freeUsage" | "billingMode">): boolean {
  return company.freeUsage || company.billingMode === "complimentary";
}

function deriveMode(company: Company): DerivedBillingMode {
  if (isComplimentary(company)) return "complimentary";
  if (company.billingMode === "suspended") return "suspended";
  const status = company.subscriptionStatus ?? "";
  if (status === "trialing") return "trial";
  if (status === "active" || status === "past_due") return "subscription";
  // App-managed trial: registration set `trial_ends_at` but the user has not yet entered Stripe
  // Checkout, so `subscription_status` is still null. While the trial window is open, treat the
  // account as `trial` (allowed); once the window closes without a subscription, fall through to
  // the suspended branch below so generation/save get blocked until they subscribe.
  if (!status && company.trialEndsAt && company.trialEndsAt.getTime() > Date.now()) {
    return "trial";
  }
  if (status === "" || status === "canceled" || status === "unpaid" || status === "incomplete_expired") {
    return "suspended";
  }
  // Default any other Stripe status (incomplete, paused) to suspended to be safe.
  return "suspended";
}

async function countSavedThisPeriod(
  companyId: number,
  start: Date,
  end: Date,
): Promise<number> {
  const [row] = await db
    .select({ n: count(noteUsageLedgerTable.id) })
    .from(noteUsageLedgerTable)
    .where(
      and(
        eq(noteUsageLedgerTable.companyId, companyId),
        gte(noteUsageLedgerTable.countedAt, start),
        lt(noteUsageLedgerTable.countedAt, end),
      ),
    );
  return Number(row?.n ?? 0);
}

/**
 * Count every saved-note ledger row this company has ever had. Used by the app-managed trial
 * cap: while the company is in trial mode, the cap applies to the *total* saved notes during
 * the trial, not a calendar-month slice. Once the company subscribes, the ledger keeps growing
 * but the regular per-period quota (countSavedThisPeriod) takes over, so this all-time count is
 * only read inside the trial branch.
 */
async function countSavedAllTime(companyId: number): Promise<number> {
  const [row] = await db
    .select({ n: count(noteUsageLedgerTable.id) })
    .from(noteUsageLedgerTable)
    .where(eq(noteUsageLedgerTable.companyId, companyId));
  return Number(row?.n ?? 0);
}

/**
 * Read the billing state for a company and return a fully-resolved decision. The route handlers
 * use this to gate generation and save, and `/billing/status` returns it directly.
 *
 * Always returns a decision — when enforcement is `off`, `generationAllowed` and `saveAllowed`
 * are both true regardless of state so existing flows are preserved.
 */
export async function evaluateBilling(companyId: number): Promise<BillingDecision | null> {
  const [company] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId))
    .limit(1);
  if (!company) return null;
  const enforcement = getEnforcementMode();
  let derivedMode = deriveMode(company);
  const plan = findPlanByPriceId(company.stripePriceId);
  const { start: periodStart, end: periodEnd } = resolveBillingPeriod(company);
  const inGracePeriod = isInGracePeriod(company);

  // App-managed trial (no Stripe plan yet) uses an all-time-during-trial count vs. STRIPE_TRIAL_NOTE_CAP.
  // Stripe trial / active subscription uses the regular per-period count vs. plan quota.
  const isAppManagedTrial = derivedMode === "trial" && !plan;
  const trialCap = isAppManagedTrial ? getTrialNoteCap() : 0;

  let savedThisPeriod = 0;
  if (derivedMode !== "complimentary") {
    savedThisPeriod = isAppManagedTrial
      ? await countSavedAllTime(company.id)
      : await countSavedThisPeriod(company.id, periodStart, periodEnd);
  }
  const savedQuota =
    derivedMode === "complimentary"
      ? null
      : isAppManagedTrial
        ? trialCap > 0
          ? trialCap
          : null
        : (plan?.savedNotesQuota ?? null);

  // Trial-cap exhaustion ends the *entire* trial (block generate + save), not just block save.
  // The time-based path (trial_ends_at < now()) already maps to 'suspended' via deriveMode(); here
  // we extend the same treatment to "trial ended because the note cap was hit". Either limit ends
  // the trial as the product spec states ("14 days OR 15 notes, whichever first").
  const trialEndedByNoteCap =
    isAppManagedTrial && trialCap > 0 && savedThisPeriod >= trialCap;
  if (trialEndedByNoteCap) {
    derivedMode = "suspended";
  }

  let generationAllowed = true;
  let saveAllowed = true;
  let blockedReason: string | null = null;

  if (enforcement !== "off") {
    if (derivedMode === "complimentary") {
      // unlimited
    } else if (derivedMode === "suspended") {
      generationAllowed = false;
      saveAllowed = false;
      // Tailor the message to the cause so the frontend can render the right banner:
      //  - hit the note cap first → "you've used all N trial notes"
      //  - hit the time limit first → "your N-day free trial has ended"
      //  - never had a trial (canceled / legacy) → generic "choose a plan"
      // All three end with "your plan is going to start" wording so the user understands billing
      // starts the moment they pick a plan.
      const trialEndedByTime =
        !!company.trialEndsAt && company.trialEndsAt.getTime() <= Date.now();
      if (trialEndedByNoteCap && trialCap > 0) {
        blockedReason = `You've used all ${trialCap} notes from your free trial. Choose a plan to keep going — your subscription starts as soon as you pick one.`;
      } else if (trialEndedByTime) {
        blockedReason = `Your free trial has ended. Choose a plan to keep generating and saving notes — your subscription starts as soon as you pick one.`;
      } else {
        blockedReason =
          "This account is not on an active subscription. Choose a plan to continue generating and saving notes.";
      }
    } else if (derivedMode === "trial" || derivedMode === "subscription") {
      // Grace policy: allow saves of EXISTING notes, block NEW note generation.
      if (inGracePeriod) {
        generationAllowed = false;
        blockedReason =
          "Payment failed. You can still save in-progress notes; please update your payment method to keep generating new ones.";
      }
      // Past grace cutoff with payment_failed_at set: hard block save too.
      if (company.paymentFailedAt && !inGracePeriod && company.gracePeriodUntil) {
        generationAllowed = false;
        saveAllowed = false;
        blockedReason = "Subscription past due. Update your payment method to continue.";
      }
      // Quota check: only blocks SAVE (generation is fine, no charge until save).
      if (savedQuota !== null && savedThisPeriod >= savedQuota) {
        if (enforcement === "hard") {
          saveAllowed = false;
          blockedReason =
            blockedReason ??
            (isAppManagedTrial
              ? `You've reached the ${savedQuota}-note limit for the free trial. Choose a plan to keep saving notes.`
              : `You've reached your plan limit of ${savedQuota} saved notes this period. Upgrade your plan to save more.`);
        }
      }
    }
  }

  return {
    company,
    enforcement,
    derivedMode,
    plan,
    savedThisPeriod,
    savedQuota,
    inGracePeriod,
    generationAllowed,
    saveAllowed,
    blockedReason,
    periodStart,
    periodEnd,
  };
}

export function isInGracePeriod(company: Company): boolean {
  if (!company.paymentFailedAt || !company.gracePeriodUntil) return false;
  const now = Date.now();
  return company.gracePeriodUntil.getTime() > now;
}

/**
 * Insert a ledger row for this saved note (first save of a note within its period). The unique
 * index on `note_id` short-circuits subsequent saves of the same note. Skipped for complimentary
 * companies (which have no quota).
 *
 * Returns `{ countedThisRequest }` so the save route can tell the UI whether this save consumed
 * quota or was a re-save of an already-counted note.
 */
export async function recordSavedNote(input: {
  decision: BillingDecision;
  noteId: number;
  userId: number;
}): Promise<{ countedThisRequest: boolean; savedThisPeriod: number }> {
  const { decision, noteId, userId } = input;
  if (decision.derivedMode === "complimentary") {
    return { countedThisRequest: false, savedThisPeriod: 0 };
  }
  // Drizzle: `onConflictDoNothing` returns the inserted rows (empty array when a row already exists).
  const inserted = await db
    .insert(noteUsageLedgerTable)
    .values({
      companyId: decision.company.id,
      noteId,
      countedByUserId: userId,
      billingPeriodStart: decision.periodStart,
      billingPeriodEnd: decision.periodEnd,
      stripeSubscriptionId: decision.company.stripeSubscriptionId,
      stripePriceId: decision.company.stripePriceId,
    })
    .onConflictDoNothing({ target: noteUsageLedgerTable.noteId })
    .returning({ id: noteUsageLedgerTable.id });
  const countedThisRequest = inserted.length > 0;
  const savedThisPeriod = countedThisRequest
    ? decision.savedThisPeriod + 1
    : decision.savedThisPeriod;
  return { countedThisRequest, savedThisPeriod };
}

/**
 * Apply a Stripe `Customer.Subscription` event payload to the local `companies` row. Idempotent
 * relative to `processed_stripe_events`; the caller is responsible for inserting the event id.
 *
 * Resolves the company via Stripe metadata `companyId` (the checkout flow sets this), falling
 * back to `stripeCustomerId` lookup.
 */
export async function applySubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
  const company = await resolveCompanyFromSubscription(subscription);
  if (!company) {
    console.warn("[billing] subscription update with no matching company", subscription.id);
    return;
  }
  const updates = subscriptionToCompanyUpdates(subscription);
  await db.update(companiesTable).set(updates).where(eq(companiesTable.id, company.id));
}

export async function applyInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId = invoice.subscription
    ? typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription.id
    : null;
  if (!subscriptionId) return;
  const [company] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.stripeSubscriptionId, subscriptionId))
    .limit(1);
  if (!company) return;
  const now = new Date();
  const graceUntil = new Date(now.getTime() + getGracePeriodDays() * MS_PER_DAY);
  await db
    .update(companiesTable)
    .set({
      paymentFailedAt: now,
      gracePeriodUntil: graceUntil,
      subscriptionStatus: "past_due",
      updatedAt: new Date(),
    })
    .where(eq(companiesTable.id, company.id));
}

export async function applyInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId = invoice.subscription
    ? typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription.id
    : null;
  if (!subscriptionId) return;
  const [company] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.stripeSubscriptionId, subscriptionId))
    .limit(1);
  if (!company) return;
  if (company.paymentFailedAt || company.gracePeriodUntil) {
    await db
      .update(companiesTable)
      .set({ paymentFailedAt: null, gracePeriodUntil: null, updatedAt: new Date() })
      .where(eq(companiesTable.id, company.id));
  }
}

export async function applyCustomerDeleted(customerId: string): Promise<void> {
  const [company] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.stripeCustomerId, customerId))
    .limit(1);
  if (!company) return;
  await db
    .update(companiesTable)
    .set({
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      subscriptionStatus: "canceled",
      billingMode: company.freeUsage ? "complimentary" : "suspended",
      updatedAt: new Date(),
    })
    .where(eq(companiesTable.id, company.id));
}

function subscriptionToCompanyUpdates(subscription: Stripe.Subscription): Partial<Company> {
  const priceId =
    subscription.items.data[0]?.price?.id ?? null;
  const status = subscription.status;
  const periodStart = subscription.current_period_start
    ? new Date(subscription.current_period_start * 1000)
    : null;
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : null;
  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;

  let billingMode: Company["billingMode"];
  if (status === "trialing") billingMode = "trial";
  else if (status === "active" || status === "past_due") billingMode = "subscription";
  else billingMode = "suspended";

  return {
    stripeCustomerId:
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    subscriptionStatus: status,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    trialEndsAt: trialEnd,
    billingMode,
    updatedAt: new Date(),
  };
}

async function resolveCompanyFromSubscription(
  subscription: Stripe.Subscription,
): Promise<Company | undefined> {
  const metaCompanyId = readCompanyIdFromMetadata(subscription.metadata);
  if (metaCompanyId !== null) {
    const [byId] = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, metaCompanyId))
      .limit(1);
    if (byId) return byId;
  }
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  const [byCustomer] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.stripeCustomerId, customerId))
    .limit(1);
  return byCustomer;
}

export function readCompanyIdFromMetadata(
  meta: Stripe.Metadata | null | undefined,
): number | null {
  if (!meta) return null;
  const raw = meta.companyId ?? meta.company_id;
  if (typeof raw !== "string") return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Try to mark a Stripe event id as processed. Returns true when this is the first time we've
 * seen the event (caller should proceed to apply effects), false when it's a duplicate.
 */
export async function markEventProcessed(input: {
  stripeEventId: string;
  eventType: string;
}): Promise<boolean> {
  const inserted = await db
    .insert(processedStripeEventsTable)
    .values({ stripeEventId: input.stripeEventId, eventType: input.eventType })
    .onConflictDoNothing({ target: processedStripeEventsTable.stripeEventId })
    .returning({ id: processedStripeEventsTable.stripeEventId });
  return inserted.length > 0;
}

/**
 * Marketing snapshot of plans (with `available: boolean` flagging which ones the deploy has env
 * vars for). Used by `GET /billing/plans` and the upgrade UI.
 */
export function listPlansForResponse(): Array<{
  key: BillingPlanKey;
  label: string;
  savedNotesQuota: number;
  priceUsdMonthly: number;
  available: boolean;
}> {
  return (["starter", "growth", "high"] as const).map((key) => {
    const plan = getPlanConfig(key);
    return {
      key,
      label: plan.label,
      savedNotesQuota: plan.savedNotesQuota,
      priceUsdMonthly: plan.priceUsdMonthly,
      available: !!plan.stripePriceId,
    };
  });
}

export { isStripeConfigured };
