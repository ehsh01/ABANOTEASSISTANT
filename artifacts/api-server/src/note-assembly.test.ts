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
import { validateAssembledSessionNote, stripUnauthorizedCaregiverLanguage } from "./note-validation";

describe("locked opening", () => {
  test("uses first name and caregivers without stating a meeting place", () => {
    const opening = buildLockedOpening(["Mother"], false, "Home", "Anthony");
    expect(opening).toBe(
      "The RBT met with Anthony and Mother to implement program targets. There have been no environmental changes recently.",
    );
    expect(opening).not.toMatch(/\bat home\b|Anthony's home|school|community/i);
  });

  test("falls back to 'the client' and generic caregiver when data is missing", () => {
    const opening = buildLockedOpening([], true, "Home", null);
    expect(opening).toBe(
      "The RBT met with the client and the caregiver to implement program targets. There have been environmental changes recently.",
    );
    expect(opening).not.toMatch(/\bat home\b|school|community/i);
  });

  test("joins multiple caregivers with natural English and strips stray closing punctuation", () => {
    expect(formatCaregiverList(["Mother", "Father"])).toBe("Mother and Father");
    expect(formatCaregiverList(["Mother", "Father", "Grandmother"])).toBe(
      "Mother, Father, and Grandmother",
    );
    expect(formatCaregiverList(["Mother", "Maternal uncle)"])).toBe(
      "Mother and Maternal uncle",
    );
  });

  test("normalizes a generic 'Caregiver' label to 'the caregiver'", () => {
    expect(formatCaregiverList(["Caregiver"])).toBe("the caregiver");
    expect(formatCaregiverList(["Caregivers"])).toBe("the caregiver");
    expect(formatCaregiverList(["Parent"])).toBe("the caregiver");
    expect(formatCaregiverList(["Mother", "Caregiver"])).toBe(
      "Mother and the caregiver",
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

  test("closing lists concrete reinforcementPreferences with plain praise only", () => {
    const closing = buildLockedClosingParagraph([
      "social praise",
      "snacks",
      "yogurt",
      "sensory toys",
      "spinning toys",
      "YouTube videos",
    ]);
    expect(closing).toContain('praise (e.g., "Good job," "Wow," and "Good attention to detail")');
    expect(closing).not.toMatch(/\bsocial praise\b/i);
    expect(closing).toContain("snacks");
    expect(closing).toContain("sensory toys");
    expect(closing).toContain("documented for this client");
    expect(closing).not.toMatch(/\bbehavior-specific praise\b/i);
    expect(closing).not.toMatch(/reinforcement system/);
  });

  test("closing never lists caregiver/family role labels as preferred items", () => {
    const closing = buildLockedClosingParagraph([
      "social praise",
      "Video games",
      "Tablet",
      "Electronic devices",
      "Preferred toys",
      "Preferred activities",
      "Maternal uncle",
      "Mother",
      "Maternal uncle)",
    ]);
    expect(closing).toContain("Video games");
    expect(closing).toContain("Preferred activities");
    expect(closing).not.toMatch(/maternal|uncle|mother|father|caregiver/i);
  });

  test("closing expands BIP dump lines and drops Mother/Caregiver and hugs", () => {
    const closing = buildLockedClosingParagraph([
      "social praise",
      "Mother / Caregiver",
      "Food: snacks, yogurt, cereal, pop start; he doesn’t like sweets.",
      "Tangibles: electronics such as tablet and mother’s phone; toys such as animals, sensory toys, or any spinning toy.",
      "Playing with his tablet",
      "Watching TV",
      "Playing with toys",
      "Hugs",
    ]);
    expect(closing).not.toMatch(/\bsocial praise\b/i);
    expect(closing).not.toMatch(/Mother|Caregiver|Hugs|mother.?s phone|doesn.|like sweets/i);
    expect(closing).toContain("snacks");
    expect(closing).toMatch(/tablet|sensory toys|spinning toy/i);
  });

  test("closing omits YouTube for clients under 14 and Preferred toys when concrete toys exist", () => {
    const closing = buildLockedClosingParagraph(
      ["social praise", "YouTube videos", "Preferred toys", "sensory toys", "Tablet"],
      { clientAgeYears: 9 },
    );
    expect(closing).toContain("sensory toys");
    expect(closing).toContain("Tablet");
    expect(closing).not.toMatch(/youtube/i);
    expect(closing).not.toMatch(/Preferred toys/i);
  });

  test("closing keeps YouTube when client is 14+", () => {
    const closing = buildLockedClosingParagraph(["YouTube videos", "Tablet"], {
      clientAgeYears: 14,
    });
    expect(closing).toContain("YouTube videos");
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

  test("performance fallback states program count only when no trial rows", () => {
    expect(buildPerformanceSentence(1, [null], "Anthony")).toBe("The client completed 1 program.");
    expect(buildPerformanceSentence(3, undefined, "Anthony")).toBe("The client completed 3 programs.");
    expect(buildPerformanceSentence(2, undefined, "Anthony")).not.toMatch(
      /not entered|cannot be computed|percentage/i,
    );
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

describe("caregiver language strip", () => {
  test("removes maternal-uncle leaks while preserving quoted Parent Training labels", () => {
    const text =
      'The client completed the placement and Maternal uncle) remained near the materials. The RBT implemented the replacement program "Parent Training" by modeling a gesture.';
    const stripped = stripUnauthorizedCaregiverLanguage(text, ["Mother", "Maternal uncle)"]);
    expect(stripped).not.toMatch(/maternal|uncle/i);
    expect(stripped).toContain('"Parent Training"');
    expect(stripped).toContain("completed the placement and remained");
  });

  test("preserves blank-line paragraph separators (one paragraph per ABC)", () => {
    const body = [
      "The RBT presented cards. The client manifested Task Refusal by pushing materials away.",
      "Later, the RBT arranged a sorting task. The client manifested Task Refusal by turning away.",
      "Next, the RBT set out a matching task and the Mother sat nearby to observe.",
    ].join("\n\n");
    const stripped = stripUnauthorizedCaregiverLanguage(body, ["Mother"]);
    expect(stripped.split(/\n\s*\n/)).toHaveLength(3);
    expect(stripped).not.toMatch(/\bMother\b/);
  });

  test("does not collapse a five-segment body into one paragraph", () => {
    const body = Array.from(
      { length: 5 },
      (_, i) => `Paragraph ${i + 1}. The client completed the presented task.`,
    ).join("\n\n");
    const stripped = stripUnauthorizedCaregiverLanguage(body, []);
    expect(stripped.split(/\n\s*\n/)).toHaveLength(5);
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

  test("allows Parent Training catalog labels and BIP reinforcers with family words in locked closing", () => {
    const context = {
      presentPeople: ["Mother"],
      hasEnvironmentalChanges: false,
      therapySetting: "Home" as const,
      nextSessionDate: "2026-01-15",
      clientFirstName: "Anthony",
      blockedClientNames: ["Anthony"],
      narrativeProgramSegmentCount: 1,
      therapistTrialSummaryForReplacementHour: [{ totalTrials: 5, successfulTrialNumbers: [1] }],
      reinforcementPreferences: ["social praise", "Mom's music videos"],
    };
    const opening = buildLockedOpening(["Mother"], false, "Home", "Anthony");
    const closing = buildLockedClosingParagraph(context.reinforcementPreferences);
    const performance = buildPerformanceSentence(
      1,
      context.therapistTrialSummaryForReplacementHour,
      "Anthony",
    );
    const next = buildNextSessionSentence("2026-01-15");
    const body =
      'The RBT presented cards. Then, the client manifested Task Refusal by pushing materials away. Additionally, the RBT implemented the replacement program "Parent Training" by modeling a request gesture.';
    const note = [opening, "", body, "", closing, "", performance, "", next].join("\n");
    expect(closing).toMatch(/Mom's music videos/);
    expect(validateAssembledSessionNote(note, context).blocking).toEqual([]);
  });
});
