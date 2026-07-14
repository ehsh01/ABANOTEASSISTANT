import { describe, expect, it, vi } from "vitest";
import {
  generateClinicalBodyOpenAI,
  type NoteGenerationContext,
  type NotePlanModelCall,
} from "./openai-notes";
import {
  assembleClinicalBodyFromNotePlan,
  buildDeterministicTrialSentence,
  roundedTrialPercentage,
} from "./note-plan-assembly";
import { NotePlanSchema, type NotePlan } from "./note-plan-schema";
import {
  assignInterventionsForSegment,
  buildFrozenSessionContext,
  validateNotePlan,
} from "./note-plan-validation";
import { validateClinicalBodyComplianceDetailed } from "./note-validation";

function generationContext(overrides: Partial<NoteGenerationContext> = {}): NoteGenerationContext {
  return {
    clientName: "the client",
    firstName: "the client",
    gender: null,
    sessionHours: 1,
    narrativeSegmentCount: 1,
    sessionDate: "2026-07-14",
    therapySetting: "Home",
    presentPeople: [],
    hasEnvironmentalChanges: false,
    environmentalChanges: "",
    maladaptiveBehaviors: ["Task Refusal"],
    maladaptiveBehaviorTargets: [],
    maladaptiveBehaviorForHour: ["Task Refusal"],
    interventions: ["Premack principle"],
    replacementProgramsInOrder: ["Request for Break"],
    replacementProgramForHour: ["Request for Break"],
    rbtActionsOnlyOutcomeForHour: [false],
    requestNonce: "test",
    clientAgeYears: 8,
    ageBand: null,
    clientAssessmentTextExcerpt:
      "Task Refusal is defined as pushing task materials away and turning the head from the work area.",
    assessmentReferenceFileName: "bip.pdf",
    reinforcementPreferences: [],
    activityAntecedentForHour: [null],
    languageMaladaptiveEpisodeForHour: [false],
    therapistTrialSummaryForReplacementHour: [null],
    acquisitionOnlySegmentForHour: [false],
    maladaptiveBehaviorFunctionsForHour: [["escape"]],
    maladaptiveBehaviorTopographyForHour: [
      "pushing task materials away and turning the head from the work area",
    ],
    behaviorReplacementCandidatesForHour: [["Request for Break"]],
    interventionCandidatesForHour: [["Premack principle"]],
    behaviorToReplacementsMap: { "Task Refusal": ["Request for Break"] },
    ...overrides,
  };
}

function validPlan(overrides: Partial<NotePlan["segments"][number]> = {}): NotePlan {
  return {
    segments: [
      {
        segmentIndex: 0,
        acquisitionOnly: false,
        behaviorLabel: "Task Refusal",
        antecedent:
          "The RBT placed a shape-sorting task on the table and presented the instruction to place the red shape.",
        topography: "the client pushed the task materials away and turned the head from the work area",
        interventions: [
          {
            label: "Premack principle",
            application:
              "The RBT presented the required placement before access to the preferred shape toy",
          },
        ],
        responseToIntervention:
          "The client returned the red shape to the table and completed the presented placement after prompting",
        replacementLabel: "Request for Break",
        teachingOrPromptingSummary:
          "modeling a gesture the client could use before pausing the task",
        resultSummary:
          "The client used the modeled gesture following the RBT prompt and remained near the materials",
        ...overrides,
      },
    ],
  };
}

describe("NotePlan schema and structured validation", () => {
  it("rejects a missing required field at the schema layer", () => {
    const candidate = validPlan() as unknown as { segments: Record<string, unknown>[] };
    delete candidate.segments[0]!.antecedent;
    expect(NotePlanSchema.safeParse(candidate).success).toBe(false);
  });

  it("rejects wrong exact labels", () => {
    const context = buildFrozenSessionContext(generationContext());
    const result = validateNotePlan(validPlan({ behaviorLabel: "Refusal" }), context);
    expect(result.issues.map((issue) => issue.code)).toContain("BEHAVIOR_ASSIGNMENT");
  });

  it("rejects missing and extra segments", () => {
    const context = buildFrozenSessionContext(generationContext());
    expect(validateNotePlan({ segments: [] }, context).issues[0]?.code).toBe("SEGMENT_COVERAGE");
    const extra = { segments: [...validPlan().segments, { ...validPlan().segments[0], segmentIndex: 1 }] };
    expect(validateNotePlan(extra, context).issues.map((issue) => issue.code)).toContain(
      "SEGMENT_COVERAGE",
    );
  });

  it("represents acquisition-only segments without maladaptive behavior or interventions", () => {
    const input = generationContext({
      maladaptiveBehaviorForHour: [""],
      replacementProgramsInOrder: ["Echoic Skills"],
      replacementProgramForHour: ["Echoic Skills"],
      acquisitionOnlySegmentForHour: [true],
      maladaptiveBehaviorFunctionsForHour: [null],
      maladaptiveBehaviorTopographyForHour: [null],
      interventionCandidatesForHour: [[]],
    });
    const context = buildFrozenSessionContext(input);
    const acquisitionPlan = validPlan({
      acquisitionOnly: true,
      behaviorLabel: "",
      topography: "The client oriented toward the modeled object while the RBT presented the sound model",
      interventions: [],
      responseToIntervention: "The client remained positioned near the teaching materials",
      replacementLabel: "Echoic Skills",
    });
    expect(context.segments[0]?.interventionLabels).toEqual([]);
    expect(validateNotePlan(acquisitionPlan, context).issues).toEqual([]);
  });

  it("rejects model-authored counts and percentages", () => {
    const context = buildFrozenSessionContext(generationContext());
    const result = validateNotePlan(
      validPlan({ resultSummary: "The client responded correctly on 3/5 trials" }),
      context,
    );
    expect(result.issues.map((issue) => issue.code)).toContain("FABRICATED_METRIC");
  });
});

describe("deterministic intervention assignment", () => {
  it("puts Response Block first and then the function-matched safety intervention", () => {
    expect(
      assignInterventionsForSegment({
        acquisitionOnly: false,
        behaviorLabel: "Physical Aggression",
        approvedInterventions: ["Escape Extinction", "Response Block", "Redirection"],
        behaviorFunctions: ["escape"],
        functionCandidates: ["Escape Extinction"],
      }),
    ).toEqual(["Response Block", "Escape Extinction"]);
  });

  it("uses one best approved intervention for non-safety behavior", () => {
    expect(
      assignInterventionsForSegment({
        acquisitionOnly: false,
        behaviorLabel: "Task Refusal",
        approvedInterventions: ["Redirection", "Premack principle"],
        behaviorFunctions: ["escape"],
        functionCandidates: ["Premack principle"],
      }),
    ).toEqual(["Premack principle"]);
  });

  it("adds attention NCR only when approved for an attention SIB safety chain", () => {
    expect(
      assignInterventionsForSegment({
        acquisitionOnly: false,
        behaviorLabel: "Self-Injurious Behavior (SIB)",
        approvedInterventions: [
          "Response Block",
          "Differential Reinforcement of Alternative Behavior (DRA)",
          "Attention independent response delivery",
        ],
        behaviorFunctions: ["attention"],
        functionCandidates: ["Differential Reinforcement of Alternative Behavior (DRA)"],
      }),
    ).toEqual([
      "Response Block",
      "Differential Reinforcement of Alternative Behavior (DRA)",
      "Attention independent response delivery",
    ]);
  });
});

describe("server-owned metrics and deterministic assembly", () => {
  it.each([
    [{ totalTrials: 5, successfulTrialNumbers: [] }, 0],
    [{ totalTrials: 5, successfulTrialNumbers: [1, 3] }, 40],
    [{ totalTrials: 5, successfulTrialNumbers: [1, 2, 3, 4, 5] }, 100],
  ])("assembles therapist-entered percentages only (%j)", (summary, expected) => {
    expect(roundedTrialPercentage(summary)).toBe(expected);
    expect(buildDeterministicTrialSentence("Request for Break", summary)).toContain(
      `${expected}% of discrete trials`,
    );
  });

  it("uses truthful no-data wording without inventing metrics", () => {
    const text = buildDeterministicTrialSentence("Request for Break", null);
    expect(text).toContain("no therapist-entered trial summary was available");
    expect(text).not.toMatch(/\d+%|\d+\/\d+/);
  });

  it("assembles exact intervention and replacement naming sentences deterministically", () => {
    const context = buildFrozenSessionContext(
      generationContext({
        therapistTrialSummaryForReplacementHour: [
          { totalTrials: 4, successfulTrialNumbers: [1, 3] },
        ],
      }),
    );
    const body = assembleClinicalBodyFromNotePlan(validPlan(), context);
    expect(body).toContain("To address this behavior, the RBT implemented Premack principle.");
    expect(body).toContain(
      'Additionally, the RBT implemented the replacement program "Request for Break" by',
    );
    expect(body).toContain("approximately 50% of discrete trials");
    expect(body.split(/\n\s*\n/)).toHaveLength(1);
  });

  it("remains compatible with the existing prose validator for locked labels and trial data", () => {
    const input = generationContext({
      therapistTrialSummaryForReplacementHour: [
        { totalTrials: 4, successfulTrialNumbers: [1, 3] },
      ],
    });
    const context = buildFrozenSessionContext(input);
    const body = assembleClinicalBodyFromNotePlan(validPlan(), context);
    const result = validateClinicalBodyComplianceDetailed(body, {
      sessionHours: 1,
      narrativeSegmentCount: 1,
      replacementProgramsInOrder: input.replacementProgramsInOrder,
      replacementProgramForHour: input.replacementProgramForHour,
      maladaptiveBehaviors: input.maladaptiveBehaviors,
      maladaptiveBehaviorForHour: input.maladaptiveBehaviorForHour,
      interventions: input.interventions,
      therapistTrialSummaryForReplacementHour: input.therapistTrialSummaryForReplacementHour,
      clientAgeYears: input.clientAgeYears,
      presentPeople: [],
      acquisitionOnlySegmentForHour: [false],
      maladaptiveBehaviorFunctionsForHour: input.maladaptiveBehaviorFunctionsForHour,
      maladaptiveBehaviorTopographyForHour: input.maladaptiveBehaviorTopographyForHour,
      behaviorToReplacementsMap: input.behaviorToReplacementsMap,
    });
    expect(result.blocking.map((issue) => issue.code)).not.toContain("PROGRAM_ASSIGNMENT");
    expect(result.blocking.map((issue) => issue.code)).not.toContain("TRIAL_DATA");
    expect(result.blocking.map((issue) => issue.code)).not.toContain("INTERVENTION_CATALOG");
  });
});

describe("JSON-only repair orchestration", () => {
  it("repairs invalid structured fields without sending assembled prose", async () => {
    const calls: Parameters<NotePlanModelCall>[0][] = [];
    const modelCall = vi.fn<NotePlanModelCall>(async (request) => {
      calls.push(request);
      return JSON.stringify(request.attempt === 0
        ? validPlan({ behaviorLabel: "Wrong Label" })
        : validPlan());
    });

    const result = await generateClinicalBodyOpenAI(generationContext(), { modelCall });
    expect(modelCall).toHaveBeenCalledTimes(2);
    expect(result.repairAttempts).toBe(1);
    expect(result.planIssues).toEqual([]);
    expect(result.notePlan?.segments[0]?.behaviorLabel).toBe("Task Refusal");
    expect(calls[1]?.messages.at(-1)?.content).toContain("Prior model JSON/output");
    expect(calls[1]?.messages.at(-1)?.content).not.toContain(
      "To address this behavior, the RBT implemented",
    );
  });

  it("repairs a schema-valid assembled-prose defect through JSON only", async () => {
    const calls: Parameters<NotePlanModelCall>[0][] = [];
    const defectivePlan = validPlan({
      responseToIntervention:
        "The RBT re-presented the task materials and repeated the instruction",
    });
    const modelCall = vi.fn<NotePlanModelCall>(async (request) => {
      calls.push(request);
      return JSON.stringify(request.attempt === 0 ? defectivePlan : validPlan());
    });

    const result = await generateClinicalBodyOpenAI(generationContext(), { modelCall });
    expect(modelCall).toHaveBeenCalledTimes(2);
    expect(result.repairAttempts).toBe(1);
    expect(result.planIssues).toEqual([]);
    expect(result.body).toContain("The client returned the red shape");

    const repairPrompt = String(calls[1]?.messages.at(-1)?.content);
    expect(repairPrompt).toContain("PROSE_POST_INTERVENTION_OUTCOME");
    expect(repairPrompt).toContain("Prior model JSON/output");
    expect(repairPrompt).not.toContain("During this activity, the client manifested");
    expect(repairPrompt).not.toContain(
      "To address this behavior, the RBT implemented Premack principle.",
    );
  });

  it("returns blocking compatibility issues after bounded repair is exhausted", async () => {
    const modelCall = vi.fn<NotePlanModelCall>(async () =>
      JSON.stringify(validPlan({ behaviorLabel: "Wrong Label" })),
    );

    const result = await generateClinicalBodyOpenAI(generationContext(), { modelCall });
    expect(modelCall).toHaveBeenCalledTimes(3);
    expect(result.body).toBe("");
    expect(result.repairAttempts).toBe(2);
    expect(result.planIssues.map((issue) => issue.code)).toContain("BEHAVIOR_ASSIGNMENT");
    expect(result.finalIssues.every((issue) => issue.severity === "blocking")).toBe(true);
  });

  it("returns blocking prose issues when JSON repair cannot fix assembled compliance", async () => {
    const defectivePlan = validPlan({
      responseToIntervention:
        "The RBT re-presented the task materials and repeated the instruction",
    });
    const modelCall = vi.fn<NotePlanModelCall>(async () => JSON.stringify(defectivePlan));

    const result = await generateClinicalBodyOpenAI(generationContext(), { modelCall });
    expect(modelCall).toHaveBeenCalledTimes(3);
    expect(result.repairAttempts).toBe(2);
    expect(result.planIssues.map((issue) => issue.code)).toContain(
      "PROSE_POST_INTERVENTION_OUTCOME",
    );
    expect(result.finalIssues.map((issue) => issue.code)).toContain(
      "POST_INTERVENTION_OUTCOME",
    );
    expect(result.finalIssues.every((issue) => issue.severity === "blocking")).toBe(true);
  });
});
