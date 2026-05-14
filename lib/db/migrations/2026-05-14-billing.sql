-- ABA Note Assistant billing schema additions (2026-05-14)
-- Idempotent: safe to re-run. Adds columns + 2 tables for Stripe-billing layer.
-- All additions are nullable / new tables — no destructive changes.

BEGIN;

-- 1. Extend abanote.companies with Stripe + billing fields.
ALTER TABLE abanote.companies
  ADD COLUMN IF NOT EXISTS billing_mode text NOT NULL DEFAULT 'subscription',
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS grace_period_until timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS companies_stripe_customer_id_idx
  ON abanote.companies (stripe_customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS companies_stripe_subscription_id_idx
  ON abanote.companies (stripe_subscription_id);

-- 2. Append-only quota ledger (note_id UNIQUE = race-safe first-save quota).
CREATE TABLE IF NOT EXISTS abanote.note_usage_ledger (
  id                     serial PRIMARY KEY,
  company_id             integer NOT NULL REFERENCES abanote.companies(id) ON DELETE CASCADE,
  note_id                integer NOT NULL REFERENCES abanote.notes(id) ON DELETE CASCADE,
  counted_at             timestamptz NOT NULL DEFAULT now(),
  billing_period_start   timestamptz NOT NULL,
  billing_period_end     timestamptz NOT NULL,
  counted_by_user_id     integer REFERENCES abanote.users(id) ON DELETE SET NULL,
  stripe_subscription_id text,
  stripe_price_id        text,
  created_at             timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS note_usage_ledger_note_id_uniq
  ON abanote.note_usage_ledger (note_id);

-- 3. Stripe webhook idempotency table.
CREATE TABLE IF NOT EXISTS abanote.processed_stripe_events (
  stripe_event_id text PRIMARY KEY,
  event_type      text NOT NULL,
  processed_at    timestamptz NOT NULL DEFAULT now()
);

COMMIT;
