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

/** Below this threshold, parser output is not meaningful clinical grounding (usually a scanned PDF without OCR). */
export const MIN_USABLE_ASSESSMENT_TEXT_CHARS = 80;

export function hasUsableAssessmentText(profile: ClientProfileRow | null | undefined): boolean {
  return (profile?.assessmentTextSnapshot?.trim().length ?? 0) >= MIN_USABLE_ASSESSMENT_TEXT_CHARS;
}

export type AssessmentGenerationGateResult =
  | { ok: true }
  | { ok: false; status: 422; error: string; messages: string[] };

/** Strict shared gate for synchronous and queued note generation. */
export function assessmentGenerationGate(params: {
  hasAssessment: boolean;
  assessmentStatus: string;
  profile: ClientProfileRow | null | undefined;
}): AssessmentGenerationGateResult {
  if (!params.hasAssessment || params.assessmentStatus === "missing") {
    return {
      ok: false,
      status: 422,
      error: "Assessment required",
      messages: [
        "This client does not have an assessment on file. Upload an assessment (e.g. FBA/BIP PDF) for the client before generating session notes.",
      ],
    };
  }
  if (!hasUsableAssessmentText(params.profile)) {
    return {
      ok: false,
      status: 422,
      error: "Usable assessment text required",
      messages: [
        `The uploaded assessment does not contain enough readable text for grounded note generation (minimum ${MIN_USABLE_ASSESSMENT_TEXT_CHARS} characters). If the PDF is scanned or image-only, run OCR or export a PDF with a selectable text layer, then upload it again.`,
      ],
    };
  }
  if (params.assessmentStatus !== "ready") {
    return {
      ok: false,
      status: 422,
      error: "Assessment is not ready",
      messages: [
        "The assessment upload has not completed successfully. Re-upload a readable PDF with a text layer before generating session notes.",
      ],
    };
  }
  return { ok: true };
}

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
  const assessmentTextMissing = snapshot.length < MIN_USABLE_ASSESSMENT_TEXT_CHARS;
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
      `No usable assessment text is on file for this client. Upload a readable assessment PDF with at least ${MIN_USABLE_ASSESSMENT_TEXT_CHARS} characters of selectable text; scanned/image-only PDFs require OCR before upload.`,
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
