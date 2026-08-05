import { describe, expect, it } from "vitest";
import { describeGenerateNoteBlockers, toGenerateNoteRequest } from "./generate-note-payload";

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

  it("allows extra selected programs beyond session hours", () => {
    const data = wizardData();
    data.selectedReplacements = [10, 11, 12, 13, 14, 15];
    data.programTrialData["14"] = { count: 10, effectiveTrials: [1] };
    data.programTrialData["15"] = { count: 10, effectiveTrials: [1] };
    // Hours 1–4 still use 10–13; 14 and 15 are unused extras.
    const payload = toGenerateNoteRequest(data);
    expect(payload).not.toBeNull();
    expect(payload?.abcHints.map((h) => h.replacementProgramId)).toEqual([10, 11, 12, 13]);
    expect(payload?.selectedReplacements).toEqual([10, 11, 12, 13, 14, 15]);
  });

  it("allows repeating a program across hours and leaving another selected unused", () => {
    const data = wizardData();
    data.abcHints[3]!.replacementProgramId = 10;
    const payload = toGenerateNoteRequest(data);
    expect(payload).not.toBeNull();
    expect(payload?.abcHints.map((h) => h.replacementProgramId)).toEqual([10, 11, 12, 10]);
  });
});

describe("generate blockers", () => {
  it("reports nothing for a complete session", () => {
    expect(describeGenerateNoteBlockers(wizardData())).toEqual([]);
  });

  it("does not block when more programs are selected than hours", () => {
    const data = wizardData();
    data.sessionHours = 2;
    data.abcHints = data.abcHints.slice(0, 2);
    expect(describeGenerateNoteBlockers(data)).toEqual([]);
    expect(toGenerateNoteRequest(data)).not.toBeNull();
  });

  it("names the program that is missing a criterion percentage", () => {
    const data = wizardData();
    delete data.programTrialData["12"];

    const blockers = describeGenerateNoteBlockers(data, (id) => `Program ${id} name`);
    expect(blockers).toHaveLength(1);
    expect(blockers[0]!.step).toBe(2);
    expect(blockers[0]!.message).toContain("Program 12 name");
  });

  it("does not require every selected program to be assigned", () => {
    const data = wizardData();
    data.abcHints[3]!.replacementProgramId = 10;
    expect(describeGenerateNoteBlockers(data)).toEqual([]);
  });

  it("flags an hour with no program", () => {
    const data = wizardData();
    data.abcHints[1]!.replacementProgramId = null;

    const messages = describeGenerateNoteBlockers(data).map((b) => b.message);
    expect(messages).toContain("Hour 2 needs one of the selected programs.");
  });

  it("blocks whenever the payload cannot be built", () => {
    const data = wizardData();
    data.abcHints[1]!.replacementProgramId = null;
    expect(toGenerateNoteRequest(data)).toBeNull();
    expect(describeGenerateNoteBlockers(data).length).toBeGreaterThan(0);
  });
});
