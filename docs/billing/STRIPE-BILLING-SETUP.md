# Stripe billing — operator setup

The application now supports Stripe-managed subscriptions. Everything is **off by default**: if no
Stripe env vars are set, the API behaves exactly as before (only `ENFORCE_COMPLIMENTARY_ACCESS`
gates note generation). Turn it on by walking through the steps below.

> Source files:
> - Server: `artifacts/api-server/src/billing/*`, `artifacts/api-server/src/routes/billing.ts`
> - DB schema: `lib/db/src/schema/companies.ts`, `lib/db/src/schema/note-usage-ledger.ts`,
>   `lib/db/src/schema/processed-stripe-events.ts`
> - OpenAPI: `lib/api-spec/openapi.yaml` (`/billing/*` paths and `Billing*` schemas)
> - Frontend: `artifacts/abanoteassistant/src/pages/billing.tsx`

---

## 1. Stripe dashboard configuration

1. **Create three recurring Products + Prices in Stripe** (monthly):
   - Starter — $19/mo (saved-note quota 30)
   - Growth — $49/mo (saved-note quota 100)
   - High Volume — $119/mo (saved-note quota 300)
   - These display values live in code at
     `artifacts/api-server/src/billing/config.ts → PLAN_DEFINITIONS`. **Keep the Stripe Price
     amounts in sync** with the constants in that file (Stripe is the billing source of truth;
     the constants are display-only and quota-only).
2. **Capture the Price IDs** (e.g. `price_1NABC…`). You'll paste these into env vars.
3. **Enable the Customer Portal** (Settings → Billing → Customer Portal). Allow customers to:
   - cancel, swap plan, update card, view invoices.
   - Add the deploy origin (e.g. `https://abanoteassistant.com`) to the allowed return URLs.
4. **Create a Webhook endpoint**:
   - URL: `https://<your-api-host>/api/billing/webhook`
   - Events to send (minimum):
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `customer.subscription.trial_will_end`
     - `invoice.payment_failed`
     - `invoice.payment_succeeded`
     - `invoice.paid`
     - `customer.deleted`
   - Copy the signing secret (`whsec_…`); that's `STRIPE_WEBHOOK_SECRET`.

---

## 2. Server environment

Add the following to `artifacts/api-server/.env` (production) and the staging equivalent:

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_GROWTH=price_...
STRIPE_PRICE_HIGH=price_...
STRIPE_TRIAL_DAYS=7
BILLING_GRACE_PERIOD_DAYS=7
BILLING_ENFORCEMENT=off
APP_ORIGIN=https://abanoteassistant.com,https://staging.abanoteassistant.com
```

Notes:
- `BILLING_ENFORCEMENT` accepts `off | soft | hard`. Start in `off` to let webhooks populate the
  ledger and `companies.*` columns without blocking anything; switch to `hard` once you've
  verified usage data.
- If `STRIPE_SECRET_KEY` is **unset**, all `/billing/*` routes return 503 and `BILLING_ENFORCEMENT`
  is forced to `off` regardless of its value. Legacy `ENFORCE_COMPLIMENTARY_ACCESS` keeps working.
- `APP_ORIGIN` is a comma-separated allowlist. The checkout endpoint refuses to redirect Stripe
  to a host outside this list (defence in depth against open-redirect-style abuse).

---

## 3. Database migration

The new columns on `abanote.companies` and the two new tables (`note_usage_ledger`,
`processed_stripe_events`) are managed by Drizzle. On the droplet:

```
cd /var/www/abanoteassistant
git pull
pnpm install --frozen-lockfile
pnpm --filter @workspace/db run push        # applies schema additions
pnpm --filter @workspace/api-server run build
pm2 reload abanoteassistant-api
pm2 reload abanoteassistant-api-staging     # if separate process
```

The schema push is additive only — existing rows keep working. No data backfill needed.

---

## 4. Behaviour summary

- **Complimentary access** (`companies.free_usage = true` OR `billing_mode = 'complimentary'`) —
  unlimited generation and save, no Stripe interaction.
- **Subscribed (Stripe `active`/`trialing`)** — generation allowed up to plan quota for save.
  - Each saved note (first save only) inserts a row into `note_usage_ledger`; the unique index on
    `note_id` makes simultaneous saves race-safe.
  - At 85% of quota the save endpoint returns a `warnings: […]` string for soft-warning UI.
  - At 100% with `BILLING_ENFORCEMENT=hard`, save returns 402.
- **Past-due in grace period** (within `grace_period_until` after `payment_failed_at`) —
  **saves still allowed; new note generation BLOCKED with 402**. Policy: protect in-progress work.
- **Past grace, suspended, or no subscription** — both generation and save return 402.
- All webhook events are deduped via `processed_stripe_events` (Stripe retries are idempotent).
- `/billing/checkout` automatically routes existing active subscribers to the Customer Portal
  rather than starting a duplicate subscription.

---

## 5. Operational super-admin controls

The existing `PATCH /admin/companies/:id` endpoint now also accepts:
- `freeUsage: boolean` — legacy bypass (preserved).
- `billingMode: "complimentary" | "trial" | "subscription" | "suspended"` — new explicit override.

Setting either `freeUsage=true` OR `billing_mode='complimentary'` waives all quota checks.
Setting `billing_mode='suspended'` forces a hard block (overrides Stripe state) — useful for
manual account holds outside of a payment failure.

---

## 6. Sanity checklist after enabling enforcement

1. `GET /api/billing/plans` returns `stripeConfigured: true` and `plans[*].available: true`.
2. Sign in as a non-super-admin user → visit `/billing` → status panel renders.
3. Click **Subscribe** on Starter → Stripe Checkout opens → enter test card `4242 4242 4242 4242`
   → return URL hits `/billing?status=success`.
4. In Stripe dashboard inspect the new subscription, then in your DB:
   ```sql
   SELECT id, billing_mode, stripe_subscription_id, subscription_status, current_period_end
   FROM abanote.companies WHERE id = <id>;
   ```
   Should show `trial` or `subscription` and the period end.
5. Save a note while subscribed → `SELECT count(*) FROM abanote.note_usage_ledger;` increments by 1.
6. Switch `BILLING_ENFORCEMENT=hard`, save the (quota+1)th note → 402.
7. In Stripe dashboard trigger `invoice.payment_failed` (Test Webhooks) → `paymentFailedAt` and
   `gracePeriodUntil` get set; generation blocked; save still allowed until grace expires.
