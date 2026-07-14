import { describe, expect, test } from "vitest";
import {
  isFunctionMisfitIntervention,
  isGadgetAccessMaladaptiveBehaviorLabel,
  interventionMatchesFunctionCategory,
  preferredInterventionCandidatesForBehaviorFunction,
} from "./behavior-function-intervention-mapping";
import {
  normalizeClinicalBodyInterventionLabels,
  normalizeClinicalBodyPraiseWording,
} from "./note-normalization";

describe("behavior-specific praise wording", () => {
  test("rewrites verbal praise to behavior-specific praise", () => {
    const out = normalizeClinicalBodyPraiseWording(
      'The RBT delivered verbal praise after the completed response. Brief verbal praise followed.',
    );
    expect(out).toContain("behavior-specific praise");
    expect(out).toContain("brief behavior-specific praise");
    expect(out).not.toMatch(/\bverbal praise\b/i);
  });
});

describe("Visual Supports exact-name normalization", () => {
  test("rewrites singular Visual Support naming sentence when catalog has Visual Supports", () => {
    const out = normalizeClinicalBodyInterventionLabels(
      "The RBT implemented Visual Support. Following this intervention, the RBT pointed to the schedule.",
      ["Visual Supports", "DRA", "Environmental Manipulation"],
    );
    expect(out).toContain("The RBT implemented Visual Supports.");
    expect(out).not.toMatch(/implemented Visual Support\./);
  });
});

describe("tangible / gadget-access interventions", () => {
  test("detects gadget-access behavior labels", () => {
    expect(
      isGadgetAccessMaladaptiveBehaviorLabel(
        "Persistent access or use of gadgets with videos games",
      ),
    ).toBe(true);
    expect(isGadgetAccessMaladaptiveBehaviorLabel("Task Refusal")).toBe(false);
  });

  test("Environmental Manipulation matches tangible function and ranks first with DRA", () => {
    expect(interventionMatchesFunctionCategory("Environmental Manipulation", "tangible")).toBe(
      true,
    );
    const ordered = preferredInterventionCandidatesForBehaviorFunction(
      ["Visual Supports", "Environmental Manipulation", "DRA", "Premack principle"],
      ["tangible"],
      "Persistent access or use of gadgets with videos games",
    );
    expect(ordered[0]).toBe("Environmental Manipulation");
    expect(ordered).toContain("DRA");
    expect(ordered).not.toContain("Visual Supports");
  });

  test("Visual Support alone is a misfit when Env Man / DRA are listed for gadget access", () => {
    expect(
      isFunctionMisfitIntervention(
        "Visual Support",
        null,
        ["Visual Supports", "Environmental Manipulation", "DRA"],
        "Persistent access or use of gadgets with videos games",
      ),
    ).toBe(true);
  });
});
