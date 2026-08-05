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

  it("does not submit when a selected program has no hourly assignment", () => {
    const data = wizardData();
    data.abcHints[3]!.replacementProgramId = 10;
    expect(toGenerateNoteRequest(data)).toBeNull();
  });
});

describe("generate blockers", () => {
  it("reports nothing for a complete session", () => {
    expect(describeGenerateNoteBlockers(wizardData())).toEqual([]);
  });

  it("explains selecting more programs than session hours", () => {
    const data = wizardData();
    data.sessionHours = 2;
    data.abcHints = data.abcHints.slice(0, 2);

    const messages = describeGenerateNoteBlockers(data).map((b) => b.message);
    expect(messages.some((m) => m.includes("4 programs are selected but the session is 2 hours"))).toBe(
      true,
    );
    // The impossible state is reported once, not repeated per unassignable program.
    expect(messages.some((m) => m.includes("not assigned to any hour"))).toBe(false);
  });

  it("names the program that is missing a criterion percentage", () => {
    const data = wizardData();
    delete data.programTrialData["12"];

    const blockers = describeGenerateNoteBlockers(data, (id) => `Program ${id} name`);
    expect(blockers).toHaveLength(1);
    expect(blockers[0]!.step).toBe(2);
    expect(blockers[0]!.message).toContain("Program 12 name");
  });

  it("flags a selected program left unassigned when hours allow it", () => {
    const data = wizardData();
    data.abcHints[3]!.replacementProgramId = 10;

    const blockers = describeGenerateNoteBlockers(data, (id) => `P${id}`);
    expect(blockers.map((b) => b.message)).toEqual([
      '"P13" is selected but not assigned to any hour. Assign it in ABC Builder or deselect it.',
    ]);
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
