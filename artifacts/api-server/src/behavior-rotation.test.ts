import { describe, expect, test } from "vitest";
import {
  maladaptiveBehaviorsCatalogForRotation,
  maladaptiveBehaviorsForSessionHours,
  STANDARD_MALADAPTIVE_BEHAVIOR_ROTATION_ORDER,
} from "./note-validation";

describe("maladaptiveBehaviorsCatalogForRotation", () => {
  test("orders profile behaviors by standard rotation order first", () => {
    const result = maladaptiveBehaviorsCatalogForRotation(
      ["Task Refusal", "Physical Aggression", "Custom BIP Behavior"],
      "",
    );
    expect(result.catalog[0]).toBe("Physical Aggression");
    expect(result.catalog[1]).toBe("Task Refusal");
    expect(result.catalog).toContain("Custom BIP Behavior");
  });

  test("does NOT add assessment-only behaviors to the catalog (app profile is authoritative)", () => {
    const result = maladaptiveBehaviorsCatalogForRotation(
      ["Task Refusal"],
      "The client engages in Task Refusal and Property Destruction during demands.",
    );
    // Property Destruction is in the PDF text but not on the profile → not used, only reported.
    expect(result.catalog).not.toContain("Property Destruction");
    expect(result.catalog).toEqual(["Task Refusal"]);
    expect(result.labelsAddedFromAssessmentText).toContain("Property Destruction");
  });

  test("profile behaviors stay in rotation even when absent from assessment text", () => {
    const result = maladaptiveBehaviorsCatalogForRotation(
      ["Task Refusal", "Bolting"],
      "Unrelated assessment text with no behavior names.",
    );
    expect(result.catalog).toContain("Task Refusal");
    expect(result.catalog).toContain("Bolting");
  });
});

describe("maladaptiveBehaviorsForSessionHours", () => {
  test("cycles the catalog across hours", () => {
    const assigned = maladaptiveBehaviorsForSessionHours(["A", "B"], 4);
    expect(assigned).toEqual(["A", "B", "A", "B"]);
  });

  test("one behavior per hour, never two in the same slot", () => {
    const assigned = maladaptiveBehaviorsForSessionHours(["A", "B", "C"], 3);
    expect(assigned).toHaveLength(3);
    for (const label of assigned) {
      expect(["A", "B", "C"]).toContain(label);
    }
  });

  test("rotation seed shifts the starting behavior deterministically", () => {
    const seeded1 = maladaptiveBehaviorsForSessionHours(["A", "B", "C"], 3, "client-1|2026-07-01");
    const seeded2 = maladaptiveBehaviorsForSessionHours(["A", "B", "C"], 3, "client-1|2026-07-01");
    expect(seeded1).toEqual(seeded2);
    expect(new Set(seeded1).size).toBe(3);
  });

  test("standard rotation order is stable (guards catalog wording)", () => {
    expect(STANDARD_MALADAPTIVE_BEHAVIOR_ROTATION_ORDER[0]).toBe("Physical Aggression");
    expect(STANDARD_MALADAPTIVE_BEHAVIOR_ROTATION_ORDER).toContain("Self-Injurious Behavior (SIB)");
  });
});
