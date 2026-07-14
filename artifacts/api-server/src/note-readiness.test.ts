import { describe, expect, test } from "vitest";
import type { ClientProfileRow } from "@workspace/db/schema";
import {
  assessmentGenerationGate,
  buildNoteReadinessReport,
  MIN_USABLE_ASSESSMENT_TEXT_CHARS,
} from "./note-readiness";

const profile = (assessmentTextSnapshot?: string): ClientProfileRow => ({
  firstName: "Client",
  lastName: "One",
  dateOfBirth: "2018-01-01",
  gender: "Male",
  maladaptiveBehaviors: ["Task Refusal"],
  maladaptiveBehaviorTargets: [
    { name: "Task Refusal", topography: "Pushes materials away.", functions: ["escape"] },
  ],
  replacementPrograms: ["Request a break"],
  skillAcquisitionPrograms: [],
  interventions: ["DRA"],
  assessmentStructured: {
    behaviors: ["Task Refusal"],
    replacement_programs: ["Request a break"],
    interventions: ["DRA"],
    behavior_to_replacements_map: { "Task Refusal": ["Request a break"] },
    behavior_to_interventions_map: { "Task Refusal": ["DRA"] },
  },
  assessmentTextSnapshot,
});

describe("assessment text readiness", () => {
  test.each([undefined, "", "x".repeat(MIN_USABLE_ASSESSMENT_TEXT_CHARS - 1)])(
    "blocks generation for missing or unusable snapshot",
    (snapshot) => {
      const report = buildNoteReadinessReport(profile(snapshot));
      expect(report.ready).toBe(false);
      expect(report.assessmentTextMissing).toBe(true);

      const gate = assessmentGenerationGate({
        hasAssessment: true,
        assessmentStatus: "ready",
        profile: profile(snapshot),
      });
      expect(gate.ok).toBe(false);
      if (!gate.ok) {
        expect(gate.status).toBe(422);
        expect(gate.messages.join(" ")).toMatch(/OCR|text layer/i);
      }
    },
  );

  test("accepts a meaningful stored snapshot", () => {
    const snapshot = "Behavior intervention plan with meaningful clinical text. ".repeat(3);
    expect(snapshot.length).toBeGreaterThanOrEqual(MIN_USABLE_ASSESSMENT_TEXT_CHARS);
    expect(buildNoteReadinessReport(profile(snapshot)).assessmentTextMissing).toBe(false);
    expect(
      assessmentGenerationGate({
        hasAssessment: true,
        assessmentStatus: "ready",
        profile: profile(snapshot),
      }),
    ).toEqual({ ok: true });
  });
});
