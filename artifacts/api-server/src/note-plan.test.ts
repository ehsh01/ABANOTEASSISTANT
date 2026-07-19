import { describe, expect, it, vi } from "vitest";
import {
  generateClinicalBodyOpenAI,
  type NoteGenerationContext,
  type NotePlanModelCall,
} from "./openai-notes";
import {
  assembleClinicalBodyFromNotePlan,
  buildDeterministicTrialSentence,
  buildMinimalClinicalBodyFromSessionContext,
  countClinicalParagraphs,
  interventionNamingSentence,
  manifestedBehaviorBridge,
  organicAntecedentLead,
  preserveClinicalParagraphStructure,
  roundedTrialPercentage,
} from "./note-plan-assembly";
import { NotePlanSchema, type NotePlan } from "./note-plan-schema";
import {
  assignInterventionsForSegment,
  buildFrozenSessionContext,
  groundNotePlanWithFrozenContext,
  sanitizeStoredTopographyForNarrative,
  validateNotePlan,
} from "./note-plan-validation";
import {
  countInterventionImplementationsInParagraph,
  validateClinicalBodyComplianceDetailed,
} from "./note-validation";

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

  it("rejects RBT-only response fields before prose assembly", () => {
    const context = buildFrozenSessionContext(generationContext());
    const result = validateNotePlan(
      validPlan({
        responseToIntervention:
          "The RBT re-presented the materials and repeated the instruction",
      }),
      context,
    );
    expect(result.issues.map((issue) => issue.code)).toContain(
      "POST_INTERVENTION_OUTCOME",
    );
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
  it("preserves ABC paragraph separators when a rewrite would collapse them", () => {
    const before = ["Paragraph one with content.", "Paragraph two with content."].join("\n\n");
    const collapsed = before.replace(/\s+/g, " ");
    const preserved = preserveClinicalParagraphStructure(before, collapsed, 2);
    expect(preserved.restored).toBe(true);
    expect(countClinicalParagraphs(preserved.text)).toBe(2);
  });

  it("builds a minimal multi-paragraph clinical body when the model returns nothing", () => {
    const context = buildFrozenSessionContext(
      generationContext({
        sessionHours: 5,
        narrativeSegmentCount: 5,
        maladaptiveBehaviors: ["Task Refusal", "Tantrum", "Elopement"],
        maladaptiveBehaviorForHour: [
          "Task Refusal",
          "Tantrum",
          "Elopement",
          "Task Refusal",
          "Tantrum",
        ],
        replacementProgramForHour: Array.from({ length: 5 }, () => "Request for Break"),
        rbtActionsOnlyOutcomeForHour: Array.from({ length: 5 }, () => false),
        activityAntecedentForHour: Array.from({ length: 5 }, () => null),
        languageMaladaptiveEpisodeForHour: Array.from({ length: 5 }, () => false),
        therapistTrialSummaryForReplacementHour: Array.from({ length: 5 }, () => null),
        acquisitionOnlySegmentForHour: Array.from({ length: 5 }, () => false),
        maladaptiveBehaviorFunctionsForHour: Array.from({ length: 5 }, () => ["escape"] as const),
        maladaptiveBehaviorTopographyForHour: Array.from({ length: 5 }, () => null),
        behaviorReplacementCandidatesForHour: Array.from({ length: 5 }, () => ["Request for Break"]),
        interventionCandidatesForHour: Array.from({ length: 5 }, () => ["Premack principle"]),
        behaviorToReplacementsMap: {
          "Task Refusal": ["Request for Break"],
          Tantrum: ["Request for Break"],
          Elopement: ["Request for Break"],
        },
      }),
    );
    const body = buildMinimalClinicalBodyFromSessionContext(context);
    expect(countClinicalParagraphs(body)).toBe(5);
    expect(body).toContain("Task Refusal");
    expect(body).toContain("Premack principle");
  });

  it("sanitizes assessment definitions into name-free observable topography", () => {
    const sanitized = sanitizeStoredTopographyForNarrative(
      "Defined as any instance in which Anthony repeats a specific movement pattern, including frequently flapping his hands and walking back and forth repetitively. Episodes are scored after 30 seconds.",
      ["Anthony"],
    );
    expect(sanitized).toContain("flapping his hands");
    expect(sanitized).toContain("walking back and forth");
    expect(sanitized).not.toMatch(/defined as|any instance|movement pattern|scored|30 seconds/i);
    expect(sanitized).not.toContain("Anthony");
  });

  it("uses one Excessive Motor topography action per ABC (not the full BIP list)", () => {
    const full =
      "frequently flapping his hands, continuous side-to-side head movement without interruption, walking back and forth repetitively, or engaging in the same activity repeatedly";
    const context = buildFrozenSessionContext(
      generationContext({
        sessionHours: 2,
        narrativeSegmentCount: 2,
        maladaptiveBehaviors: ["Excessive Motor Behavior"],
        maladaptiveBehaviorForHour: ["Excessive Motor Behavior", "Excessive Motor Behavior"],
        replacementProgramForHour: ["Request for Break", "Request for Break"],
        rbtActionsOnlyOutcomeForHour: [false, false],
        activityAntecedentForHour: [null, null],
        languageMaladaptiveEpisodeForHour: [false, false],
        therapistTrialSummaryForReplacementHour: [null, null],
        acquisitionOnlySegmentForHour: [false, false],
        maladaptiveBehaviorFunctionsForHour: [["automatic"], ["automatic"]],
        maladaptiveBehaviorTopographyForHour: [full, full],
        behaviorReplacementCandidatesForHour: [["Request for Break"], ["Request for Break"]],
        interventionCandidatesForHour: [["Premack principle"], ["Premack principle"]],
        behaviorToReplacementsMap: { "Excessive Motor Behavior": ["Request for Break"] },
      }),
    );
    const topo0 = context.segments[0]?.behaviorTopography ?? "";
    const topo1 = context.segments[1]?.behaviorTopography ?? "";
    expect(topo0).toBeTruthy();
    expect(topo1).toBeTruthy();
    // Each frozen hour is a single action — not the comma/or dump.
    expect(topo0).not.toMatch(/,/);
    expect(topo0).not.toMatch(/\bor\b/i);
    expect(topo1).not.toMatch(/,/);
    // Multi-hour notes rotate through distinct actions when several are listed.
    expect(topo0.toLowerCase()).not.toBe(topo1.toLowerCase());

    const grounded = groundNotePlanWithFrozenContext(
      {
        segments: [
          {
            ...validPlan({
              behaviorLabel: "Excessive Motor Behavior",
              topography: full,
            }).segments[0]!,
            segmentIndex: 0,
          },
          {
            ...validPlan({
              behaviorLabel: "Excessive Motor Behavior",
              topography: full,
            }).segments[0]!,
            segmentIndex: 1,
          },
        ],
      },
      context,
    );
    expect(grounded.segments[0]?.topography).not.toMatch(/,/);
    expect(grounded.segments[0]?.topography).not.toMatch(/flapping.*walking|head movement.*flapping/i);
    expect(grounded.segments[0]?.topography).toBe(topo0);
  });

  it("rejects BIP status placeholders as unusable topography", () => {
    expect(sanitizeStoredTopographyForNarrative("Status: To be initiated.")).toBe("");
    expect(sanitizeStoredTopographyForNarrative("To be initiated")).toBe("");
    const grounded = groundNotePlanWithFrozenContext(
      validPlan({
        behaviorLabel: "Property Destruction",
        topography: "Status: To be initiated.",
      }),
      buildFrozenSessionContext(
        generationContext({
          maladaptiveBehaviors: ["Property Destruction"],
          maladaptiveBehaviorForHour: ["Property Destruction"],
          maladaptiveBehaviorTopographyForHour: ["Status: To be initiated."],
          behaviorToReplacementsMap: { "Property Destruction": ["Request for Break"] },
          behaviorReplacementCandidatesForHour: [["Request for Break"]],
        }),
      ),
    );
    expect(grounded.segments[0]?.topography).not.toMatch(/status|to be initiated/i);
    expect(grounded.segments[0]?.topography).toMatch(/throwing|knocking|materials/i);
  });

  it("recovers Climbing topography from application prose when status placeholder was copied", () => {
    const grounded = groundNotePlanWithFrozenContext(
      validPlan({
        behaviorLabel: "Climbing",
        topography: "Status: To be initiated.",
        interventions: [
          {
            label: "Premack principle",
            application:
              "The RBT withheld access while the client had one foot on the couch, then delivered access after the client stepped down",
          },
        ],
      }),
      buildFrozenSessionContext(
        generationContext({
          maladaptiveBehaviors: ["Climbing"],
          maladaptiveBehaviorForHour: ["Climbing"],
          maladaptiveBehaviorTopographyForHour: ["Status: To be initiated."],
          interventions: ["Premack principle"],
          interventionCandidatesForHour: [["Premack principle"]],
          behaviorToReplacementsMap: { Climbing: ["Request for Break"] },
          behaviorReplacementCandidatesForHour: [["Request for Break"]],
        }),
      ),
    );
    expect(grounded.segments[0]?.topography).toMatch(/foot on the couch/i);
    expect(grounded.segments[0]?.topography).not.toMatch(/status|to be initiated/i);
  });

  it("removes forbidden third-party roles from stored behavior definitions", () => {
    const sanitized = sanitizeStoredTopographyForNarrative(
      "Defined as when Anthony uses threats towards caregiver/therapist/peers, vocalizes words, and screams above conversational level.",
      ["Anthony"],
    );
    expect(sanitized).toContain("toward another person");
    expect(sanitized).toMatch(/vocalizes|screams/);
    expect(sanitized).not.toMatch(
      /\b(?:Anthony|caregiver|therapist|peers?)\b/i,
    );
  });

  it("grounds weak motor and elopement topography in the stored assessment definitions", () => {
    const input = generationContext({
      sessionHours: 2,
      narrativeSegmentCount: 2,
      maladaptiveBehaviors: ["Excessive Motor Behavior", "Elopement"],
      maladaptiveBehaviorForHour: ["Excessive Motor Behavior", "Elopement"],
      replacementProgramsInOrder: ["Request for Break"],
      replacementProgramForHour: ["Request for Break", "Request for Break"],
      rbtActionsOnlyOutcomeForHour: [false, false],
      activityAntecedentForHour: [null, null],
      languageMaladaptiveEpisodeForHour: [false, false],
      therapistTrialSummaryForReplacementHour: [null, null],
      acquisitionOnlySegmentForHour: [false, false],
      maladaptiveBehaviorFunctionsForHour: [["automatic"], ["escape"]],
      maladaptiveBehaviorTopographyForHour: [
        "Defined as any instance in which Anthony repeats a movement pattern, including flapping his hands and walking back and forth.",
        "Defined as any episode in which Anthony leaves the supervised area or sprints toward a door without permission.",
      ],
      behaviorReplacementCandidatesForHour: [
        ["Request for Break"],
        ["Request for Break"],
      ],
      interventionCandidatesForHour: [
        ["Premack principle"],
        ["Premack principle"],
      ],
    });
    const context = buildFrozenSessionContext(input, {
      blockedClientNames: ["Anthony"],
    });
    const first = validPlan({
      behaviorLabel: "Excessive Motor Behavior",
      topography: "Excessive Motor Behavior",
    }).segments[0]!;
    const second = {
      ...validPlan({
        behaviorLabel: "Elopement",
        topography: "Elopement",
      }).segments[0]!,
      segmentIndex: 1,
    };
    const grounded = groundNotePlanWithFrozenContext(
      { segments: [first, second] },
      context,
    );
    expect(grounded.segments[0]?.topography).toMatch(/flapping|walking/);
    expect(grounded.segments[1]?.topography).toMatch(/leaves|sprints/);
    expect(grounded.segments[0]?.topography).not.toMatch(/defined as|any instance/i);
    expect(JSON.stringify(grounded)).not.toContain("Anthony");
  });

  it("keeps natural model topography when it already matches the assessment actions", () => {
    const input = generationContext({
      maladaptiveBehaviorTopographyForHour: [
        "Defined as any instance in which Anthony repeats a movement pattern, including flapping his hands and walking back and forth.",
      ],
    });
    const context = buildFrozenSessionContext(input, {
      blockedClientNames: ["Anthony"],
    });
    // Model already used a single action that reflects the assessment — keep that natural wording.
    const natural = "flapping both hands near the work materials";
    const grounded = groundNotePlanWithFrozenContext(
      validPlan({ topography: natural }),
      context,
    );
    expect(grounded.segments[0]?.topography).toBe(natural);
    expect(grounded.segments[0]?.topography).not.toMatch(/defined as|movement pattern|including|,/i);
  });

  it("varies manifested bridges and strips leading During from antecedents", () => {
    expect(manifestedBehaviorBridge(0)).not.toMatch(/^During\b/i);
    expect(manifestedBehaviorBridge(1)).not.toBe(manifestedBehaviorBridge(0));
    expect(organicAntecedentLead("During table work, the RBT presented cards", 0)).toMatch(
      /^While table work/i,
    );
    expect(organicAntecedentLead("During table work, the RBT presented cards", 1)).toMatch(
      /^As table work/i,
    );
    const context = buildFrozenSessionContext(generationContext());
    const body = assembleClinicalBodyFromNotePlan(validPlan(), context);
    expect(body).not.toMatch(/\bDuring this activity\b/i);
    expect(body).toMatch(/\bthe client manifested Task Refusal by\b/i);
  });

  it("varies intervention naming leads while preserving the countable clause", () => {
    // Segment 0 keeps the canonical opener; every variant still ends with "the RBT implemented X."
    expect(interventionNamingSentence("Premack principle", 0, 0)).toBe(
      "To address this behavior, the RBT implemented Premack principle.",
    );
    expect(interventionNamingSentence("Premack principle", 1, 0)).not.toBe(
      interventionNamingSentence("Premack principle", 0, 0),
    );
    // A 2nd label within a segment (safety chain) uses a follow-on lead, not "To address".
    expect(interventionNamingSentence("Response Block", 2, 1)).toMatch(
      /\bimplemented Response Block\.$/,
    );
    expect(interventionNamingSentence("Response Block", 2, 1)).not.toMatch(/^To address/);
    for (let i = 0; i < 6; i++) {
      expect(interventionNamingSentence("Redirection", i, 0)).toMatch(
        /\bimplemented Redirection\.$/,
      );
    }
  });

  it("keeps every trial-sentence variant validator-safe", () => {
    const summary = { totalTrials: 4, successfulTrialNumbers: [1, 3] };
    for (let i = 0; i < 4; i++) {
      const line = buildDeterministicTrialSentence("Request for Break", summary, i);
      // 50% present and tied to the program in every variant; no N-out-of-M rollup.
      expect(line).toContain("50%");
      expect(line).toContain('Request for Break');
      expect(line).not.toMatch(/\b2\s+out\s+of\s+4\b/);
    }
    // Default seed keeps the canonical "of discrete trials" phrasing for fixture stability.
    expect(buildDeterministicTrialSentence("Request for Break", summary)).toContain(
      "50% of discrete trials",
    );
  });

  it("strips maternal-uncle style presence leaks from narrative fields", () => {
    const grounded = groundNotePlanWithFrozenContext(
      validPlan({
        resultSummary:
          "The client completed the placement and Maternal uncle) remained near the materials",
      }),
      buildFrozenSessionContext(generationContext()),
      { presentPeople: ["Mother", "Maternal uncle)"] },
    );
    expect(grounded.segments[0]?.resultSummary).not.toMatch(/maternal|uncle|\)/i);
    expect(grounded.segments[0]?.resultSummary).toBe(
      "The client completed the placement and remained near the materials",
    );
  });

  it("moves an existing observable result into the post-intervention outcome slot", () => {
    const context = buildFrozenSessionContext(generationContext());
    const grounded = groundNotePlanWithFrozenContext(
      validPlan({
        responseToIntervention:
          "The RBT re-presented the materials and repeated the instruction",
        resultSummary:
          "The client returned the red shape and remained near the materials",
      }),
      context,
    );
    expect(grounded.segments[0]?.responseToIntervention).toContain(
      "The client returned the red shape",
    );
    const body = assembleClinicalBodyFromNotePlan(grounded, context);
    expect(body.match(/The client returned the red shape/g)).toHaveLength(1);
    const result = validateClinicalBodyComplianceDetailed(body, {
      sessionHours: 1,
      narrativeSegmentCount: 1,
      replacementProgramsInOrder: ["Request for Break"],
      replacementProgramForHour: ["Request for Break"],
      maladaptiveBehaviors: ["Task Refusal"],
      maladaptiveBehaviorForHour: ["Task Refusal"],
      interventions: ["Premack principle"],
      therapistTrialSummaryForReplacementHour: [null],
      clientAgeYears: 8,
      presentPeople: [],
      acquisitionOnlySegmentForHour: [false],
      maladaptiveBehaviorFunctionsForHour: [["escape"]],
      maladaptiveBehaviorTopographyForHour: [
        "pushing task materials away and turning the head from the work area",
      ],
      behaviorToReplacementsMap: { "Task Refusal": ["Request for Break"] },
    });
    expect(result.blocking.map((issue) => issue.code)).not.toContain(
      "POST_INTERVENTION_OUTCOME",
    );
  });

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
    expect(text).toBe("");
    expect(text).not.toMatch(/therapist-entered|percentage|available/i);
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

  it("documents only the server-locked intervention even when the model lists more (no INTERVENTION_COUNT)", () => {
    const input = generationContext({
      interventions: ["Premack principle", "Redirection"],
      interventionCandidatesForHour: [["Premack principle"]],
    });
    const context = buildFrozenSessionContext(input);
    expect(context.segments[0]?.interventionLabels).toEqual(["Premack principle"]);

    const body = assembleClinicalBodyFromNotePlan(
      validPlan({
        interventions: [
          {
            label: "Premack principle",
            application:
              "The RBT presented the required placement before access to the preferred shape toy",
          },
          {
            label: "Redirection",
            application: "The RBT guided the client back toward the presented task materials",
          },
        ],
        resultSummary:
          "The client completed the placement after the RBT implemented Redirection. and remained near the materials",
      }),
      context,
    );

    expect(
      countInterventionImplementationsInParagraph(body, input.interventions),
    ).toBe(1);
    expect(body).toContain("To address this behavior, the RBT implemented Premack principle.");
    expect(body).not.toMatch(/implemented Redirection\./i);

    const result = validateClinicalBodyComplianceDetailed(body, {
      sessionHours: 1,
      narrativeSegmentCount: 1,
      replacementProgramsInOrder: input.replacementProgramsInOrder,
      replacementProgramForHour: input.replacementProgramForHour,
      maladaptiveBehaviors: input.maladaptiveBehaviors,
      maladaptiveBehaviorForHour: input.maladaptiveBehaviorForHour,
      interventions: input.interventions,
      therapistTrialSummaryForReplacementHour: [null],
      clientAgeYears: input.clientAgeYears,
      presentPeople: [],
      acquisitionOnlySegmentForHour: [false],
      maladaptiveBehaviorFunctionsForHour: input.maladaptiveBehaviorFunctionsForHour,
      maladaptiveBehaviorTopographyForHour: input.maladaptiveBehaviorTopographyForHour,
      behaviorToReplacementsMap: input.behaviorToReplacementsMap,
    });
    expect(result.blocking.map((issue) => issue.code)).not.toContain("INTERVENTION_COUNT");
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
  it("stabilizes the six-hour production failure pattern before prose validation", async () => {
    const behaviors = [
      "Task Refusal",
      "Task Refusal",
      "Excessive Motor Behavior",
      "Defiant Behavior",
      "Task Refusal",
      "Elopement",
    ];
    const storedTopographies = [
      "pushing task materials away and turning the head from the work area",
      "pushing task materials away and turning the head from the work area",
      "Defined as any instance in which Anthony repeats a movement pattern, including flapping his hands and walking back and forth.",
      "Defined as when Anthony uses threats towards caregiver/therapist/peers, vocalizes words, and screams above conversational level.",
      "pushing task materials away and turning the head from the work area",
      "Defined as any episode in which Anthony leaves the supervised area or sprints toward a door without permission.",
    ];
    const input = generationContext({
      firstName: "Anthony",
      sessionHours: 6,
      narrativeSegmentCount: 6,
      maladaptiveBehaviors: [
        "Task Refusal",
        "Excessive Motor Behavior",
        "Defiant Behavior",
        "Elopement",
      ],
      maladaptiveBehaviorForHour: behaviors,
      replacementProgramForHour: Array.from(
        { length: 6 },
        () => "Request for Break",
      ),
      rbtActionsOnlyOutcomeForHour: Array.from({ length: 6 }, () => false),
      activityAntecedentForHour: Array.from({ length: 6 }, () => null),
      languageMaladaptiveEpisodeForHour: Array.from(
        { length: 6 },
        () => false,
      ),
      therapistTrialSummaryForReplacementHour: Array.from(
        { length: 6 },
        () => null,
      ),
      acquisitionOnlySegmentForHour: Array.from({ length: 6 }, () => false),
      maladaptiveBehaviorFunctionsForHour: Array.from(
        { length: 6 },
        () => ["escape"] as const,
      ),
      maladaptiveBehaviorTopographyForHour: storedTopographies,
      behaviorReplacementCandidatesForHour: Array.from({ length: 6 }, () => [
        "Request for Break",
      ]),
      interventionCandidatesForHour: Array.from({ length: 6 }, () => [
        "Premack principle",
      ]),
      behaviorToReplacementsMap: {
        "Task Refusal": ["Request for Break"],
        "Excessive Motor Behavior": ["Request for Break"],
        "Defiant Behavior": ["Request for Break"],
        Elopement: ["Request for Break"],
      },
    });
    const weakPlan: NotePlan = {
      segments: behaviors.map((behaviorLabel, segmentIndex) => ({
        ...validPlan().segments[0]!,
        segmentIndex,
        behaviorLabel,
        antecedent:
          segmentIndex === 0
            ? "Anthony sat at the table while the RBT placed task materials 1 and presented the instruction to begin step 1"
            : `The RBT placed task materials ${segmentIndex + 1} on the table and presented the instruction to begin step ${segmentIndex + 1}`,
        topography:
          segmentIndex === 2 || segmentIndex === 3 || segmentIndex === 5
            ? behaviorLabel
            : validPlan().segments[0]!.topography,
        interventions:
          segmentIndex === 3
            ? [
                {
                  label: "Premack principle",
                  application:
                    "The caregiver pointed to the required response before access to the preferred item",
                },
              ]
            : validPlan().segments[0]!.interventions,
        responseToIntervention:
          segmentIndex < 2
            ? "The RBT re-presented the materials and repeated the instruction"
            : validPlan().segments[0]!.responseToIntervention,
        resultSummary:
          segmentIndex < 2
            ? "The client returned the presented material and remained near the table"
            : validPlan().segments[0]!.resultSummary,
      })),
    };
    const modelCall = vi.fn<NotePlanModelCall>(async () =>
      JSON.stringify(weakPlan),
    );

    const result = await generateClinicalBodyOpenAI(input, {
      blockedClientNames: ["Anthony"],
      modelCall,
    });

    expect(modelCall).toHaveBeenCalledTimes(1);
    expect(result.repairAttempts).toBe(0);
    expect(result.finalIssues.filter((issue) => issue.severity === "blocking")).toEqual([]);
    expect(result.body.split(/\n\s*\n/)).toHaveLength(6);
    expect(result.body.split(/\n\s*\n/)[2]).toMatch(/flapping|walking/);
    expect(result.body.split(/\n\s*\n/)[5]).toMatch(/leaves|sprints|sprinting|leaving/);
    expect(result.body).not.toContain("Anthony");
    expect(result.body).not.toMatch(/\b(?:caregiver|peers?)\b/i);
  });

  it("force-locks wrong model labels without a repair call", async () => {
    const modelCall = vi.fn<NotePlanModelCall>(async () =>
      JSON.stringify(validPlan({ behaviorLabel: "Wrong Label" })),
    );

    const result = await generateClinicalBodyOpenAI(generationContext(), { modelCall });
    expect(modelCall).toHaveBeenCalledTimes(1);
    expect(result.repairAttempts).toBe(0);
    expect(result.planIssues).toEqual([]);
    expect(result.notePlan?.segments[0]?.behaviorLabel).toBe("Task Refusal");
    expect(result.notePlan?.segments[0]?.interventions.map((i) => i.label)).toEqual([
      "Premack principle",
    ]);
  });

  it("repairs an outcome field through JSON when no existing result can be reused", async () => {
    const calls: Parameters<NotePlanModelCall>[0][] = [];
    const defectivePlan = validPlan({
      responseToIntervention:
        "The RBT re-presented the task materials and repeated the instruction",
      resultSummary:
        "The RBT continued the teaching sequence and recorded the response",
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
    expect(repairPrompt).toContain("POST_INTERVENTION_OUTCOME");
    expect(repairPrompt).toContain("Prior model JSON/output");
    expect(repairPrompt).not.toContain("During this activity, the client manifested");
    expect(repairPrompt).not.toContain(
      "To address this behavior, the RBT implemented Premack principle.",
    );
  });

  it("returns blocking compatibility issues after bounded repair is exhausted", async () => {
    // Persistently invalid JSON cannot be force-locked or grounded — exhausts repair budget.
    const modelCall = vi.fn<NotePlanModelCall>(async () => "{not-valid-json");

    const result = await generateClinicalBodyOpenAI(generationContext(), { modelCall });
    expect(modelCall).toHaveBeenCalledTimes(5);
    expect(result.body).toBe("");
    expect(result.repairAttempts).toBe(4);
    expect(result.finalIssues.every((issue) => issue.severity === "blocking")).toBe(true);
  });

  it("returns a blocking outcome issue when bounded JSON repair cannot fix it", async () => {
    const defectivePlan = validPlan({
      responseToIntervention:
        "The RBT re-presented the task materials and repeated the instruction",
      resultSummary:
        "The RBT continued the teaching sequence and recorded the response",
    });
    const modelCall = vi.fn<NotePlanModelCall>(async () => JSON.stringify(defectivePlan));

    const result = await generateClinicalBodyOpenAI(generationContext(), { modelCall });
    expect(modelCall).toHaveBeenCalledTimes(5);
    expect(result.repairAttempts).toBe(4);
    expect(result.planIssues.map((issue) => issue.code)).toContain(
      "POST_INTERVENTION_OUTCOME",
    );
    expect(result.finalIssues.map((issue) => issue.code)).toContain(
      "POST_INTERVENTION_OUTCOME",
    );
    expect(result.finalIssues.every((issue) => issue.severity === "blocking")).toBe(true);
  });
});
