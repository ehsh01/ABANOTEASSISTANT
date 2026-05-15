import { useMemo, useState } from "react";
import { useLocation, Link } from "wouter";
import { Check, Sparkles, ArrowLeft, AlertTriangle } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useT } from "@/hooks/use-translation";
import { useToast } from "@/hooks/use-toast";
import {
  useBillingPlans,
  useCreateBillingCheckout,
} from "@/hooks/use-aba-api";
import type { BillingPlanKey } from "@workspace/api-client-react";

const PLAN_ORDER: BillingPlanKey[] = ["starter", "growth", "high"];

export default function PricingPage() {
  const token = useAuthStore((s) => s.token);
  const t = useT();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [pendingPlan, setPendingPlan] = useState<BillingPlanKey | null>(null);

  const plansQuery = useBillingPlans();
  const checkout = useCreateBillingCheckout();

  const baseUrl = useMemo(() => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    return `${origin}${base}`;
  }, []);

  const plansData = plansQuery.data?.data;
  const stripeConfigured = plansData?.stripeConfigured ?? false;
  const trialDays = plansData?.trialDays ?? 14;

  async function handleSubscribe(planKey: BillingPlanKey) {
    if (!stripeConfigured) {
      toast({
        title: t.billing.trial.billingUnavailableToast,
        variant: "destructive",
      });
      return;
    }
    if (!token) {
      setLocation(`/register?plan=${planKey}`);
      return;
    }
    setPendingPlan(planKey);
    try {
      const res = await checkout.mutateAsync({
        plan: planKey,
        successUrl: `${baseUrl}/billing?status=success`,
        cancelUrl: `${baseUrl}/billing?status=canceled`,
      });
      if (res?.data?.url) {
        window.location.href = res.data.url;
        return;
      }
      toast({ title: t.common.error, variant: "destructive" });
    } catch {
      toast({
        title: t.billing.trial.billingUnavailableToast,
        variant: "destructive",
      });
    } finally {
      setPendingPlan(null);
    }
  }

  const subhead = t.billing.trial.pricingSubhead.replace(
    "{days}",
    String(trialDays),
  );

  return (
    <div className="min-h-screen bg-[#FDE8EE]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#F0E4E1]/60 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 flex items-center justify-center">
              <div
                className="absolute inset-0 rounded-lg shadow-[0_4px_10px_rgba(194,122,138,0.25)]"
                style={{
                  background: "linear-gradient(135deg, #e6b3c0 0%, #C27A8A 100%)",
                }}
              />
              <Sparkles className="w-4 h-4 text-white relative z-10" />
            </div>
            <span className="font-extrabold text-base tracking-widest text-[#2D2523] uppercase">
              ABANOTEASSISTANT
            </span>
          </div>
          <button
            type="button"
            onClick={() => setLocation(token ? "/" : "/login")}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#F0E4E1] text-[#877870] text-sm font-semibold hover:bg-white/60 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {token ? t.billing.backToDashboard : "Back"}
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-14">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold text-[#2D2523] mb-4">
            {t.billing.trial.pricingHeader}
          </h1>
          <p className="text-lg text-[#877870] max-w-xl mx-auto">{subhead}</p>
          <p className="mt-2 text-sm text-[#C27A8A] font-semibold">
            {t.billing.trial.noCardRequired}
          </p>
        </header>

        {/* Plans unavailable notice */}
        {!stripeConfigured && !plansQuery.isLoading && (
          <div
            className="mb-8 rounded-xl px-4 py-3 flex items-start gap-3 max-w-xl mx-auto"
            style={{
              background: "#FFFBEB",
              border: "1px solid #FCD34D",
              color: "#92400E",
            }}
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="text-sm font-medium">
              {t.billing.trial.plansLaunchingSoon} —{" "}
              {t.billing.stripeUnavailable}
            </p>
          </div>
        )}

        {/* Plan cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {plansQuery.isLoading
            ? [1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-[#F0E4E1] shadow-sm p-6 h-72 animate-pulse"
                />
              ))
            : PLAN_ORDER.map((key) => {
                const plan = plansData?.plans.find((p) => p.key === key);
                if (!plan) return null;
                const inflight = checkout.isPending && pendingPlan === key;
                const canSubscribe = stripeConfigured && plan.available;

                return (
                  <article
                    key={key}
                    className="bg-white rounded-2xl border border-[#F0E4E1] shadow-sm p-6 flex flex-col relative"
                  >
                    {key === "growth" && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#C27A8A] text-white text-xs font-bold uppercase tracking-wide shadow">
                        Most Popular
                      </div>
                    )}

                    <header className="mb-5">
                      <h3 className="text-xl font-extrabold text-[#2D2523]">
                        {plan.label}
                      </h3>
                      <p className="mt-2 text-3xl font-extrabold text-[#2D2523]">
                        ${plan.priceUsdMonthly}
                        <span className="text-sm font-medium text-[#877870]">
                          {t.billing.pricePerMonth}
                        </span>
                      </p>
                      <p className="text-sm text-[#877870] mt-1">
                        {t.billing.notesPerPeriod.replace(
                          "{count}",
                          String(plan.savedNotesQuota),
                        )}
                      </p>
                    </header>

                    <ul className="space-y-2 mb-6 flex-1">
                      <FeatureRow
                        text={`Up to ${plan.savedNotesQuota} saved notes / month`}
                      />
                      <FeatureRow text="All clinical compliance checks" />
                      <FeatureRow text="Stripe-managed invoices & receipts" />
                      <FeatureRow
                        text={`${trialDays}-day free trial — no card required`}
                      />
                    </ul>

                    {!canSubscribe ? (
                      <p className="text-sm text-[#877870] italic text-center">
                        {stripeConfigured
                          ? t.billing.planUnavailable
                          : t.billing.trial.plansLaunchingSoon}
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSubscribe(plan.key)}
                        disabled={inflight || checkout.isPending}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#C27A8A] text-white text-sm font-semibold hover:bg-[#b06a79] disabled:opacity-60 transition-colors"
                      >
                        {inflight
                          ? t.common.loading
                          : t.billing.trial.startFreeTrial}
                      </button>
                    )}
                  </article>
                );
              })}
        </div>

        {/* Footer links */}
        <div className="mt-12 text-center text-sm text-[#877870] space-x-4">
          <Link href="/login" className="hover:text-[#C27A8A] transition-colors">
            Sign in
          </Link>
          <span>·</span>
          <Link
            href="/register"
            className="hover:text-[#C27A8A] transition-colors"
          >
            Create account
          </Link>
        </div>
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
