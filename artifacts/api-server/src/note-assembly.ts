/**
 * Locked opening/closing prose for session notes.
 * Source of truth for wording: .cursor/rules/aba-note-locked-prose.mdc
 */

import type { TherapistTrialSummaryForHourEntry } from "./note-validation";
import type { TherapySetting } from "@workspace/therapy-settings";
import { therapySettingLocationPhrase } from "@workspace/therapy-settings";

export type { TherapySetting };
export { therapySettingLocationPhrase };

export function formatCaregiverList(presentPeople: string[]): string {
  const p = presentPeople.map((s) => s.trim()).filter(Boolean);
  if (p.length === 0) return "the caregiver";
  if (p.length === 1) return p[0]!;
  if (p.length === 2) return `${p[0]} and ${p[1]}`;
  return `${p.slice(0, -1).join(", ")}, and ${p[p.length - 1]}`;
}

export function environmentalOpeningSentence(hasEnvironmentalChanges: boolean): string {
  if (hasEnvironmentalChanges) {
    return "There have been environmental changes recently.";
  }
  return "There have been no environmental changes recently.";
}

/** Expects yyyy-MM-dd; returns MM/DD/YYYY for next-session line. */
export function formatUsDateFromIso(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return iso.trim();
  const [, y, mo, d] = m;
  return `${mo}/${d}/${y}`;
}

/** Verbatim mandatory closing paragraph (do not paraphrase). */
export const LOCKED_CLOSING_PARAGRAPH =
  'Throughout the session, the RBT used various reinforcers, including verbal praise (e.g., "Good job," "Wow," and "Good attention to detail"), preferred toys, and videos contingent on task completion and appropriate behavior. There were no health or safety concerns during the visit. The RBT will continue working with the client as outlined in the Behavior Plan. All data on maladaptive behaviors and progress in program implementation was collected during the session in accordance with the BIP. The session was completed as planned.';

/** Used when the client profile has no first name for locked opening / location lines. */
export const SESSION_NOTE_CLIENT_REFERRAL = "the client";

/** English possessive for first name in locked prose (e.g. Alex → Alex's, James → James'). */
export function englishPossessiveFirstName(firstName: string): string {
  const t = firstName.trim();
  if (t.length === 0) return "the client's";
  return /s$/i.test(t) ? `${t}'` : `${t}'s`;
}

/**
 * Applies the client's first name to catalog location phrases that refer to the learner's home
 * (e.g. "at home" → "at Sam's home"). Non-home phrases are unchanged.
 */
export function personalizeTherapyLocationPhrase(
  therapySetting: TherapySetting,
  clientFirstName: string | null | undefined,
): string {
  const base = therapySettingLocationPhrase(therapySetting);
  const trimmed = clientFirstName?.trim() ?? "";
  if (trimmed.length === 0) return base;

  const poss = englishPossessiveFirstName(trimmed);
  let s = base;
  if (s.includes("at the member's home")) {
    s = s.replaceAll("at the member's home", `at ${poss} home`);
  }
  if (s.includes("at a family home")) {
    s = s.replaceAll("at a family home", `at ${poss} family home`);
  }
  s = s.replace(/\bat home\b/g, `at ${poss} home`);
  return s;
}

export function buildLockedOpening(
  presentPeople: string[],
  hasEnvironmentalChanges: boolean,
  therapySetting: TherapySetting,
  clientFirstName?: string | null,
): string {
  const caregivers = formatCaregiverList(presentPeople);
  const env = environmentalOpeningSentence(hasEnvironmentalChanges);
  const trimmed = clientFirstName?.trim() ?? "";
  const who = trimmed.length > 0 ? trimmed : SESSION_NOTE_CLIENT_REFERRAL;
  const where =
    trimmed.length > 0
      ? personalizeTherapyLocationPhrase(therapySetting, trimmed)
      : therapySettingLocationPhrase(therapySetting);
  return `The RBT met with ${who} and ${caregivers} ${where} to implement program targets. ${env}`;
}

/**
 * Pools per-segment therapist-entered discrete-trial rows (same contract as `therapistTrialSummaryForReplacementHour`
 * after narrative collapse). Returns null when no segment has `totalTrials >= 1`.
 */
export function aggregateTherapistTrialSummariesForPerformanceLine(
  summaries: TherapistTrialSummaryForHourEntry[] | undefined,
): { successes: number; trials: number; segmentsWithData: number } | null {
  if (!summaries?.length) return null;
  let successes = 0;
  let trials = 0;
  let segmentsWithData = 0;
  for (const entry of summaries) {
    if (!entry || !Number.isFinite(entry.totalTrials) || entry.totalTrials < 1) continue;
    const rawN = Array.isArray(entry.successfulTrialNumbers) ? entry.successfulTrialNumbers.length : 0;
    if (!Number.isFinite(rawN) || rawN < 0) continue;
    const capped = Math.min(rawN, entry.totalTrials);
    successes += capped;
    trials += entry.totalTrials;
    segmentsWithData++;
  }
  if (trials < 1 || segmentsWithData < 1) return null;
  return { successes, trials, segmentsWithData };
}

/** Rounded percentage for prose; matches (successes / trials) * 100 with standard rounding. */
export function discreteTrialSuccessPercent(successes: number, trials: number): number {
  if (trials < 1) return 0;
  return Math.round((successes / trials) * 100);
}

/**
 * Clinically neutral clause tied to the computed percentage (no subjective good/fair/majority language).
 * Wording aligns with the locked end-of-note performance template (independent responding; "across all targets" where applicable).
 */
export function neutralDiscreteTrialPerformanceClause(percentRounded: number): string {
  const p = Math.max(0, Math.min(100, Math.round(percentRounded)));
  if (p <= 0) {
    return "indicating limited independent responding during recorded trials and need for intensive systematic prompting across all targets";
  }
  if (p <= 30) {
    return "indicating emerging skill acquisition and need for continued prompting across all targets";
  }
  if (p <= 50) {
    return "indicating variable acquisition with ongoing need for prompt fading across all targets";
  }
  if (p <= 70) {
    return "indicating developing consistency of independent responding with continued practice across all targets";
  }
  if (p <= 90) {
    return "indicating strong acquisition trends during recorded trials, consistent with progression toward maintenance or next-step targets across programs";
  }
  return "indicating very high rates of independent responding during recorded trials across targets";
}

function buildPerformanceSentenceWithoutTrialAggregate(programSlotCount: number): string {
  const n = Math.max(1, Math.floor(programSlotCount));
  const programsWord = n === 1 ? "program" : "programs";
  return `The client completed ${n} ${programsWord}. Discrete-trial success counts were not entered for enough narrative segments to compute a session-wide percentage from intake data; continue acquisition and behavior-reduction documentation per the Behavior Plan and session-specific data collection.`;
}

/**
 * End-of-note performance line after the mandatory closing paragraph.
 * `programSlotCount` = number of replacement-program narrative segments for this session (aligned with
 * `replacementProgramSlotCount(sessionHours)` / collapsed narrative segments).
 *
 * When `therapistTrialSummaryForReplacementHour` contains at least one segment with `totalTrials >= 1`, the line
 * states the **rounded percentage** from pooled criterion successes over recorded discrete trials (no "X out of Y trials"
 * parenthetical), plus a fixed neutral interpretation band (no subjective majority/good/fair language). Prose uses
 * **independent responding** as the product phrase; the percent still comes from therapist-entered trial JSON.
 */
export function buildPerformanceSentence(
  programSlotCount: number,
  therapistTrialSummaryForReplacementHour?: TherapistTrialSummaryForHourEntry[] | undefined,
): string {
  const agg = aggregateTherapistTrialSummariesForPerformanceLine(therapistTrialSummaryForReplacementHour);
  if (!agg) {
    return buildPerformanceSentenceWithoutTrialAggregate(programSlotCount);
  }
  const pct = discreteTrialSuccessPercent(agg.successes, agg.trials);
  const interpretation = neutralDiscreteTrialPerformanceClause(pct);
  const scopePhrase =
    agg.segmentsWithData === 1
      ? "based on recorded discrete trials for that replacement program"
      : `based on recorded discrete trials pooled across ${agg.segmentsWithData} programs`;
  return `The client demonstrated approximately ${pct}% independent responding (${scopePhrase}), ${interpretation}.`;
}

export function buildNextSessionSentence(
  nextSessionDate: string | undefined,
  clientFirstName?: string | null,
): string {
  const trimmed = clientFirstName?.trim() ?? "";
  const homePoss =
    trimmed.length > 0 ? englishPossessiveFirstName(trimmed) + " home" : "the client's home";
  if (nextSessionDate && nextSessionDate.trim().length > 0) {
    const formatted = formatUsDateFromIso(nextSessionDate);
    return `The next session is tentatively scheduled to take place at ${homePoss} on ${formatted}.`;
  }
  return `The next session is tentatively scheduled to take place at ${homePoss}; the date is to be determined.`;
}
