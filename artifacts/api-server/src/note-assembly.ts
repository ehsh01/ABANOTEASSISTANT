/**
 * Locked opening/closing prose for session notes.
 * Source of truth for wording: .cursor/rules/aba-note-locked-prose.mdc
 */

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

export function buildPerformanceSentence(): string {
  return "The client's performance during the session was fair.";
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
