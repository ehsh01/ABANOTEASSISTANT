import { describe, expect, test } from "vitest";
import {
  buildLockedOpening,
  buildNextSessionSentence,
  buildPerformanceSentence,
  englishPossessiveFirstName,
  formatCaregiverList,
  LOCKED_CLOSING_PARAGRAPH,
} from "./note-assembly";

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
  test("closing paragraph is verbatim (no caregiver language)", () => {
    expect(LOCKED_CLOSING_PARAGRAPH).toContain(
      'behavior-specific praise (e.g., "Good job," "Wow," and "Good attention to detail")',
    );
    expect(LOCKED_CLOSING_PARAGRAPH).not.toMatch(/\bverbal praise\b/i);
    expect(LOCKED_CLOSING_PARAGRAPH).toContain("The session was completed as planned.");
    expect(LOCKED_CLOSING_PARAGRAPH).not.toMatch(/caregiver|mother|father/i);
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
    // Mirrors assembleSessionNote in routes/notes.ts (locked §1 → body → §2 → §3).
    const opening = buildLockedOpening(["Mother"], false, "Home", "Anthony");
    const body = "Clinical body paragraph.";
    const performance = buildPerformanceSentence(1, [{ totalTrials: 5, successfulTrialNumbers: [1] }], "Anthony");
    const nextSession = buildNextSessionSentence("2026-01-15");
    const note = [opening, "", body, "", LOCKED_CLOSING_PARAGRAPH, "", performance, "", nextSession].join("\n");

    const idx = (s: string) => note.indexOf(s);
    expect(idx(opening)).toBe(0);
    expect(idx(body)).toBeGreaterThan(idx(opening));
    expect(idx(LOCKED_CLOSING_PARAGRAPH)).toBeGreaterThan(idx(body));
    expect(idx(performance)).toBeGreaterThan(idx(LOCKED_CLOSING_PARAGRAPH));
    expect(idx(nextSession)).toBeGreaterThan(idx(performance));
    expect(note.startsWith("The RBT met with ")).toBe(true);
  });
});
