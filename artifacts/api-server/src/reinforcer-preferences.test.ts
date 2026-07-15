import { describe, expect, test } from "vitest";
import {
  clinicalBodyHasUnspecifiedToyDelivery,
  filterReinforcementPreferencesForNote,
  isConcreteToyPreference,
  isYouTubeBannedForAge,
  sanitizeReinforcerNarrativeText,
} from "./reinforcer-preferences";

describe("reinforcer preferences helpers", () => {
  test("bans YouTube for clients under 14 only when age is known", () => {
    expect(isYouTubeBannedForAge(13)).toBe(true);
    expect(isYouTubeBannedForAge(14)).toBe(false);
    expect(isYouTubeBannedForAge(null)).toBe(false);
  });

  test("filters YouTube prefs and caregiver roles for under-14 notes", () => {
    const filtered = filterReinforcementPreferencesForNote(
      ["social praise", "YouTube videos", "Tablet", "Maternal uncle", "Preferred toys", "sensory toys"],
      { clientAgeYears: 8 },
    );
    expect(filtered).toEqual(["social praise", "Tablet", "sensory toys"]);
    expect(filtered).not.toContain("Preferred toys");
  });

  test("expands BIP dump lines and drops Mother / Caregiver and hugs", () => {
    const filtered = filterReinforcementPreferencesForNote(
      [
        "Mother / Caregiver",
        "Food: snacks, yogurt, cereal, pop start; he doesn’t like sweets.",
        "Tangibles: electronics such as tablet and mother’s phone; toys such as animals, sensory toys, or any spinning toy.",
        "Hugs",
        "Watching TV",
      ],
      { clientAgeYears: 9 },
    );
    expect(filtered.some((p) => /mother|caregiver|hugs|phone|doesn|pop start/i.test(p))).toBe(
      false,
    );
    expect(filtered).toEqual(
      expect.arrayContaining(["snacks", "yogurt", "cereal", "tablet", "sensory toys", "Watching TV"]),
    );
  });

  test("keeps Preferred toys when no concrete toy preference exists", () => {
    const filtered = filterReinforcementPreferencesForNote(
      ["Preferred toys", "Tablet", "YouTube videos"],
      { clientAgeYears: 16 },
    );
    expect(filtered).toContain("Preferred toys");
    expect(filtered).toContain("YouTube videos");
  });

  test("detects unspecified toy delivery prose", () => {
    expect(clinicalBodyHasUnspecifiedToyDelivery("The RBT provided a preferred toy.")).toBe(true);
    expect(clinicalBodyHasUnspecifiedToyDelivery("The RBT gave access to toys.")).toBe(true);
    expect(
      clinicalBodyHasUnspecifiedToyDelivery("The RBT provided access to sensory toys."),
    ).toBe(false);
  });

  test("isConcreteToyPreference recognizes specific toys", () => {
    expect(isConcreteToyPreference("sensory toys")).toBe(true);
    expect(isConcreteToyPreference("Disney dolls")).toBe(true);
    expect(isConcreteToyPreference("Preferred toys")).toBe(false);
    expect(isConcreteToyPreference("Tablet")).toBe(false);
  });

  test("sanitize swaps YouTube under 14 and generic preferred toys", () => {
    const text =
      'Following this intervention, the RBT provided access to YouTube videos and then delivered a preferred toy.';
    const out = sanitizeReinforcerNarrativeText(
      text,
      ["YouTube videos", "Tablet", "Preferred toys", "spinning toys"],
      10,
    );
    expect(out).not.toMatch(/youtube/i);
    expect(out).toContain("Tablet");
    expect(out).toContain("spinning toys");
    expect(out).not.toMatch(/preferred toys?/i);
  });
});
