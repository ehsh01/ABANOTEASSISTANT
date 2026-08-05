import { describe, expect, it } from "vitest";
import {
  describeGenerateNoteBlockers,
  resolveHourlyProgramIds,
  toGenerateNoteRequest,
  ZERO_CRITERION_TRIAL_ENTRY,
} from "./generate-note-payload";

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

describe("resolveHourlyProgramIds", () => {
  it("fills remaining hours from the client list when fewer programs are selected", () => {
    expect(
      resolveHourlyProgramIds({
        sessionHours: 4,
        hintProgramIds: [10, 11, null, null],
        selectedIds: [10, 11],
        linkedIds: [10, 11, 12, 13, 14],
      }),
    ).toEqual([10, 11, 12, 13]);
  });

  it("replaces later duplicates with unused linked programs", () => {
    expect(
      resolveHourlyProgramIds({
        sessionHours: 4,
        hintProgramIds: [10, 11, 10, 11],
        selectedIds: [10, 11],
        linkedIds: [10, 11, 20, 21],
      }),
    ).toEqual([10, 11, 20, 21]);
  });

  it("keeps the first occurrence when diversifying duplicates", () => {
    expect(
      resolveHourlyProgramIds({
        sessionHours: 3,
        hintProgramIds: [5, 5, 5],
        selectedIds: [5],
        linkedIds: [5, 6, 7],
      }),
    ).toEqual([5, 6, 7]);
  });
});

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
    const payload = toGenerateNoteRequest(data, [10, 11, 12, 13, 14, 15]);
    expect(payload).not.toBeNull();
    expect(payload?.abcHints.map((h) => h.replacementProgramId)).toEqual([10, 11, 12, 13]);
  });

  it("auto-fills from the client list when only two programs are selected for four hours", () => {
    const data = wizardData();
    data.selectedReplacements = [10, 11];
    data.abcHints = [
      { activityAntecedent: null, maladaptiveBehavior: null, replacementProgramId: 10 },
      { activityAntecedent: null, maladaptiveBehavior: null, replacementProgramId: 11 },
      { activityAntecedent: null, maladaptiveBehavior: null, replacementProgramId: 10 },
      { activityAntecedent: null, maladaptiveBehavior: null, replacementProgramId: 11 },
    ];
    delete data.programTrialData["12"];
    delete data.programTrialData["13"];

    const payload = toGenerateNoteRequest(data, [10, 11, 12, 13]);
    expect(payload).not.toBeNull();
    expect(payload?.abcHints.map((h) => h.replacementProgramId)).toEqual([10, 11, 12, 13]);
    expect(payload?.selectedReplacements).toEqual([10, 11, 12, 13]);
    expect(payload?.programTrialData["12"]).toEqual(ZERO_CRITERION_TRIAL_ENTRY);
  });

  it("defaults a blank percentage to did-not-meet-criterion (0%)", () => {
    const data = wizardData();
    delete data.programTrialData["12"];
    const payload = toGenerateNoteRequest(data);
    expect(payload).not.toBeNull();
    expect(payload?.programTrialData["12"]).toEqual(ZERO_CRITERION_TRIAL_ENTRY);
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

  it("does not block when a criterion percentage is blank", () => {
    const data = wizardData();
    delete data.programTrialData["12"];
    expect(describeGenerateNoteBlockers(data)).toEqual([]);
  });

  it("does not require every selected program to be assigned", () => {
    const data = wizardData();
    data.abcHints[3]!.replacementProgramId = 10;
    expect(describeGenerateNoteBlockers(data)).toEqual([]);
  });

  it("blocks when no program is selected", () => {
    const data = wizardData();
    data.selectedReplacements = [];
    expect(describeGenerateNoteBlockers(data).map((b) => b.message)).toContain(
      "Select at least one replacement program.",
    );
  });
});
