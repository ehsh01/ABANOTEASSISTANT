import { describe, expect, it } from "vitest";
import { toGenerateNoteRequest } from "./generate-note-payload";

function wizardData() {
  return {
    clientId: 1,
    sessionHours: 4,
    sessionDate: "2026-08-21",
    therapySetting: "Home" as const,
    presentPeople: ["Caregiver"],
    hasEnvironmentalChanges: false,
    selectedReplacements: [10, 11, 12, 13],
    abcHints: [10, 11, 12, 13].map((replacementProgramId) => ({
      activityAntecedent: null,
      maladaptiveBehavior: null,
      replacementProgramId,
    })),
    programTrialData: Object.fromEntries(
      [10, 11, 12, 13].map((id) => [
        String(id),
        { count: 10, effectiveTrials: [1] },
      ]),
    ),
  };
}

describe("four-hour note payload", () => {
  it("builds a valid request for four selected and assigned programs", () => {
    const payload = toGenerateNoteRequest(wizardData());
    expect(payload).not.toBeNull();
    expect(payload?.abcHints).toHaveLength(4);
    expect(payload?.selectedReplacements).toEqual([10, 11, 12, 13]);
  });

  it("does not submit when a selected program has no hourly assignment", () => {
    const data = wizardData();
    data.abcHints[3]!.replacementProgramId = 10;
    expect(toGenerateNoteRequest(data)).toBeNull();
  });
});
