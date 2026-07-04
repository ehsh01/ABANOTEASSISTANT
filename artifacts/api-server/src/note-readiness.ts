/**
 * Per-client data-readiness report for note generation.
 *
 * Note accuracy depends on client data the RBT provides at onboarding: behavior functions
 * (drives function-matched interventions/replacements), behavior topography (observable
 * definitions in ABC paragraphs), behavior→replacement maps (strongest pairing lever), and the
 * assessment text snapshot (grounds the AI body in the real BIP). This module reports which of
 * those are missing so the wizard can warn before generating.
 */

import type { ClientProfileRow } from "@workspace/db/schema";
import { expandMaladaptiveTargetsFromProfile } from "./client-profile-maladaptive";
import { getAssessmentStructuredFromProfile } from "./assessment-structured";
import { MAX_ASSESSMENT_TEXT_NOTE_CONTEXT_CHARS } from "./assessment-extract";

export type NoteReadinessReport = {
  ready: boolean;
  behaviorsMissingFunctions: string[];
  behaviorsMissingTopography: string[];
  behaviorsMissingReplacementMap: string[];
  assessmentTextMissing: boolean;
  assessmentTextTruncatedForPrompt: boolean;
  messages: string[];
};

export function buildNoteReadinessReport(profile: ClientProfileRow): NoteReadinessReport {
  const targets = expandMaladaptiveTargetsFromProfile(profile);

  const behaviorsMissingFunctions = targets
    .filter((t) => !t.functions || t.functions.length === 0)
    .map((t) => t.name);
  const behaviorsMissingTopography = targets
    .filter((t) => !t.topography || t.topography.trim().length === 0)
    .map((t) => t.name);

  const structured = getAssessmentStructuredFromProfile(profile);
  const replMap = structured?.behavior_to_replacements_map ?? {};
  const mappedLower = new Set(
    Object.entries(replMap)
      .filter(([, v]) => (v ?? []).length > 0)
      .map(([k]) => k.trim().toLowerCase()),
  );
  const behaviorsMissingReplacementMap = targets
    .filter((t) => !mappedLower.has(t.name.trim().toLowerCase()))
    .map((t) => t.name);

  const snapshot = profile.assessmentTextSnapshot?.trim() ?? "";
  const assessmentTextMissing = snapshot.length === 0;
  const assessmentTextTruncatedForPrompt = snapshot.length > MAX_ASSESSMENT_TEXT_NOTE_CONTEXT_CHARS;

  const messages: string[] = [];
  if (behaviorsMissingFunctions.length > 0) {
    messages.push(
      `Behavior function not on file for: ${behaviorsMissingFunctions.join(", ")}. Function-matched interventions and replacement programs cannot be enforced for these behaviors.`,
    );
  }
  if (behaviorsMissingTopography.length > 0) {
    messages.push(
      `Operational definition (topography) missing for: ${behaviorsMissingTopography.join(", ")}. ABC paragraphs may not match the BIP definitions.`,
    );
  }
  if (behaviorsMissingReplacementMap.length > 0) {
    messages.push(
      `No behavior-to-replacement-program mapping for: ${behaviorsMissingReplacementMap.join(", ")}. Program pairing falls back to function heuristics. Re-uploading the assessment PDF can auto-extract these mappings.`,
    );
  }
  if (assessmentTextMissing) {
    messages.push(
      "No assessment text is on file for this client. Upload the assessment PDF so note generation can reference the real BIP.",
    );
  } else if (assessmentTextTruncatedForPrompt) {
    messages.push(
      "The stored assessment text is longer than the excerpt used during generation; late document sections may not be visible to the AI.",
    );
  }

  return {
    ready: messages.length === 0,
    behaviorsMissingFunctions,
    behaviorsMissingTopography,
    behaviorsMissingReplacementMap,
    assessmentTextMissing,
    assessmentTextTruncatedForPrompt,
    messages,
  };
}
