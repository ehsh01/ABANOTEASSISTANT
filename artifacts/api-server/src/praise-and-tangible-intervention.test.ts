import { describe, expect, test } from "vitest";
import {
  inferBehaviorFunctionsFromLabel,
  isAttentionOnlyInterventionLabel,
  isFunctionMisfitIntervention,
  isGadgetAccessMaladaptiveBehaviorLabel,
  interventionMatchesFunctionCategory,
  preferredInterventionCandidatesForBehaviorFunction,
} from "./behavior-function-intervention-mapping";
import {
  canonicalizeInterventionCatalog,
  normalizeClinicalBodyInterventionLabels,
  normalizeClinicalBodyPraiseWording,
  scrubAssembledNoteQcHotspots,
  scrubInventedEnvironmentDetails,
} from "./note-normalization";
import {
  assignInterventionsForSegment,
  diversifyInterventionLabelsAcrossSegments,
} from "./note-plan-validation";

const DRA = "Differential Reinforcement of Alternative Behavior (DRA)";

describe("function-matched intervention assignment (no universal Pivot Praise)", () => {
  test("inferBehaviorFunctionsFromLabel maps common labels to functions", () => {
    expect(inferBehaviorFunctionsFromLabel("Task Refusal")).toEqual(["escape"]);
    expect(inferBehaviorFunctionsFromLabel("Elopement")).toEqual(["escape"]);
    expect(inferBehaviorFunctionsFromLabel("Motor Stereotypy")).toEqual(["automatic"]);
    expect(inferBehaviorFunctionsFromLabel("Physical Aggression")).toEqual(["escape", "tangible"]);
    expect(isAttentionOnlyInterventionLabel("Pivot Praise")).toBe(true);
    expect(isAttentionOnlyInterventionLabel("Premack Principle")).toBe(false);
  });

  test("does not assign attention-only Pivot Praise to an escape behavior with a function match available", () => {
    const assigned = assignInterventionsForSegment({
      acquisitionOnly: false,
      behaviorLabel: "Task Refusal",
      approvedInterventions: ["Pivot Praise", "Premack Principle"],
      behaviorFunctions: null,
    });
    expect(assigned).toEqual(["Premack Principle"]);
  });

  test("keeps Pivot Praise for an attention-maintained behavior", () => {
    const assigned = assignInterventionsForSegment({
      acquisitionOnly: false,
      behaviorLabel: "Disruptive Behavior",
      approvedInterventions: ["Pivot Praise"],
      behaviorFunctions: ["attention"],
    });
    expect(assigned).toEqual(["Pivot Praise"]);
  });

  test("falls back to the only approved intervention when nothing else exists", () => {
    const assigned = assignInterventionsForSegment({
      acquisitionOnly: false,
      behaviorLabel: "Task Refusal",
      approvedInterventions: ["Pivot Praise"],
      behaviorFunctions: null,
    });
    expect(assigned).toEqual(["Pivot Praise"]);
  });

  test("diversifies a repeated intervention across segments when a function-appropriate alternative exists", () => {
    const segments = [
      {
        behaviorLabel: "Task Refusal",
        acquisitionOnly: false,
        interventionLabels: ["Premack Principle"],
        behaviorFunctions: null,
      },
      {
        behaviorLabel: "Elopement",
        acquisitionOnly: false,
        interventionLabels: ["Premack Principle"],
        behaviorFunctions: null,
      },
    ];
    diversifyInterventionLabelsAcrossSegments(
      segments,
      ["Premack Principle", DRA],
      [undefined, undefined],
    );
    expect(segments[0]!.interventionLabels).toEqual(["Premack Principle"]);
    expect(segments[1]!.interventionLabels).toEqual([DRA]);
  });

  test("does not diversify to a function-mismatched or attention-only intervention", () => {
    const segments = [
      {
        behaviorLabel: "Task Refusal",
        acquisitionOnly: false,
        interventionLabels: ["Premack Principle"],
        behaviorFunctions: null,
      },
      {
        behaviorLabel: "Elopement",
        acquisitionOnly: false,
        interventionLabels: ["Premack Principle"],
        behaviorFunctions: null,
      },
    ];
    // Only Pivot Praise (attention-only, escape-mismatch) is the other approved option → keep Premack.
    diversifyInterventionLabelsAcrossSegments(
      segments,
      ["Premack Principle", "Pivot Praise"],
      [undefined, undefined],
    );
    expect(segments[1]!.interventionLabels).toEqual(["Premack Principle"]);
  });
});

describe("invented environmental details", () => {
  test("rewrites marked play space / visual boundary to a neutral location", () => {
    expect(
      scrubInventedEnvironmentDetails("The client stopped beside the marked play space."),
    ).toBe("The client stopped beside the designated activity area.");
    expect(scrubInventedEnvironmentDetails("returned to the visual boundary")).toBe(
      "returned to the designated activity area",
    );
  });

  test("does not touch 'marked' used as a verb", () => {
    expect(scrubInventedEnvironmentDetails("He marked a response on the worksheet.")).toBe(
      "He marked a response on the worksheet.",
    );
  });
});

describe("praise wording normalization", () => {
  test("collapses compound praise labels to plain praise but keeps the sentence grammatical", () => {
    const out = normalizeClinicalBodyPraiseWording(
      "The RBT delivered verbal praise after the completed response. Brief behavior-specific praise followed.",
    );
    expect(out).not.toMatch(/\b(?:social|verbal|behavior-specific) praise\b/i);
    expect(out).toContain("The RBT delivered praise after the completed response.");
    expect(out).toContain("Brief praise followed.");
  });

  test("keeps a conjoined praise+access clause grammatical (no dropped verb)", () => {
    const out = normalizeClinicalBodyPraiseWording(
      "the RBT delivered social praise and access to sensory toys when the client used the transition response.",
    );
    expect(out).not.toMatch(/\bsocial praise\b/i);
    // Verb "delivered" still governs both objects; no capital "The" injected mid-sentence.
    expect(out).toBe(
      "the RBT delivered praise and access to sensory toys when the client used the transition response.",
    );
  });

  test("scrubs social praise and status topography from assembled notes", () => {
    const out = scrubAssembledNoteQcHotspots(
      'Throughout the session, the RBT used various reinforcers, including social praise (e.g., "Good job"). The client manifested Climbing by Status: To be initiated.',
    );
    expect(out).not.toMatch(/\bsocial praise\b/i);
    expect(out).toContain("praise");
    expect(out).not.toMatch(/Status:\s*To be initiated/i);
    expect(out).toMatch(/Climbing by engaging in the targeted motor actions/i);
  });

  test("rewrites praise-withheld phrasing into an observable RBT action", () => {
    const out = normalizeClinicalBodyPraiseWording(
      "Praise withheld during the repeated motor pattern.",
    );
    expect(out).toContain("The RBT maintained neutral attention during the repeated motor pattern");
    expect(out).not.toMatch(/praise withheld/i);
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

describe("Escape → Escape Extinction canonicalization", () => {
  test("canonicalizeInterventionCatalog expands bare Escape and drops other bare function tokens", () => {
    expect(canonicalizeInterventionCatalog(["Escape", "Premack principle", "Attention"])).toEqual([
      "Escape Extinction",
      "Premack principle",
    ]);
    expect(canonicalizeInterventionCatalog(["Escape Extinction", "Escape"])).toEqual([
      "Escape Extinction",
    ]);
  });

  test("normalizeClinicalBodyInterventionLabels expands implemented Escape to Escape Extinction", () => {
    const out = normalizeClinicalBodyInterventionLabels(
      "To address this behavior, the RBT implemented Escape. Following this intervention, the RBT maintained the demand.",
      ["Escape Extinction", "Premack principle"],
    );
    expect(out).toContain("the RBT implemented Escape Extinction.");
    expect(out).not.toMatch(/implemented Escape\./);
  });

  test("normalizeClinicalBodyInterventionLabels promotes bare Escape even when catalog only had Escape", () => {
    const out = normalizeClinicalBodyInterventionLabels(
      "To address this behavior, the RBT implemented Escape.",
      ["Escape"],
    );
    expect(out).toContain("the RBT implemented Escape Extinction.");
  });

  test("assignInterventionsForSegment uses Escape Extinction after catalog canonicalization", () => {
    const approved = canonicalizeInterventionCatalog(["Escape", "Premack principle"]);
    expect(
      assignInterventionsForSegment({
        acquisitionOnly: false,
        behaviorLabel: "Task Refusal",
        approvedInterventions: approved,
        behaviorFunctions: ["escape"],
        functionCandidates: preferredInterventionCandidatesForBehaviorFunction(
          approved,
          ["escape"],
          "Task Refusal",
        ),
      }),
    ).toEqual(["Escape Extinction"]);
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
