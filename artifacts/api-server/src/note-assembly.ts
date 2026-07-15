/**
 * Locked opening/closing prose for session notes.
 * Source of truth for wording: .cursor/rules/aba-note-locked-prose.mdc
 */

import type { TherapistTrialSummaryForHourEntry } from "./note-validation";
import type { TherapySetting } from "@workspace/therapy-settings";
import { therapySettingLocationPhrase } from "@workspace/therapy-settings";
import {
  filterReinforcementPreferencesForNote,
  isGenericPreferredToysLabel,
} from "./reinforcer-preferences";

export type { TherapySetting };
export { therapySettingLocationPhrase };

/** Trim stray punctuation from intake present-people labels (e.g. "Maternal uncle)"). */
export function normalizePresentPersonLabel(raw: string): string {
  return raw
    .trim()
    .replace(/^[\s,;:([]+/g, "")
    .replace(/[\s,;:)\]]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatCaregiverList(presentPeople: string[]): string {
  const p = [
    ...new Set(
      presentPeople
        .map((s) => normalizePresentPersonLabel(s))
        .filter((s) => s.length > 0),
    ),
  ];
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

/**
 * True when a reinforcement-preference string is itself a caregiver/family role label
 * (e.g. "Maternal uncle", "Mother") rather than an item/activity that merely mentions
 * family wording (e.g. "Mom's music videos"). People are never reinforcers in locked closing.
 */
export function isCaregiverOrPersonRolePreference(name: string): boolean {
  const n = normalizePresentPersonLabel(name).toLowerCase();
  if (!n) return false;
  // Exact role labels (e.g. Mother, Maternal uncle).
  if (
    /^(?:the\s+)?(?:caregiver|caregivers|parents?|guardians?|mother|father|mom|dad|mommy|daddy|stepmother|stepfather|grandmother|grandfather|grandma|grandpa|aunt|uncle|cousin|siblings?|brother|sister|(?:maternal|paternal)\s+(?:uncle|aunt|grandmother|grandfather)|family members?)$/i.test(
      n,
    )
  ) {
    return true;
  }
  // Compound presence labels from intake / BIP dumps (e.g. "Mother / Caregiver").
  if (
    /^(?:mother|father|mom|dad|caregiver|parent|guardian)(?:\s*\/\s*(?:mother|father|mom|dad|caregiver|parent|guardian))+$/i.test(
      n,
    )
  ) {
    return true;
  }
  // Person-contact / person-owned gadgets are not usable closing reinforcers.
  if (/^(?:hugs?|kisses?)\b/i.test(n)) return true;
  if (/\b(?:mother'?s|father'?s|mom'?s|dad'?s|caregiver'?s)\s+phone\b/i.test(n)) return true;
  return false;
}

function formatReinforcerPreferenceList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/**
 * Mandatory closing paragraph. When the assessment summary includes reinforcementPreferences,
 * lists those concrete BIP items (minus praise-like tokens). Always uses plain **praise** in the
 * praise clause — never "social praise", "verbal praise", or "behavior-specific praise" (external
 * reviewers misread those compounds as catalog intervention names).
 *
 * Filters YouTube when the client is under 14, omits umbrella "Preferred toys" when more
 * specific toy preferences are on file, and drops caregiver/person roles and BIP dump lines.
 */
export function buildLockedClosingParagraph(
  reinforcementPreferences?: string[] | null,
  options?: { clientAgeYears?: number | null },
): string {
  const prefs = filterReinforcementPreferencesForNote(reinforcementPreferences, {
    clientAgeYears: options?.clientAgeYears,
  });
  if (prefs.length === 0) {
    return LOCKED_CLOSING_PARAGRAPH;
  }

  const tangibleItems = prefs
    .filter(
      (p) =>
        !isPraiseLikePreference(p) &&
        !isCaregiverOrPersonRolePreference(p) &&
        // Alone, the umbrella label is not a usable closing example — fall back to generic wording.
        !isGenericPreferredToysLabel(p),
    )
    .slice(0, MAX_REINFORCER_ITEMS_IN_CLOSING);

  const itemsClause =
    tangibleItems.length > 0
      ? `access to preferred items and activities documented for this client (e.g., ${formatReinforcerPreferenceList(tangibleItems)})`
      : "access to individualized preferred items and activities identified in the client's reinforcement system";

  return `Throughout the session, the RBT used various reinforcers, including ${PRAISE_EXAMPLE} and ${itemsClause}, contingent on task completion and appropriate behavior. ${LOCKED_CLOSING_TAIL}`;
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
