import { useState } from "react";
import { X } from "lucide-react";
import { useLocation, Link } from "wouter";
import { useBillingStatus } from "@/hooks/use-aba-api";
import { useT } from "@/hooks/use-translation";

const TRIAL_NOTE_CAP = 15;

export function TrialBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [location] = useLocation();
  const t = useT();
  const statusQuery = useBillingStatus();

  const statusData = statusQuery.data?.data;

  if (dismissed) return null;
  if (!statusData) return null;
  if (statusData.billingMode !== "trial") return null;
  if (location === "/billing" || location === "/pricing") return null;

  const quota = statusData.savedQuota ?? TRIAL_NOTE_CAP;
  const used = statusData.savedThisPeriod ?? 0;
  const notesLeft = Math.max(0, quota - used);

  const daysLeft =
    statusData.trialEndsAt
      ? Math.max(
          0,
          Math.ceil(
            (new Date(statusData.trialEndsAt).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : null;

  const urgentDays = daysLeft !== null && daysLeft <= 3;
  const urgentNotes = notesLeft <= 3;
  const isUrgent = urgentDays || urgentNotes;

  const bannerText =
    t.billing.trial.banner
      .replace("{days}", daysLeft !== null ? String(daysLeft) : "?")
      .replace("{notes}", String(notesLeft));

  const bg = isUrgent ? "#FEF2F2" : "#FFFBEB";
  const border = isUrgent ? "#FCA5A5" : "#FCD34D";
  const color = isUrgent ? "#991B1B" : "#92400E";

  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium"
      style={{ background: bg, border: `0 0 1px 0`, borderBottom: `1px solid ${border}`, color }}
    >
      <span>
        {bannerText}{" "}
        <Link
          href="/billing"
          className="underline font-semibold hover:opacity-80 transition-opacity"
        >
          {t.billing.trial.choosePlan}
        </Link>
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded p-0.5 hover:opacity-70 transition-opacity"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
