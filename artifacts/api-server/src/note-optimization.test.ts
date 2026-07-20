import { describe, expect, it } from "vitest";
import { buildScopedRepairUserMessage } from "./openai-notes";
import {
  enrichInterventionApplicationForBehavior,
  groundNotePlanWithFrozenContext,
  toModelFacingSessionContext,
} from "./note-plan-validation";
import type { NotePlan, SessionContext } from "./note-plan-schema";
import { filterReinforcementPreferencesForNote } from "./reinforcer-preferences";
import { replacementProgramPoolForAutoAssignment } from "./note-validation";

function frozenContext(overrides?: Partial<SessionContext>): SessionContext {
  return {
    narrativeSegmentCount: 1,
    therapySetting: "home",
    gender: "male",
    clientAgeYears: 6,
    ageBand: "child",
    environmentalChanges: "",
    clientAssessmentTextExcerpt: "",
    assessmentReferenceFileName: "bip.pdf",
    reinforcementPreferences: ["tablet", "sensory toys"],
    segments: [
      {
        segmentIndex: 0,
        acquisitionOnly: false,
        behaviorLabel: "Task Refusal",
        replacementLabel: "Request for break",
        interventionLabels: ["Premack principle"],
        activityAntecedent: null,
        behaviorTopography: "not initiating the worksheet within 10 seconds",
        behaviorFunctions: ["escape"],
        trialSummary: { totalTrials: 10, successfulTrialNumbers: [1] },
        rbtActionsOnlyOutcome: false,
      },
    ],
    planCatalogSnapshot: {
      behaviors: ["Task Refusal"],
      replacements: ["Request for break"],
      interventions: ["Premack principle"],
    },
    validationProfile: "phase-3-strict",
    ...overrides,
  };
}

describe("toModelFacingSessionContext", () => {
  it("omits empty assessment excerpt, validationProfile, and trialSummary", () => {
    const facing = toModelFacingSessionContext(frozenContext());
    expect(facing).not.toHaveProperty("clientAssessmentTextExcerpt");
    expect(facing).not.toHaveProperty("validationProfile");
    expect(facing).not.toHaveProperty("therapySetting");
    expect(facing.assessmentGrounding).toEqual([
      expect.objectContaining({
        segmentIndex: 0,
        behaviorLabel: "Task Refusal",
        behaviorTopography: "not initiating the worksheet within 10 seconds",
      }),
    ]);
    const segments = facing.segments as { trialSummary?: unknown }[];
    expect(segments[0]).not.toHaveProperty("trialSummary");
  });

  it("includes a name-scrubbed assessmentExcerpt only when present", () => {
    const without = toModelFacingSessionContext(frozenContext());
    expect(without).not.toHaveProperty("assessmentExcerpt");

    const withExcerpt = toModelFacingSessionContext(
      frozenContext({ modelAssessmentExcerpt: "The client engages in task refusal during demands." }),
    );
    expect(withExcerpt.assessmentExcerpt).toBe(
      "The client engages in task refusal during demands.",
    );
  });
});

describe("groundNotePlanWithFrozenContext force-locks labels", () => {
  it("overwrites wrong model labels with frozen assignments", () => {
    const plan = {
      segments: [
        {
          segmentIndex: 0,
          acquisitionOnly: false,
          behaviorLabel: "WRONG Behavior",
          antecedent: "The RBT presented a worksheet at the table.",
          topography: "not initiating the worksheet within 10 seconds",
          interventions: [{ label: "Pivot Praise", application: "providing praise after compliance" }],
          responseToIntervention: "The client placed both hands on the materials.",
          replacementLabel: "Some other program",
          teachingOrPromptingSummary: "prompting a break request",
          resultSummary: "The client completed the first step.",
        },
      ],
    } as NotePlan;

    const grounded = groundNotePlanWithFrozenContext(plan, frozenContext());
    expect(grounded.segments[0]!.behaviorLabel).toBe("Task Refusal");
    expect(grounded.segments[0]!.replacementLabel).toBe("Request for break");
    expect(grounded.segments[0]!.interventions.map((i) => i.label)).toEqual(["Premack principle"]);
    expect(grounded.segments[0]!.acquisitionOnly).toBe(false);
  });
});

describe("buildScopedRepairUserMessage", () => {
  it("scopes frozen context and prior plan to failing segment indexes", () => {
    const frozen = frozenContext({
      narrativeSegmentCount: 2,
      segments: [
        frozenContext().segments[0]!,
        {
          ...frozenContext().segments[0]!,
          segmentIndex: 1,
          behaviorLabel: "Tantrum",
          replacementLabel: "Accept alternatives when being redirected to more appropriate behavior",
        },
      ],
      planCatalogSnapshot: {
        behaviors: ["Task Refusal", "Tantrum"],
        replacements: [
          "Request for break",
          "Accept alternatives when being redirected to more appropriate behavior",
        ],
        interventions: ["Premack principle"],
      },
    });
    const priorPlan = {
      segments: [
        {
          segmentIndex: 0,
          acquisitionOnly: false,
          behaviorLabel: "Task Refusal",
          antecedent: "A0",
          topography: "T0",
          interventions: [{ label: "Premack principle", application: "app0" }],
          responseToIntervention: "The client touched the materials.",
          replacementLabel: "Request for break",
          teachingOrPromptingSummary: "teaching0",
          resultSummary: "The client completed the step.",
        },
        {
          segmentIndex: 1,
          acquisitionOnly: false,
          behaviorLabel: "Tantrum",
          antecedent: "A1",
          topography: "T1",
          interventions: [{ label: "Premack principle", application: "app1" }],
          responseToIntervention: "RBT only actions here.",
          replacementLabel: "Accept alternatives when being redirected to more appropriate behavior",
          teachingOrPromptingSummary: "teaching1",
          resultSummary: "The client sat down.",
        },
      ],
    } as NotePlan;

    const msg = buildScopedRepairUserMessage({
      frozen,
      planIssues: [
        {
          code: "PROSE_POST_INTERVENTION_OUTCOME",
          message: "needs client outcome",
          segmentIndex: 1,
        },
      ],
      priorRaw: JSON.stringify(priorPlan),
      priorPlan,
    });
    expect(msg).toContain('"repairFocusSegmentIndexes":[1]');
    expect(msg).toContain('"segmentIndex":1');
    expect(msg).not.toMatch(/"segmentIndex":0/);
    expect(msg).toContain("Prior model JSON/output");
  });
});

describe("intervention application templates", () => {
  it("enriches thin Premack / DRA / Escape Extinction / Environmental Manipulation applications", () => {
    expect(
      enrichInterventionApplicationForBehavior(
        "required cleanup before access to the tablet",
        "Task Refusal",
        "Premack principle",
      ),
    ).toMatch(/restating that completing/i);

    expect(
      enrichInterventionApplicationForBehavior(
        "providing praise",
        "Motor Stereotypy",
        "Differential Reinforcement of Alternative Behaviors (DRA)",
      ),
    ).toMatch(/reinforcing the alternative response/i);

    expect(
      enrichInterventionApplicationForBehavior(
        "holding expectation",
        "Task Refusal",
        "Escape Extinction",
      ),
    ).toMatch(/maintaining the presented demand/i);

    expect(
      enrichInterventionApplicationForBehavior(
        "cleared items",
        "Self-Injurious Behavior (SIB)",
        "Environmental Manipulation",
      ),
    ).toMatch(/arranging the activity area/i);
  });
});

describe("reinforcer OCR hardening", () => {
  it("drops pop start and caregiver phone from note preferences", () => {
    const filtered = filterReinforcementPreferencesForNote([
      "tablet",
      "pop start",
      "mother's phone",
      "sensory toys",
    ]);
    expect(filtered).toEqual(["tablet", "sensory toys"]);
  });
});

describe("session-effective program pool (selected-only when selection covers hours)", () => {
  it("does not include unselected linked programs when selection covers hours", () => {
    expect(replacementProgramPoolForAutoAssignment([1, 2, 3], [1, 2, 3, 99, 100], 3)).toEqual([
      1, 2, 3,
    ]);
  });
});
