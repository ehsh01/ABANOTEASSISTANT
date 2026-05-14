-- Grandfather all pre-billing companies as complimentary (2026-05-14).
--
-- Policy: any company that exists at the moment billing rolls out — i.e. no Stripe state and no
-- app-managed trial set — is treated as free_usage = true forever. This protects every customer
-- who signed up before payments were a thing.
--
-- Idempotent: the WHERE clause excludes rows that already have stripe state OR an in-progress
-- trial (trial_ends_at IS NOT NULL means the new registration path has already touched them).
-- Safe to re-run; will become a no-op once every pre-billing row is grandfathered.
BEGIN;

UPDATE abanote.companies
   SET free_usage = TRUE,
       billing_mode = 'complimentary',
       updated_at = now()
 WHERE free_usage = FALSE
   AND billing_mode = 'subscription'
   AND stripe_customer_id IS NULL
   AND stripe_subscription_id IS NULL
   AND trial_ends_at IS NULL;

COMMIT;
