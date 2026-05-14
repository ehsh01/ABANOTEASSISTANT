import { useMemo, useState } from "react";
import { Redirect, useLocation } from "wouter";
import {
  Check,
  CreditCard,
  Sparkles,
  AlertTriangle,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useT } from "@/hooks/use-translation";
import { useToast } from "@/hooks/use-toast";
import {
  useBillingPlans,
  useBillingStatus,
  useCreateBillingCheckout,
  useCreateBillingPortal,
} from "@/hooks/use-aba-api";
import type { BillingPlanSummary, BillingPlanKey } from "@workspace/api-client-react";

const PLAN_ORDER: BillingPlanKey[] = ["starter", "growth", "high"];

/**
 * Billing screen. Reads:
 *   - `GET /billing/plans` (no auth) — which plans are configured on the server.
 *   - `GET /billing/status` (auth) — current company's plan, mode, and usage.
 * Mutates:
 *   - `POST /billing/checkout` to redirect to Stripe Checkout (subscribe / start trial).
 *   - `POST /billing/portal` to redirect to the Customer Portal (manage existing sub).
 *
 * When the API has not been configured with Stripe env vars (`stripeConfigured: false`), the page
 * surfaces a graceful empty state instead of letting users click buttons that would 503.
 */
export default function BillingPage() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const t = useT();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [pendingPlan, setPendingPlan] = useState<BillingPlanKey | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const plansQuery = useBillingPlans();
  const statusQuery = useBillingStatus();
  const checkout = useCreateBillingCheckout();
  const portal = useCreateBillingPortal();

  const baseUrl = useMemo(() => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://abanoteassistant.com";
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    return `${origin}${base}`;
  }, []);

  if (!token || !user) return <Redirect to="/login" />;
  // Super admins manage tenant billing via the Admin page; this is the org-user-facing screen.
  if (user.role === "super_admin") return <Redirect to="/admin" />;

  const plansData = plansQuery.data?.data;
  const statusData = statusQuery.data?.data;

  const stripeConfigured = plansData?.stripeConfigured ?? false;
  const trialDays = plansData?.trialDays ?? 0;
  const plansByKey = new Map<BillingPlanKey, BillingPlanSummary>(
    (plansData?.plans ?? []).map((p) => [p.key, p]),
  );

  const isComplimentary = statusData?.billingMode === "complimentary";
  const inGracePeriod = !!statusData?.inGracePeriod;
  const suspended = statusData?.billingMode === "suspended";

  async function startCheckout(plan: BillingPlanKey) {
    setPendingPlan(plan);
    try {
      const res = await checkout.mutateAsync({
        plan,
        successUrl: `${baseUrl}/billing?status=success`,
        cancelUrl: `${baseUrl}/billing?status=canceled`,
      });
      if (res?.data?.url) {
        window.location.href = res.data.url;
        return;
      }
      toast({ title: t.common.error, variant: "destructive" });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Stripe is not available right now.";
      toast({
        title: t.common.error,
        description: message,
        variant: "destructive",
      });
    } finally {
      setPendingPlan(null);
    }
  }

  async function openPortal() {
    setPortalLoading(true);
    try {
      const res = await portal.mutateAsync({ returnUrl: `${baseUrl}/billing` });
      if (res?.data?.url) {
        window.location.href = res.data.url;
        return;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Stripe Portal unavailable";
      toast({ title: t.common.error, description: message, variant: "destructive" });
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FDE8EE]">
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#F0E4E1]/60 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 flex items-center justify-center">
              <div
                className="absolute inset-0 rounded-lg shadow-[0_4px_10px_rgba(194,122,138,0.25)]"
                style={{ background: "linear-gradient(135deg, #e6b3c0 0%, #C27A8A 100%)" }}
              />
              <Sparkles className="w-4 h-4 text-white relative z-10" />
            </div>
            <span className="font-extrabold text-base tracking-widest text-[#2D2523] uppercase">
              ABANOTEASSISTANT
            </span>
          </div>
          <button
            type="button"
            onClick={() => setLocation("/")}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#F0E4E1] text-[#877870] text-sm font-semibold hover:bg-white/60 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t.billing.backToDashboard}
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-extrabold text-[#2D2523] mb-2">
            {t.billing.title}
          </h1>
        </header>

        {/* Status card */}
        <section className="bg-white rounded-2xl border border-[#F0E4E1] shadow-sm p-6 mb-8">
          {statusQuery.isLoading ? (
            <p className="text-[#877870]">{t.common.loading}</p>
          ) : !statusData ? (
            <p className="text-[#877870]">{t.common.error}</p>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-[#C27A8A] mb-1">
                  {t.billing.planLabel}
                </div>
                <div className="text-lg font-semibold text-[#2D2523]">
                  {statusData.plan?.label ?? t.billing.noPlan}
                </div>
                {statusData.subscription?.status && (
                  <div className="mt-1 text-sm text-[#877870]">
                    {t.billing.subscriptionStatusLabel}: {statusData.subscription.status}
                  </div>
                )}
                {statusData.trialEndsAt && (
                  <div className="mt-1 text-sm text-[#877870]">
                    {t.billing.trialEndingLabel}:{" "}
                    {new Date(statusData.trialEndsAt).toLocaleDateString()}
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-[#C27A8A] mb-1">
                  {t.billing.usage}
                </div>
                <div className="text-lg font-semibold text-[#2D2523]">
                  {statusData.savedThisPeriod}
                  {statusData.savedQuota !== null && statusData.savedQuota !== undefined
                    ? ` / ${statusData.savedQuota}`
                    : ""}
                </div>
                {(statusData.savedQuota === null || statusData.savedQuota === undefined) && (
                  <div className="mt-1 text-sm text-[#877870]">{t.billing.unlimited}</div>
                )}
                {typeof statusData.usagePercent === "number" && (
                  <div className="mt-2 h-2 w-full bg-[#FCEEF1] rounded-full overflow-hidden">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, statusData.usagePercent)}%`,
                        background:
                          statusData.usagePercent >= 90
                            ? "#dc2626"
                            : statusData.usagePercent >= 70
                              ? "#f59e0b"
                              : "#C27A8A",
                      }}
                    />
                  </div>
                )}
              </div>

              <div>
                {statusData.subscription?.currentPeriodEnd && (
                  <>
                    <div className="text-xs font-bold uppercase tracking-wider text-[#C27A8A] mb-1">
                      {t.billing.currentPeriodLabel}
                    </div>
                    <div className="text-sm text-[#2D2523]">
                      …{" "}
                      {new Date(statusData.subscription.currentPeriodEnd).toLocaleDateString()}
                    </div>
                  </>
                )}
                {statusData.stripeCustomerPresent && (
                  <button
                    type="button"
                    onClick={openPortal}
                    disabled={portalLoading || !stripeConfigured}
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#C27A8A] text-white text-sm font-semibold hover:bg-[#b06a79] disabled:opacity-60 transition-colors"
                  >
                    <CreditCard className="w-4 h-4" />
                    {t.billing.manageBilling}
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Notices */}
        {isComplimentary && (
          <Notice
            icon={<ShieldCheck className="w-4 h-4" />}
            tone="info"
            text={t.billing.complimentaryNotice}
          />
        )}
        {inGracePeriod && (
          <Notice
            icon={<AlertTriangle className="w-4 h-4" />}
            tone="warning"
            text={t.billing.paymentFailedNotice}
          />
        )}
        {suspended && !isComplimentary && (
          <Notice
            icon={<AlertTriangle className="w-4 h-4" />}
            tone="danger"
            text={t.billing.suspendedNotice}
          />
        )}
        {!stripeConfigured && (
          <Notice
            icon={<AlertTriangle className="w-4 h-4" />}
            tone="warning"
            text={t.billing.stripeUnavailable}
          />
        )}

        {/* Plans */}
        {!isComplimentary && (
          <section>
            <h2 className="text-xl font-extrabold text-[#2D2523] mb-4">
              {t.billing.choosePlanHeading}
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              {PLAN_ORDER.map((key) => {
                const plan = plansByKey.get(key);
                if (!plan) return null;
                const isCurrent = statusData?.plan?.key === plan.key;
                const inflight = checkout.isPending && pendingPlan === plan.key;
                return (
                  <article
                    key={plan.key}
                    className="bg-white rounded-2xl border border-[#F0E4E1] shadow-sm p-6 flex flex-col"
                  >
                    <header className="mb-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-extrabold text-[#2D2523]">{plan.label}</h3>
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-full bg-[#FCEEF1] border border-[#F0E4E1] text-[#C27A8A] text-xs font-bold uppercase tracking-wide">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-2xl font-extrabold text-[#2D2523]">
                        ${plan.priceUsdMonthly}
                        <span className="text-sm font-medium text-[#877870]">
                          {t.billing.pricePerMonth}
                        </span>
                      </p>
                      <p className="text-sm text-[#877870]">
                        {t.billing.notesPerPeriod.replace("{count}", String(plan.savedNotesQuota))}
                      </p>
                    </header>
                    <ul className="space-y-2 mb-6 flex-1">
                      <FeatureRow text={`Up to ${plan.savedNotesQuota} saved notes / month`} />
                      <FeatureRow text="All clinical compliance checks" />
                      <FeatureRow text="Stripe-managed invoices and receipts" />
                      {trialDays > 0 && (
                        <FeatureRow text={`${trialDays}-day free trial (card required)`} />
                      )}
                    </ul>
                    {!plan.available ? (
                      <p className="text-sm text-[#877870] italic">{t.billing.planUnavailable}</p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startCheckout(plan.key)}
                        disabled={
                          inflight || !stripeConfigured || isCurrent || checkout.isPending
                        }
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#C27A8A] text-white text-sm font-semibold hover:bg-[#b06a79] disabled:opacity-60 transition-colors"
                      >
                        {inflight
                          ? t.common.loading
                          : isCurrent
                            ? t.billing.manageBilling
                            : trialDays > 0
                              ? t.billing.startTrial
                              : t.billing.subscribe}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function FeatureRow({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-sm text-[#2D2523]">
      <Check className="w-4 h-4 mt-0.5 text-[#C27A8A] shrink-0" />
      <span>{text}</span>
    </li>
  );
}

function Notice({
  icon,
  tone,
  text,
}: {
  icon: React.ReactNode;
  tone: "info" | "warning" | "danger";
  text: string;
}) {
  const palette =
    tone === "danger"
      ? { bg: "#FEF2F2", border: "#FCA5A5", color: "#991B1B" }
      : tone === "warning"
        ? { bg: "#FFFBEB", border: "#FCD34D", color: "#92400E" }
        : { bg: "#F0F9FF", border: "#7DD3FC", color: "#075985" };
  return (
    <div
      className="mb-6 rounded-xl px-4 py-3 flex items-start gap-3"
      style={{ background: palette.bg, border: `1px solid ${palette.border}`, color: palette.color }}
    >
      <div className="mt-0.5">{icon}</div>
      <p className="text-sm font-medium">{text}</p>
    </div>
  );
}
