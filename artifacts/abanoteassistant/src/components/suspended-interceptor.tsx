import { useMemo, useState } from "react";
import { useLocation, Link } from "wouter";
import { Check, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/hooks/use-translation";
import {
  useBillingPlans,
  useCreateBillingCheckout,
} from "@/hooks/use-aba-api";
import type { BillingPlanKey } from "@workspace/api-client-react";

const PLAN_ORDER: BillingPlanKey[] = ["starter", "growth", "high"];

interface SuspendedInterceptorProps {
  blockedReason?: string | null;
}

export function SuspendedInterceptor({ blockedReason }: SuspendedInterceptorProps) {
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

  async function startCheckout(planKey: BillingPlanKey) {
    if (!stripeConfigured) {
      toast({
        title: t.billing.trial.billingUnavailableToast,
        variant: "destructive",
      });
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

  const reason =
    blockedReason ??
    "This account is not on an active subscription. Choose a plan to continue generating and saving notes.";

  return (
    <div className="min-h-screen bg-[#FDE8EE] flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-3xl">
        {/* Block card */}
        <div className="bg-white rounded-2xl border border-[#F0E4E1] shadow-sm p-8 mb-8 text-center">
          <div className="w-12 h-12 rounded-full bg-[#FCEEF1] flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-[#C27A8A]" />
          </div>
          <h2 className="text-2xl font-extrabold text-[#2D2523] mb-3">
            {t.billing.trial.blockedTitle}
          </h2>
          <p className="text-[#877870] max-w-lg mx-auto leading-relaxed">{reason}</p>
          <div className="mt-4 flex items-center justify-center gap-4 text-sm text-[#877870]">
            <Link href="/clients" className="hover:text-[#C27A8A] transition-colors underline">
              View clients
            </Link>
            <span>·</span>
            <Link href="/notes" className="hover:text-[#C27A8A] transition-colors underline">
              View notes
            </Link>
            <span>·</span>
            <button
              type="button"
              onClick={() => setLocation("/billing")}
              className="hover:text-[#C27A8A] transition-colors underline"
            >
              Billing
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <h3 className="text-lg font-extrabold text-[#2D2523] mb-4 text-center">
          {t.billing.trial.choosePlanToContinue}
        </h3>

        {!stripeConfigured && !plansQuery.isLoading && (
          <div
            className="mb-6 rounded-xl px-4 py-3 flex items-start gap-3"
            style={{ background: "#FFFBEB", border: "1px solid #FCD34D", color: "#92400E" }}
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <p className="text-sm font-medium">{t.billing.stripeUnavailable}</p>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-4">
          {plansQuery.isLoading
            ? [1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-[#F0E4E1] h-52 animate-pulse"
                />
              ))
            : PLAN_ORDER.map((key) => {
                const plan = plansData?.plans.find((p) => p.key === key);
                if (!plan) return null;
                const inflight = checkout.isPending && pendingPlan === key;
                return (
                  <article
                    key={key}
                    className="bg-white rounded-2xl border border-[#F0E4E1] shadow-sm p-5 flex flex-col"
                  >
                    <h4 className="font-extrabold text-[#2D2523] mb-1">{plan.label}</h4>
                    <p className="text-2xl font-extrabold text-[#2D2523]">
                      ${plan.priceUsdMonthly}
                      <span className="text-xs font-medium text-[#877870]">
                        {t.billing.pricePerMonth}
                      </span>
                    </p>
                    <p className="text-xs text-[#877870] mb-4">
                      {t.billing.notesPerPeriod.replace(
                        "{count}",
                        String(plan.savedNotesQuota),
                      )}
                    </p>
                    <ul className="space-y-1.5 mb-4 flex-1">
                      <MiniFeature text={`${plan.savedNotesQuota} notes / month`} />
                      <MiniFeature text="All compliance checks" />
                    </ul>
                    {!plan.available ? (
                      <p className="text-xs text-[#877870] italic">{t.billing.planUnavailable}</p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startCheckout(plan.key)}
                        disabled={inflight || checkout.isPending || !stripeConfigured}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#C27A8A] text-white text-sm font-semibold hover:bg-[#b06a79] disabled:opacity-60 transition-colors"
                      >
                        {inflight ? t.common.loading : t.billing.subscribe}
                      </button>
                    )}
                  </article>
                );
              })}
        </div>
      </div>
    </div>
  );
}

function MiniFeature({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-1.5 text-xs text-[#2D2523]">
      <Check className="w-3.5 h-3.5 mt-0.5 text-[#C27A8A] shrink-0" />
      <span>{text}</span>
    </li>
  );
}
