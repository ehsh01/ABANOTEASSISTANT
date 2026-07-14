import { describe, expect, test } from "vitest";
import {
  buildLockedClosingParagraph,
  buildLockedOpening,
  buildNextSessionSentence,
  buildPerformanceSentence,
  englishPossessiveFirstName,
  formatCaregiverList,
  LOCKED_CLOSING_PARAGRAPH,
} from "./note-assembly";
import { validateAssembledSessionNote } from "./note-validation";

describe("locked opening", () => {
  test("uses first name and possessive home wording when profile has a name", () => {
    const opening = buildLockedOpening(["Mother"], false, "Home", "Anthony");
    expect(opening).toMatch(/^The RBT met with Anthony and Mother /);
    expect(opening).toContain("Anthony's home");
    expect(opening).toContain("to implement program targets.");
    expect(opening.endsWith("There have been no environmental changes recently.")).toBe(true);
  });

  test("falls back to 'the client' and generic caregiver when data is missing", () => {
    const opening = buildLockedOpening([], true, "Home", null);
    expect(opening).toMatch(/^The RBT met with the client and the caregiver /);
    expect(opening).not.toContain("'s home");
    expect(opening.endsWith("There have been environmental changes recently.")).toBe(true);
  });

  test("joins multiple caregivers with natural English", () => {
    expect(formatCaregiverList(["Mother", "Father"])).toBe("Mother and Father");
    expect(formatCaregiverList(["Mother", "Father", "Grandmother"])).toBe(
      "Mother, Father, and Grandmother",
    );
  });

  test("possessive handles trailing s", () => {
    expect(englishPossessiveFirstName("Alex")).toBe("Alex's");
    expect(englishPossessiveFirstName("James")).toBe("James'");
  });
});

describe("locked closing and end-of-note sequence", () => {
  test("fallback closing uses plain praise (not compound labels) and no caregiver language", () => {
    expect(LOCKED_CLOSING_PARAGRAPH).toContain(
      'praise (e.g., "Good job," "Wow," and "Good attention to detail")',
    );
    expect(LOCKED_CLOSING_PARAGRAPH).not.toMatch(/\bverbal praise\b/i);
    expect(LOCKED_CLOSING_PARAGRAPH).not.toMatch(/\bbehavior-specific praise\b/i);
    expect(LOCKED_CLOSING_PARAGRAPH).toContain("The session was completed as planned.");
    expect(LOCKED_CLOSING_PARAGRAPH).not.toMatch(/caregiver|mother|father/i);
  });

  test("closing lists concrete reinforcementPreferences and social praise when on file", () => {
    const closing = buildLockedClosingParagraph([
      "social praise",
      "snacks",
      "yogurt",
      "sensory toys",
      "spinning toys",
      "YouTube videos",
    ]);
    expect(closing).toContain("social praise");
    expect(closing).toContain("snacks");
    expect(closing).toContain("sensory toys");
    expect(closing).toContain("documented for this client");
    expect(closing).not.toMatch(/\bbehavior-specific praise\b/i);
    expect(closing).not.toMatch(/reinforcement system/);
  });

  test("performance sentence uses fixed template when trial data exists", () => {
    const sentence = buildPerformanceSentence(2, [{ totalTrials: 5, successfulTrialNumbers: [1, 3] }], "Anthony");
    expect(sentence).toBe(
      "Anthony participated in session activities with inconsistent responding and required prompting across tasks.",
    );
  });

  test("performance sentence uses 'The client' when no first name", () => {
    const sentence = buildPerformanceSentence(1, [{ totalTrials: 4, successfulTrialNumbers: [2] }], "");
    expect(sentence).toMatch(/^The client participated in session activities/);
  });

  test("performance fallback states program count when no trial rows", () => {
    expect(buildPerformanceSentence(1, [null], "Anthony")).toMatch(/^The client completed 1 program\./);
    expect(buildPerformanceSentence(3, undefined, "Anthony")).toMatch(/^The client completed 3 programs\./);
  });

  test("next-session sentence is date-only (no location)", () => {
    expect(buildNextSessionSentence("2025-12-10")).toBe(
      "The next session is tentatively scheduled for 12/10/2025.",
    );
    expect(buildNextSessionSentence(undefined)).toBe(
      "The next session is tentatively scheduled; the date is to be determined.",
    );
    expect(buildNextSessionSentence("2025-12-10")).not.toMatch(/home|school|community/i);
  });
});

describe("assembled note order", () => {
  test("opening → body → locked closing → performance → next session", () => {
    const opening = buildLockedOpening(["Mother"], false, "Home", "Anthony");
    const body = "Clinical body paragraph.";
    const closing = buildLockedClosingParagraph(["social praise", "sensory toys"]);
    const performance = buildPerformanceSentence(1, [{ totalTrials: 5, successfulTrialNumbers: [1] }], "Anthony");
    const nextSession = buildNextSessionSentence("2026-01-15");
    const note = [opening, "", body, "", closing, "", performance, "", nextSession].join("\n");

    const idx = (s: string) => note.indexOf(s);
    expect(idx(opening)).toBe(0);
    expect(idx(body)).toBeGreaterThan(idx(opening));
    expect(idx(closing)).toBeGreaterThan(idx(body));
    expect(idx(performance)).toBeGreaterThan(idx(closing));
    expect(idx(nextSession)).toBeGreaterThan(idx(performance));
    expect(note.startsWith("The RBT met with ")).toBe(true);
  });

  test("blocks locked prose, order, caregiver, name, and next-session location violations", () => {
    const context = {
      presentPeople: ["Mother"],
      hasEnvironmentalChanges: false,
      therapySetting: "Home" as const,
      nextSessionDate: "2026-01-15",
      clientFirstName: "Anthony",
      blockedClientNames: ["Anthony", "Smith"],
      narrativeProgramSegmentCount: 1,
      therapistTrialSummaryForReplacementHour: [{ totalTrials: 5, successfulTrialNumbers: [1] }],
      reinforcementPreferences: ["social praise", "sensory toys"],
    };
    const opening = buildLockedOpening(["Mother"], false, "Home", "Anthony");
    const closing = buildLockedClosingParagraph(context.reinforcementPreferences);
    const performance = buildPerformanceSentence(
      1,
      context.therapistTrialSummaryForReplacementHour,
      "Anthony",
    );
    const next = buildNextSessionSentence("2026-01-15");
    const valid = [opening, "", "The client completed a task.", "", closing, "", performance, "", next].join("\n");
    expect(validateAssembledSessionNote(valid, context).blocking).toEqual([]);

    const invalid = valid
      .replace("There have been no environmental changes recently.", "Environment changed.")
      .replace("The client completed a task.", "Anthony completed a task with Mother.")
      .replace(next, `${next.slice(0, -1)} at home.`);
    const codes = validateAssembledSessionNote(invalid, context).blocking.map((issue) => issue.code);
    expect(codes).toEqual(expect.arrayContaining([
      "LOCKED_OPENING",
      "LOCKED_ENVIRONMENT",
      "END_SEQUENCE",
      "NEXT_SESSION_LOCATION",
      "CAREGIVER_LEAKAGE",
      "CLIENT_NAME_LEAKAGE",
    ]));
  });
});
