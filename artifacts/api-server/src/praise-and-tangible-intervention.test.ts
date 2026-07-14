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

describe("praise wording normalization", () => {
  test("rewrites praise details as explicit RBT actions rather than title-like labels", () => {
    const out = normalizeClinicalBodyPraiseWording(
      "The RBT delivered verbal praise after the completed response. Brief behavior-specific praise followed.",
    );
    expect(out).toContain("The RBT acknowledged");
    expect(out).not.toMatch(/\bpraise\b/i);
  });

  test("rewrites all external-review warning forms", () => {
    const out = normalizeClinicalBodyPraiseWording(
      "Praise withheld during repeated motor pattern. Brief praise delivered after the client placed the card into the bin. The RBT delivered brief praise when the client remained near the RBT.",
    );
    expect(out).toContain("The RBT maintained neutral attention during repeated motor pattern");
    expect(out).toContain("The RBT acknowledged the completed response");
    expect(out).not.toMatch(/\bpraise\b/i);
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
