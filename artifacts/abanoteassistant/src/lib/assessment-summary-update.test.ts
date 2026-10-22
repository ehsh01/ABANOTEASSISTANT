import { describe, expect, it } from "vitest";
import {
  assessmentSummaryFormFromProfile,
  emptyAssessmentSummaryForm,
} from "@/components/assessment-summary-fields";
import { assessmentSummaryUpdate } from "./assessment-summary-update";

describe("assessment summary edit payload", () => {
  it("omits an untouched summary when the same PDF is re-picked in edit mode", () => {
    const existing = assessmentSummaryFormFromProfile({
      summary: "Existing assessment summary",
      diagnoses: ["F84.0"],
      recommendations: [],
      behaviorProfiles: [],
      reinforcementPreferences: [],
      precursorBehaviors: [],
      parentTrainingGoals: [],
    });

    expect(assessmentSummaryUpdate(existing, false)).toEqual({});
  });

  it("sends a summary after edit or extraction and can explicitly clear it", () => {
    const edited = assessmentSummaryFormFromProfile({
      summary: "Freshly extracted summary",
      diagnoses: [],
      recommendations: [],
      behaviorProfiles: [],
      reinforcementPreferences: [],
      precursorBehaviors: [],
      parentTrainingGoals: [],
    });

    expect(assessmentSummaryUpdate(edited, true)).toMatchObject({
      assessmentSummary: { summary: "Freshly extracted summary" },
    });
    expect(assessmentSummaryUpdate(emptyAssessmentSummaryForm(), true)).toEqual({
      assessmentSummary: null,
    });
  });
});
