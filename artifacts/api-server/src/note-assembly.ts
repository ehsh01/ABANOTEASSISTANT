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

/** @param clientName First name only (product policy: no last name in session notes). */
export function buildLockedOpening(
  clientName: string,
  presentPeople: string[],
  hasEnvironmentalChanges: boolean,
  therapySetting: TherapySetting,
): string {
  const caregivers = formatCaregiverList(presentPeople);
  const env = environmentalOpeningSentence(hasEnvironmentalChanges);
  const where = therapySettingLocationPhrase(therapySetting);
  return `The RBT met with ${clientName} and ${caregivers} ${where} to implement program targets. ${env}`;
}

/** @param clientName First name only (matches locked-opening policy). */
export function buildPerformanceSentence(clientName: string): string {
  return `${clientName}'s performance during the session was fair.`;
}

/** @param clientName First name only (matches locked-opening policy). */
export function buildNextSessionSentence(clientName: string, nextSessionDate: string | undefined): string {
  const possessive = `${clientName}'s`;
  if (nextSessionDate && nextSessionDate.trim().length > 0) {
    const formatted = formatUsDateFromIso(nextSessionDate);
    return `The next session is tentatively scheduled to take place at ${possessive} home on ${formatted}.`;
  }
  return `The next session is tentatively scheduled to take place at ${possessive} home; the date is to be determined.`;
}
