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

const LOCKED_CLOSING_TAIL =
  "There were no health or safety concerns during the visit. The RBT will continue working with the client as outlined in the Behavior Plan. All data on maladaptive behaviors and progress in program implementation was collected during the session in accordance with the BIP. The session was completed as planned.";

const PRAISE_EXAMPLE =
  'praise (e.g., "Good job," "Wow," and "Good attention to detail")';

/**
 * Fallback locked closing when the client has no reinforcementPreferences on file.
 * Uses plain "praise" (reinforcer wording)—never a compound label that reviewers misread as a
 * catalog intervention (e.g. "behavior-specific praise", "verbal praise").
 */
export const LOCKED_CLOSING_PARAGRAPH =
  `Throughout the session, the RBT used various reinforcers, including ${PRAISE_EXAMPLE} and access to individualized preferred items and activities identified in the client's reinforcement system, contingent on task completion and appropriate behavior. ${LOCKED_CLOSING_TAIL}`;

const MAX_REINFORCER_ITEMS_IN_CLOSING = 8;

function isPraiseLikePreference(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (!n) return false;
  return (
    /^(social )?praise$/.test(n) ||
    /^verbal praise$/.test(n) ||
    /^behavior-specific praise$/.test(n) ||
    /^contingent praise$/.test(n)
  );
}

function formatReinforcerPreferenceList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/**
 * Mandatory closing paragraph. When the assessment summary includes reinforcementPreferences,
 * lists those concrete BIP items (minus praise-like tokens) and uses "social praise" when that
 * preference is documented—so the note does not invent a praise/intervention label or a generic
 * "reinforcement system" without named reinforcers.
 */
export function buildLockedClosingParagraph(
  reinforcementPreferences?: string[] | null,
): string {
  const prefs = [...new Set((reinforcementPreferences ?? []).map((s) => s.trim()).filter(Boolean))];
  if (prefs.length === 0) {
    return LOCKED_CLOSING_PARAGRAPH;
  }

  const hasSocialPraise = prefs.some((p) => /^social praise$/i.test(p.trim()));
  const tangibleItems = prefs
    .filter((p) => !isPraiseLikePreference(p))
    .slice(0, MAX_REINFORCER_ITEMS_IN_CLOSING);

  // Prefer BIP wording "social praise" when on file; otherwise plain "praise" (not compound labels).
  const praiseClause = hasSocialPraise
    ? 'social praise (e.g., "Good job," "Wow," and "Good attention to detail")'
    : PRAISE_EXAMPLE;

  const itemsClause =
    tangibleItems.length > 0
      ? `access to preferred items and activities documented for this client (e.g., ${formatReinforcerPreferenceList(tangibleItems)})`
      : "access to individualized preferred items and activities identified in the client's reinforcement system";

  return `Throughout the session, the RBT used various reinforcers, including ${praiseClause} and ${itemsClause}, contingent on task completion and appropriate behavior. ${LOCKED_CLOSING_TAIL}`;
}

/** Used when the client profile has no first name for locked opening lines. */
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
 * Kept for callers that still need setting phrases; locked opening no longer inserts a meeting place.
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

/**
 * Locked opening: client + caregivers + "to implement program targets" — no session meeting place.
 * `therapySetting` is retained for call-site compatibility; it is not written into the opening.
 */
export function buildLockedOpening(
  presentPeople: string[],
  hasEnvironmentalChanges: boolean,
  _therapySetting: TherapySetting,
  clientFirstName?: string | null,
): string {
  const caregivers = formatCaregiverList(presentPeople);
  const env = environmentalOpeningSentence(hasEnvironmentalChanges);
  const trimmed = clientFirstName?.trim() ?? "";
  const who = trimmed.length > 0 ? trimmed : SESSION_NOTE_CLIENT_REFERRAL;
  return `The RBT met with ${who} and ${caregivers} to implement program targets. ${env}`;
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

function buildPerformanceSentenceWithoutTrialAggregate(programSlotCount: number): string {
  const n = Math.max(1, Math.floor(programSlotCount));
  const programsWord = n === 1 ? "program" : "programs";
  // Do not state that trial data was missing or that a percentage could not be computed.
  return `The client completed ${n} ${programsWord}.`;
}

/**
 * End-of-note performance line after the mandatory closing paragraph.
 * `programSlotCount` = number of replacement-program narrative segments for this session (aligned with
 * `replacementProgramSlotCount(sessionHours)` / collapsed narrative segments).
 *
 * When therapist-entered discrete trials exist for at least one narrative segment, emits one fixed qualitative
 * sentence (no session-wide percent on this line). Per-hour ABC text still carries trial percentages where required
 * by validation. When no trial rows qualify, uses the program-count fallback only (no missing-data apology).
 *
 * Learner reference matches the locked opening: client profile **first name** when non-empty after trim; otherwise
 * **The client** (sentence-initial capitalization for the generic referral).
 */
export function buildPerformanceSentence(
  programSlotCount: number,
  therapistTrialSummaryForReplacementHour?: TherapistTrialSummaryForHourEntry[] | undefined,
  clientFirstName?: string | null,
): string {
  const agg = aggregateTherapistTrialSummariesForPerformanceLine(therapistTrialSummaryForReplacementHour);
  if (!agg) {
    return buildPerformanceSentenceWithoutTrialAggregate(programSlotCount);
  }
  const trimmed = clientFirstName?.trim() ?? "";
  const who = trimmed.length > 0 ? trimmed : "The client";
  return `${who} participated in session activities with inconsistent responding and required prompting across tasks.`;
}

export function buildNextSessionSentence(nextSessionDate: string | undefined): string {
  if (nextSessionDate && nextSessionDate.trim().length > 0) {
    const formatted = formatUsDateFromIso(nextSessionDate);
    return `The next session is tentatively scheduled for ${formatted}.`;
  }
  return `The next session is tentatively scheduled; the date is to be determined.`;
}
