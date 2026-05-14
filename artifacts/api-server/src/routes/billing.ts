import express, { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import {
  CreateBillingCheckoutSessionBody,
  CreateBillingCheckoutSessionResponse,
  CreateBillingPortalSessionBody,
  CreateBillingPortalSessionResponse,
  GetBillingStatusResponse,
  ListBillingPlansResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import { companiesTable } from "@workspace/db/schema";
import { requireAuth } from "../middleware/auth";
import {
  getPlanConfig,
  getTrialDays,
  isAllowedRedirectUrl,
  isStripeConfigured,
} from "../billing/config";
import { getStripeClient } from "../billing/stripe-client";
import {
  applyCustomerDeleted,
  applyInvoicePaymentFailed,
  applyInvoicePaymentSucceeded,
  applySubscriptionUpdate,
  evaluateBilling,
  listPlansForResponse,
  markEventProcessed,
} from "../billing/service";
import { getStripeWebhookSecret } from "../billing/config";

const router: IRouter = Router();

/**
 * GET /billing/plans is intentionally public — the marketing/onboarding page calls it before login.
 * It exposes only the plan keys, not the underlying Stripe Price IDs.
 */
router.get("/billing/plans", async (_req, res) => {
  const payload = ListBillingPlansResponse.parse({
    success: true,
    data: {
      stripeConfigured: isStripeConfigured(),
      trialDays: getTrialDays(),
      plans: listPlansForResponse(),
    },
    error: null,
  });
  res.json(payload);
});

router.get("/billing/status", requireAuth, async (req, res) => {
  const companyId = req.companyId;
  if (companyId === undefined) {
    res.status(401).json({ success: false, error: "Unauthorized", messages: [] });
    return;
  }
  const decision = await evaluateBilling(companyId);
  if (!decision) {
    res.status(404).json({ success: false, error: "Company not found", messages: [] });
    return;
  }
  const usagePercent =
    decision.savedQuota && decision.savedQuota > 0
      ? Math.min(100, Math.round((decision.savedThisPeriod / decision.savedQuota) * 100))
      : null;

  const payload = GetBillingStatusResponse.parse({
    success: true,
    data: {
      companyId: decision.company.id,
      billingMode: decision.derivedMode,
      enforcement: decision.enforcement,
      plan: decision.plan
        ? {
            key: decision.plan.key,
            label: decision.plan.label,
            savedNotesQuota: decision.plan.savedNotesQuota,
            priceUsdMonthly: decision.plan.priceUsdMonthly,
            available: !!decision.plan.stripePriceId,
          }
        : null,
      stripeCustomerPresent: !!decision.company.stripeCustomerId,
      subscription: decision.company.stripeSubscriptionId
        ? {
            status: decision.company.subscriptionStatus ?? "unknown",
            currentPeriodStart: decision.company.currentPeriodStart?.toISOString() ?? null,
            currentPeriodEnd: decision.company.currentPeriodEnd?.toISOString() ?? null,
            cancelAt: null,
          }
        : null,
      trialEndsAt: decision.company.trialEndsAt?.toISOString() ?? null,
      paymentFailedAt: decision.company.paymentFailedAt?.toISOString() ?? null,
      gracePeriodUntil: decision.company.gracePeriodUntil?.toISOString() ?? null,
      inGracePeriod: decision.inGracePeriod,
      generationAllowed: decision.generationAllowed,
      saveAllowed: decision.saveAllowed,
      blockedReason: decision.blockedReason,
      savedThisPeriod: decision.savedThisPeriod,
      savedQuota: decision.savedQuota,
      usagePercent,
    },
    error: null,
  });
  res.json(payload);
});

router.post("/billing/checkout", requireAuth, async (req, res) => {
  const companyId = req.companyId;
  if (companyId === undefined) {
    res.status(401).json({ success: false, error: "Unauthorized", messages: [] });
    return;
  }
  if (!isStripeConfigured()) {
    res.status(503).json({
      success: false,
      error: "Stripe is not configured on this server",
      messages: ["Set STRIPE_SECRET_KEY and plan price IDs to enable billing."],
    });
    return;
  }
  const stripe = getStripeClient();
  if (!stripe) {
    res.status(503).json({ success: false, error: "Stripe client unavailable", messages: [] });
    return;
  }
  const body = CreateBillingCheckoutSessionBody.parse(req.body);
  const plan = getPlanConfig(body.plan);
  if (!plan.stripePriceId) {
    res.status(400).json({
      success: false,
      error: `Plan "${body.plan}" is not configured on this server`,
      messages: [],
    });
    return;
  }
  if (!isAllowedRedirectUrl(body.successUrl) || !isAllowedRedirectUrl(body.cancelUrl)) {
    res.status(400).json({
      success: false,
      error: "Redirect URL host is not in the allowed list",
      messages: [],
    });
    return;
  }

  const [company] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId))
    .limit(1);
  if (!company) {
    res.status(404).json({ success: false, error: "Company not found", messages: [] });
    return;
  }

  // Active subscription? Send to the portal instead of starting a duplicate.
  const status = company.subscriptionStatus;
  if (
    company.stripeCustomerId &&
    (status === "active" || status === "trialing" || status === "past_due")
  ) {
    const portal = await stripe.billingPortal.sessions.create({
      customer: company.stripeCustomerId,
      return_url: body.successUrl,
    });
    const payload = CreateBillingCheckoutSessionResponse.parse({
      success: true,
      data: { url: portal.url, mode: "portal" },
      error: null,
    });
    res.json(payload);
    return;
  }

  // First-time checkout: ensure we have a Stripe Customer with `companyId` metadata so webhook
  // events can resolve back to the right tenant even if the user is signed out at the time.
  let customerId = company.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: company.name,
      email: company.email ?? undefined,
      metadata: {
        companyId: String(company.id),
      },
    });
    customerId = customer.id;
    await db
      .update(companiesTable)
      .set({ stripeCustomerId: customerId, updatedAt: new Date() })
      .where(eq(companiesTable.id, company.id));
  }

  // Trial policy: the app already gave this company an app-managed trial at registration time
  // (see resolveTrialForNewCompany in routes/auth.ts). The Stripe Checkout trial should be the
  // *remaining* portion of that window, not a fresh STRIPE_TRIAL_DAYS — otherwise users get two
  // back-to-back trials. We round up so a few-hours-remaining trial still grants 1 free day.
  //
  // Stripe requires trial_period_days >= 1 (it rejects 0 and negatives), so anything below 1
  // means "no trial — charge at first invoice". We also fall back to STRIPE_TRIAL_DAYS when the
  // company has no trial_ends_at on file (legacy rows; pre-grandfather edge case).
  const MS_PER_DAY_CHECKOUT = 24 * 60 * 60 * 1000;
  const nowMs = Date.now();
  let stripeTrialDays = 0;
  if (company.trialEndsAt) {
    const remainingMs = company.trialEndsAt.getTime() - nowMs;
    if (remainingMs > 0) stripeTrialDays = Math.ceil(remainingMs / MS_PER_DAY_CHECKOUT);
  } else {
    stripeTrialDays = getTrialDays();
  }
  const checkout = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_collection: "always",
    success_url: body.successUrl,
    cancel_url: body.cancelUrl,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    subscription_data: {
      ...(stripeTrialDays >= 1 ? { trial_period_days: stripeTrialDays } : {}),
      metadata: {
        companyId: String(company.id),
        planKey: plan.key,
      },
    },
    metadata: {
      companyId: String(company.id),
      planKey: plan.key,
    },
    allow_promotion_codes: true,
  });

  if (!checkout.url) {
    res.status(500).json({
      success: false,
      error: "Stripe did not return a checkout URL",
      messages: [],
    });
    return;
  }
  const payload = CreateBillingCheckoutSessionResponse.parse({
    success: true,
    data: { url: checkout.url, mode: "checkout" },
    error: null,
  });
  res.json(payload);
});

router.post("/billing/portal", requireAuth, async (req, res) => {
  const companyId = req.companyId;
  if (companyId === undefined) {
    res.status(401).json({ success: false, error: "Unauthorized", messages: [] });
    return;
  }
  if (!isStripeConfigured()) {
    res.status(503).json({
      success: false,
      error: "Stripe is not configured on this server",
      messages: [],
    });
    return;
  }
  const stripe = getStripeClient();
  if (!stripe) {
    res.status(503).json({ success: false, error: "Stripe client unavailable", messages: [] });
    return;
  }
  const body = CreateBillingPortalSessionBody.parse(req.body ?? {});
  const [company] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId))
    .limit(1);
  if (!company) {
    res.status(404).json({ success: false, error: "Company not found", messages: [] });
    return;
  }
  if (!company.stripeCustomerId) {
    res.status(409).json({
      success: false,
      error: "No Stripe customer on file for this company yet — start with checkout.",
      messages: [],
    });
    return;
  }

  const returnUrl = body.returnUrl && isAllowedRedirectUrl(body.returnUrl) ? body.returnUrl : undefined;
  const portal = await stripe.billingPortal.sessions.create({
    customer: company.stripeCustomerId,
    return_url: returnUrl,
  });
  const payload = CreateBillingPortalSessionResponse.parse({
    success: true,
    data: { url: portal.url },
    error: null,
  });
  res.json(payload);
});

/**
 * Stripe webhook handler. Mounted with `express.raw({ type: 'application/json' })` so the request
 * body is the verbatim bytes Stripe signed — Stripe's `constructEvent` requires this. We dedupe
 * via the `processed_stripe_events` table to make retries safe.
 */
export const stripeWebhookHandler = async (req: Request, res: Response): Promise<void> => {
  const secret = getStripeWebhookSecret();
  const stripe = getStripeClient();
  if (!secret || !stripe) {
    res.status(503).json({
      success: false,
      error: "Stripe webhook not configured",
      messages: ["Set STRIPE_WEBHOOK_SECRET to enable."],
    });
    return;
  }

  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string") {
    res.status(400).json({ success: false, error: "Missing Stripe-Signature header", messages: [] });
    return;
  }

  let event: Stripe.Event;
  try {
    const raw = req.body as Buffer;
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch (err) {
    console.warn("[stripe] webhook signature verify failed", err);
    res.status(400).json({ success: false, error: "Invalid signature", messages: [] });
    return;
  }

  const firstTime = await markEventProcessed({
    stripeEventId: event.id,
    eventType: event.type,
  });
  if (!firstTime) {
    res.status(200).json({ received: true });
    return;
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.trial_will_end":
        await applySubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
        await applyInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_succeeded":
      case "invoice.paid":
        await applyInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case "customer.deleted": {
        const customer = event.data.object as Stripe.Customer;
        await applyCustomerDeleted(customer.id);
        break;
      }
      default:
        // Unhandled event types are still recorded as processed (no-op) so Stripe stops retrying.
        break;
    }
  } catch (err) {
    console.error("[stripe] webhook handler failed", event.id, event.type, err);
    // Don't return 500 to Stripe — that triggers retries and we've already recorded the event id.
    // If a handler crashed we surface to logs but ack so we can investigate without backpressure.
  }

  res.status(200).json({ received: true });
};

/**
 * Sub-router that uses `express.raw` so the webhook receives the verbatim payload Stripe signed.
 * Mounted separately in app.ts to avoid the main `express.json()` middleware swallowing the body.
 */
export const stripeWebhookRouter: IRouter = Router();
stripeWebhookRouter.post(
  "/billing/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler,
);

export default router;
