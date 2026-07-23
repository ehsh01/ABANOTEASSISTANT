import { describe, expect, it } from "vitest";
import {
  generateNoteBodyErrorMessages,
  hydrateLegacyGenerateNoteBody,
  parseGenerateNoteBody,
} from "./note-generation-request";

describe("note generation request validation", () => {
  it("returns actionable field messages when trial data is missing", () => {
    let error: unknown;
    try {
      parseGenerateNoteBody({
        clientId: 1,
        sessionHours: 4,
        sessionDate: "2026-08-21",
        therapySetting: "Home",
        presentPeople: ["Caregiver"],
        hasEnvironmentalChanges: false,
        selectedReplacements: [1, 2, 3, 4],
      });
    } catch (caught) {
      error = caught;
    }

    expect(generateNoteBodyErrorMessages(error)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^programTrialData:/)]),
    );
    expect(generateNoteBodyErrorMessages(error).some((msg) => msg.startsWith("abcHints:"))).toBe(
      false,
    );
  });

  it("hydrates missing abcHints from selectedReplacements for stale SPAs", () => {
    const hydrated = hydrateLegacyGenerateNoteBody({
      sessionHours: 5,
      selectedReplacements: [10, 11, 12, 13, 14],
    });
    expect(hydrated.abcHints).toEqual([
      { activityAntecedent: null, maladaptiveBehavior: null, replacementProgramId: 10 },
      { activityAntecedent: null, maladaptiveBehavior: null, replacementProgramId: 11 },
      { activityAntecedent: null, maladaptiveBehavior: null, replacementProgramId: 12 },
      { activityAntecedent: null, maladaptiveBehavior: null, replacementProgramId: 13 },
      { activityAntecedent: null, maladaptiveBehavior: null, replacementProgramId: 14 },
    ]);
  });

  it("parses a legacy body once abcHints are hydrated and trial data is present", () => {
    const body = parseGenerateNoteBody({
      clientId: 1,
      sessionHours: 2,
      sessionDate: "2026-08-21",
      therapySetting: "Home",
      presentPeople: ["Caregiver"],
      hasEnvironmentalChanges: false,
      selectedReplacements: [10, 11],
      programTrialData: {
        "10": { count: 10, effectiveTrials: [1] },
        "11": { count: 10, effectiveTrials: [] },
      },
    });
    expect(body.abcHints).toHaveLength(2);
    expect(body.abcHints[0]?.replacementProgramId).toBe(10);
    expect(body.abcHints[1]?.replacementProgramId).toBe(11);
  });
});
