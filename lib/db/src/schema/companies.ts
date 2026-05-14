import { serial, text, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { abanote } from "./abanote";

/**
 * Stripe + billing fields are all nullable so the legacy registration flow continues to work
 * without any payment integration configured (BILLING_ENFORCEMENT=off keeps everything optional).
 *
 * Source of truth for "is this company allowed to bill" reads as: `freeUsage` (legacy bypass) OR
 * `billingMode = 'complimentary'` OR active subscription (`subscriptionStatus` in active/trialing
 * AND within grace if past_due). See `artifacts/api-server/src/billing/service.ts`.
 */
export const companiesTable = abanote.table(
  "companies",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    address: text("address"),
    phone: text("phone"),
    email: text("email"),
    /** Legacy complimentary toggle — still honored. New deploys may prefer `billingMode = 'complimentary'`. */
    freeUsage: boolean("free_usage").notNull().default(false),
    /**
     * Explicit billing mode (kept alongside `freeUsage` for backward compatibility). Values:
     *  - `complimentary` — bypass billing checks (same as `freeUsage = true`).
     *  - `trial` — Stripe trial subscription (set when webhook reports `trialing`).
     *  - `subscription` — paid subscription active or in grace.
     *  - `suspended` — manually suspended by super admin (hard block, no save / no generate).
     */
    billingMode: text("billing_mode").notNull().default("subscription"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripePriceId: text("stripe_price_id"),
    /** Mirrors Stripe `subscription.status` (`trialing`, `active`, `past_due`, `canceled`, …). Null when no sub. */
    subscriptionStatus: text("subscription_status"),
    /** Stripe current_period_start / _end timestamps. Null when no sub. */
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    /** Stripe trial_end snapshot for UI (null when not trialing). */
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    /** When most recent invoice payment failed (null when last paid). */
    paymentFailedAt: timestamp("payment_failed_at", { withTimezone: true }),
    /**
     * Hard grace cutoff after `paymentFailedAt`. Policy: during grace we ALLOW saves of existing notes
     * (so clinical work is not lost) and BLOCK new note generation. After grace, save is blocked too.
     */
    gracePeriodUntil: timestamp("grace_period_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    stripeCustomerIdx: uniqueIndex("companies_stripe_customer_id_idx").on(t.stripeCustomerId),
    stripeSubscriptionIdx: uniqueIndex("companies_stripe_subscription_id_idx").on(t.stripeSubscriptionId),
  }),
);

export const insertCompanySchema = createInsertSchema(companiesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companiesTable.$inferSelect;
