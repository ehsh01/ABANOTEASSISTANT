import { describe, expect, test } from "vitest";
import type { ClientProfileRow } from "@workspace/db/schema";
import { refreshProfileFromAssessmentUpload } from "./assessment-persistence";

const baseProfile: ClientProfileRow = {
  firstName: "Client",
  lastName: "One",
  dateOfBirth: "2018-01-01",
  gender: "Male",
  maladaptiveBehaviors: ["Task Refusal", "Elopement"],
  maladaptiveBehaviorTargets: [
    { name: "Task Refusal", topography: "Therapist-curated definition.", functions: ["escape"] },
    { name: "Elopement", topography: "Old extracted definition.", functions: ["attention"] },
  ],
  replacementPrograms: ["Request a break", "Walk with adult"],
  skillAcquisitionPrograms: [],
  interventions: ["DRA", "Response Block"],
  assessmentStructured: {
    behaviors: ["Task Refusal", "Elopement", "Assessment Only Behavior"],
    replacement_programs: ["Request a break", "Walk with adult", "Assessment Only Program"],
    interventions: ["DRA", "Response Block", "Assessment Only Intervention"],
    behavior_to_replacements_map: {
      "Task Refusal": ["Request a break"],
      Elopement: ["Walk with adult", "Assessment Only Program"],
      "Assessment Only Behavior": ["Assessment Only Program"],
    },
    behavior_to_interventions_map: {
      "Task Refusal": ["DRA"],
      Elopement: ["Response Block"],
    },
  },
  assessmentExtractionProvenance: {
    topographyBehaviors: ["Elopement"],
    functionBehaviors: ["Elopement"],
    replacementMapBehaviors: ["Elopement", "Assessment Only Behavior"],
    interventionMapBehaviors: ["Elopement"],
    assessmentSummaryExtracted: true,
  },
};

describe("assessment upload persistence", () => {
  test("refreshes extracted values, preserves curated values, and prunes to profile catalogs", () => {
    const refreshed = refreshProfileFromAssessmentUpload({
      profile: baseProfile,
      fileName: "replacement.pdf",
      assessmentTextSnapshot: "Meaningful assessment text ".repeat(8),
      extracted: {
        maladaptiveBehaviorTopographies: [
          { name: "Task Refusal", topography: "New document definition.", functions: ["tangible"] },
          { name: "Elopement", topography: "New extracted definition.", functions: ["escape"] },
        ],
        behaviorReplacementMap: {
          "Task Refusal": ["Walk with adult"],
          Elopement: ["Request a break"],
          "Assessment Only Behavior": ["Assessment Only Program"],
        },
        behaviorInterventionMap: {
          "Task Refusal": ["Response Block"],
          Elopement: ["DRA"],
        },
      },
    });

    expect(refreshed.assessmentTextSnapshot).toContain("Meaningful assessment text");
    expect(refreshed.assessmentFileName).toBe("replacement.pdf");
    expect(refreshed.maladaptiveBehaviorTargets).toEqual([
      { name: "Task Refusal", topography: "Therapist-curated definition.", functions: ["escape"] },
      { name: "Elopement", topography: "New extracted definition.", functions: ["escape"] },
    ]);
    expect(refreshed.assessmentStructured?.behaviors).toEqual(["Task Refusal", "Elopement"]);
    expect(refreshed.assessmentStructured?.replacement_programs).toEqual([
      "Request a break",
      "Walk with adult",
    ]);
    expect(refreshed.assessmentStructured?.interventions).toEqual(["DRA", "Response Block"]);
    expect(refreshed.assessmentStructured?.behavior_to_replacements_map).toEqual({
      "Task Refusal": ["Request a break"],
      Elopement: ["Request a break"],
    });
    expect(refreshed.assessmentStructured?.behavior_to_interventions_map).toEqual({
      "Task Refusal": ["DRA"],
      Elopement: ["DRA"],
    });
  });

  test("persists LLM maps when no structured row exists", () => {
    const refreshed = refreshProfileFromAssessmentUpload({
      profile: { ...baseProfile, assessmentStructured: null, assessmentExtractionProvenance: undefined },
      fileName: "first.pdf",
      assessmentTextSnapshot: "Meaningful assessment text ".repeat(8),
      extracted: {
        behaviorReplacementMap: { "Task Refusal": ["Request a break"] },
        behaviorInterventionMap: { "Task Refusal": ["DRA"] },
      },
    });

    expect(refreshed.assessmentStructured?.behavior_to_replacements_map).toEqual({
      "Task Refusal": ["Request a break"],
    });
    expect(refreshed.assessmentStructured?.behavior_to_interventions_map).toEqual({
      "Task Refusal": ["DRA"],
    });
  });
});
