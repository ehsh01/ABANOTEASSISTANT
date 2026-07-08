import { describe, expect, test } from "vitest";
import type { ClientProfileRow } from "@workspace/db/schema";
import {
  intersectCatalog,
  validateAssessmentStructured,
  withProfileListsUnioned,
} from "./assessment-structured";

const baseProfile: ClientProfileRow = {
  firstName: "A",
  lastName: "B",
  dateOfBirth: "2018-01-01",
  gender: "male",
  maladaptiveBehaviors: ["Task Refusal"],
  maladaptiveBehaviorTargets: [],
  replacementPrograms: ["Manding Skills"],
  skillAcquisitionPrograms: ["Echoic Skills"],
  interventions: ["DRA"],
};

describe("withProfileListsUnioned", () => {
  test("returns null when structured is null", () => {
    expect(withProfileListsUnioned(null, baseProfile)).toBeNull();
  });

  test("unions profile lists into allow-lists so app items are never dropped by intersection", () => {
    const structured = {
      behaviors: ["Physical Aggression"],
      replacement_programs: ["FCT"],
      interventions: ["Response Block"],
      behavior_to_replacements_map: {},
      behavior_to_interventions_map: {},
    };
    const unioned = withProfileListsUnioned(structured, baseProfile)!;
    // Profile items are now present in the allow-lists...
    expect(unioned.behaviors).toContain("Task Refusal");
    expect(unioned.replacement_programs).toEqual(
      expect.arrayContaining(["FCT", "Manding Skills", "Echoic Skills"]),
    );
    expect(unioned.interventions).toEqual(expect.arrayContaining(["Response Block", "DRA"]));
    // ...so intersecting a profile-derived catalog keeps every app item.
    expect(intersectCatalog(["Task Refusal"], unioned.behaviors)).toEqual(["Task Refusal"]);
    expect(intersectCatalog(["Manding Skills"], unioned.replacement_programs)).toEqual([
      "Manding Skills",
    ]);
    // Result is still valid (only allow-lists grew; maps unchanged).
    expect(validateAssessmentStructured(unioned)).toEqual([]);
  });

  test("does not add assessment-only items to the profile-derived catalog", () => {
    const structured = {
      behaviors: ["Elopement"],
      replacement_programs: ["Leave-area program"],
      interventions: ["Environmental Manipulation"],
      behavior_to_replacements_map: {},
      behavior_to_interventions_map: {},
    };
    const unioned = withProfileListsUnioned(structured, baseProfile)!;
    // A catalog built from the profile never surfaces the assessment-only "Elopement".
    expect(intersectCatalog(baseProfile.maladaptiveBehaviors, unioned.behaviors)).not.toContain(
      "Elopement",
    );
  });
});
