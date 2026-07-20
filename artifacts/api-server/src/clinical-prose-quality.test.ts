import { describe, expect, it } from "vitest";
import {
  normalizeClinicalBodyParallelPastTense,
  scrubOrphanedGerundSentenceFragments,
} from "./note-normalization";
import {
  enrichTeachingOrPromptingForProgram,
  isGenericTeachingOrPromptingSummary,
} from "./program-teaching-templates";
import { isVagueMaladaptiveTopography } from "./maladaptive-behavior-topography";
import {
  assembleClinicalBodyFromNotePlan,
  buildMinimalClinicalBodyFromSessionContext,
} from "./note-plan-assembly";
import { buildFrozenSessionContext, groundNotePlanWithFrozenContext } from "./note-plan-validation";
import type { NoteGenerationContext } from "./openai-notes";
import type { NotePlan } from "./note-plan-schema";

function generationContext(overrides: Partial<NoteGenerationContext> = {}): NoteGenerationContext {
  return {
    clientName: "the client",
    firstName: "the client",
    gender: "male",
    sessionHours: 1,
    narrativeSegmentCount: 1,
    sessionDate: "2025-07-17",
    therapySetting: "Home",
    presentPeople: ["Mother"],
    hasEnvironmentalChanges: false,
    environmentalChanges: "",
    maladaptiveBehaviors: ["Task Refusal"],
    maladaptiveBehaviorTargets: [],
    maladaptiveBehaviorForHour: ["Task Refusal"],
    acquisitionOnlySegmentForHour: [false],
    interventions: ["Premack principle"],
    replacementProgramsInOrder: ["Request for break"],
    replacementProgramForHour: ["Request for break"],
    rbtActionsOnlyOutcomeForHour: [false],
    requestNonce: "test",
    clientAgeYears: 6,
    ageBand: "child",
    clientAssessmentTextExcerpt: "",
    assessmentReferenceFileName: null,
    reinforcementPreferences: [],
    activityAntecedentForHour: [null],
    languageMaladaptiveEpisodeForHour: [false],
    therapistTrialSummaryForReplacementHour: [null],
    behaviorReplacementCandidatesForHour: [["Request for break"]],
    interventionCandidatesForHour: [["Premack principle"]],
    maladaptiveBehaviorFunctionsForHour: [["escape"]],
    maladaptiveBehaviorTopographyForHour: [null],
    behaviorToReplacementsMap: { "Task Refusal": ["Request for break"] },
    ...overrides,
  };
}

describe("scrubOrphanedGerundSentenceFragments", () => {
  it("removes standalone orienting fragments without inventing a client response", () => {
    const input =
      "The RBT presented simple readiness tasks at the work table with materials placed within reach. orienting toward the presented materials. The RBT implemented the replacement program \"Pre-requisite Skills\" by prompting orientation.";
    const out = scrubOrphanedGerundSentenceFragments(input);
    expect(out).not.toMatch(/\borienting toward the presented materials\./i);
    expect(out).toContain("The RBT presented simple readiness tasks");
    expect(out).toContain("Pre-requisite Skills");
  });

  it("keeps gerunds that belong after by-clauses", () => {
    const input =
      'The client manifested Task Refusal by not initiating the demand within 10 seconds.';
    expect(scrubOrphanedGerundSentenceFragments(input)).toContain("by not initiating");
  });
});

describe("normalizeClinicalBodyParallelPastTense", () => {
  it("rewrites mixed past + gerund coordination", () => {
    const out = normalizeClinicalBodyParallelPastTense(
      "The RBT restated that the table demand needed to be completed before access to the spinning toy and re-presenting the same instruction.",
    );
    expect(out).toContain("and re-presented the same instruction");
    expect(out).not.toMatch(/and re-presenting/);
  });

  it("rewrites reinforced … and providing", () => {
    const out = normalizeClinicalBodyParallelPastTense(
      "The RBT reinforced the alternative response and providing praise following appropriate engagement.",
    );
    expect(out).toContain("and provided praise");
  });
});

describe("program-specific teaching templates", () => {
  it("detects generic teaching boilerplate", () => {
    expect(
      isGenericTeachingOrPromptingSummary(
        "modeling the target response and prompting the client through the presented opportunities",
      ),
    ).toBe(true);
  });

  it("enriches Echoic / eye contact / Follow demands with program-specific actions", () => {
    expect(enrichTeachingOrPromptingForProgram("modeling the target response and prompting the client through the presented opportunities", "Echoic Skills")).toMatch(
      /vocal model/i,
    );
    expect(enrichTeachingOrPromptingForProgram("modeling the target response and prompting the client through the presented opportunities", "Improve eye contact")).toMatch(
      /eye level/i,
    );
    expect(
      enrichTeachingOrPromptingForProgram(
        "modeling the target response and prompting the client before reinforcement was delivered",
        "Follow demands after the first prompt",
      ),
    ).toMatch(/one clear instruction/i);
  });

  it("does not overwrite already-specific teaching", () => {
    const specific =
      "presenting a brief vocal model of 'ba' and waiting three seconds for an independent echo";
    expect(enrichTeachingOrPromptingForProgram(specific, "Echoic Skills")).toBe(specific);
  });
});

describe("vague topography patterns from QA prompt", () => {
  it("rejects intent / valuable-objects / bare pushing others / incomplete mall wandering", () => {
    expect(isVagueMaladaptiveTopography("intentionally breaks valuable objects")).toBe(true);
    expect(isVagueMaladaptiveTopography("pushing others")).toBe(true);
    expect(
      isVagueMaladaptiveTopography(
        "wandering off from another person as being more than 2 feet away from another person in the community (malls.",
      ),
    ).toBe(true);
    expect(
      isVagueMaladaptiveTopography("pushing the RBT's forearm with both hands after the demand"),
    ).toBe(false);
  });
});

describe("acquisition assembly does not emit dangling topography", () => {
  it("skips acquisition topography filler in assembled body", () => {
    const context = buildFrozenSessionContext(
      generationContext({
        acquisitionOnlySegmentForHour: [true],
        maladaptiveBehaviorForHour: [""],
        replacementProgramForHour: ["Echoic Skills"],
        replacementProgramsInOrder: ["Echoic Skills"],
        interventions: [],
        interventionCandidatesForHour: [[]],
        behaviorReplacementCandidatesForHour: [["Echoic Skills"]],
      }),
    );
    const plan: NotePlan = {
      segments: [
        {
          segmentIndex: 0,
          acquisitionOnly: true,
          behaviorLabel: "",
          antecedent: "The RBT presented simple readiness tasks at the work table with materials placed within reach.",
          topography: "orienting toward the presented materials",
          interventions: [],
          responseToIntervention: "The client participated with prompting as needed.",
          replacementLabel: "Echoic Skills",
          teachingOrPromptingSummary:
            "modeling the target response and prompting the client through the presented opportunities",
          resultSummary: "The client produced prompted approximations during opportunities.",
        },
      ],
    };
    const grounded = groundNotePlanWithFrozenContext(plan, context);
    const body = assembleClinicalBodyFromNotePlan(grounded, context);
    expect(body).not.toMatch(/\borienting toward the presented materials\./i);
    expect(body).toMatch(/Echoic Skills/);
    expect(body).toMatch(/vocal model/i);
  });
});

describe("minimal fallback uses program-specific teaching", () => {
  it("does not repeat generic modeling boilerplate for Echoic", () => {
    const context = buildFrozenSessionContext(
      generationContext({
        acquisitionOnlySegmentForHour: [true],
        maladaptiveBehaviorForHour: [""],
        replacementProgramForHour: ["Echoic Skills"],
        replacementProgramsInOrder: ["Echoic Skills"],
        interventions: [],
        interventionCandidatesForHour: [[]],
        behaviorReplacementCandidatesForHour: [["Echoic Skills"]],
        therapistTrialSummaryForReplacementHour: [
          { totalTrials: 10, successfulTrialNumbers: [1] },
        ],
      }),
    );
    const body = buildMinimalClinicalBodyFromSessionContext(context);
    expect(body).toMatch(/vocal model/i);
    expect(body).toMatch(/approximately 10%/i);
    expect(body).not.toContain("modeling the target response and prompting the client through the presented opportunities");
  });
});
