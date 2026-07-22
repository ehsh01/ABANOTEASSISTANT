import { describe, expect, it } from "vitest";
import {
  generateNoteBodyErrorMessages,
  parseGenerateNoteBody,
} from "./note-generation-request";

describe("note generation request validation", () => {
  it("returns actionable field messages for an invalid request body", () => {
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
      expect.arrayContaining([
        expect.stringMatching(/^abcHints:/),
        expect.stringMatching(/^programTrialData:/),
      ]),
    );
  });
});
