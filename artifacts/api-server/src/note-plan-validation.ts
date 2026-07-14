import {
  findNonContingentReinforcementInterventionLabel,
  isResponseBlockInterventionLabel,
  isSibMaladaptiveBehaviorLabel,
  preferredInterventionCandidatesForBehaviorFunction,
} from "./behavior-function-intervention-mapping";
import { assignedBehaviorAllowsResponseBlockSafetyChain } from "./response-block-eligibility";
import { findResponseBlockInterventionLabel, selectSecondSafetyChainIntervention } from "./safety-chain-enforcement";
import {
  NotePlanSchema,
  SessionContextSchema,
  type NotePlan,
  type SessionContext,
} from "./note-plan-schema";

export type NotePlanIssueCode =
  | "SCHEMA_INVALID"
  | "SEGMENT_COVERAGE"
  | "SEGMENT_INDEX"
  | "BEHAVIOR_ASSIGNMENT"
  | "PROGRAM_ASSIGNMENT"
  | "INTERVENTION_ASSIGNMENT"
  | "CATALOG_MEMBERSHIP"
  | "ACQUISITION_ONLY"
  | "TOPOGRAPHY_REQUIRED"
  | "TOPOGRAPHY_ASSESSMENT_MISMATCH"
  | "CLIENT_NAME_LEAKAGE"
  | "CAREGIVER_LEAKAGE"
  | "SUBJECTIVE_LANGUAGE"
  | "FABRICATED_METRIC"
  | `PROSE_${string}`;

export type NotePlanIssue = {
  code: NotePlanIssueCode;
  message: string;
  segmentIndex?: number | undefined;
  path?: string | undefined;
};

type RuntimeGenerationContext = {
  narrativeSegmentCount: number;
  therapySetting: string;
  gender: string | null | undefined;
  clientAgeYears: number | null;
  ageBand: string | null | undefined;
  environmentalChanges: string;
  clientAssessmentTextExcerpt: string;
  assessmentReferenceFileName: string | null;
  reinforcementPreferences: string[];
  maladaptiveBehaviors: string[];
  replacementProgramsInOrder: string[];
  interventions: string[];
  maladaptiveBehaviorForHour: string[];
  replacementProgramForHour: string[];
  acquisitionOnlySegmentForHour: boolean[];
  activityAntecedentForHour: (string | null)[];
  maladaptiveBehaviorTopographyForHour: (string | null)[];
  maladaptiveBehaviorFunctionsForHour: (
    | ("attention" | "escape" | "tangible" | "automatic")[]
    | null
  )[];
  therapistTrialSummaryForReplacementHour: ({
    totalTrials: number;
    successfulTrialNumbers: number[];
  } | null)[];
  rbtActionsOnlyOutcomeForHour: boolean[];
  interventionCandidatesForHour: string[][];
};

function uniqueLabels(labels: string[]): string[] {
  return [...new Set(labels.map((label) => label.trim()).filter(Boolean))];
}

/**
 * Lock the intervention sequence before the model call.
 * Acquisition-only segments have no maladaptive intervention chain.
 */
export function assignInterventionsForSegment(params: {
  acquisitionOnly: boolean;
  behaviorLabel: string;
  approvedInterventions: string[];
  behaviorFunctions: ("attention" | "escape" | "tangible" | "automatic")[] | null;
  functionCandidates?: string[] | undefined;
}): string[] {
  if (params.acquisitionOnly) return [];

  const approved = uniqueLabels(params.approvedInterventions);
  const candidates = uniqueLabels(params.functionCandidates ?? []).filter((label) =>
    approved.includes(label),
  );
  const responseBlock = findResponseBlockInterventionLabel(approved);
  const safetyEligible = assignedBehaviorAllowsResponseBlockSafetyChain(params.behaviorLabel);

  if (responseBlock && safetyEligible) {
    const assigned = [responseBlock];
    const second = selectSecondSafetyChainIntervention({
      assignedBehavior: params.behaviorLabel,
      interventions: approved,
      behaviorFunctions: params.behaviorFunctions,
      interventionCandidatesForHour: candidates,
    });
    if (second && !assigned.includes(second)) assigned.push(second);

    const requiresAttentionNcr =
      isSibMaladaptiveBehaviorLabel(params.behaviorLabel) &&
      params.behaviorFunctions?.includes("attention") === true;
    const ncr = requiresAttentionNcr
      ? findNonContingentReinforcementInterventionLabel(approved)
      : null;
    if (ncr && !assigned.includes(ncr)) assigned.push(ncr);
    return assigned;
  }

  const preferred =
    candidates[0] ??
    preferredInterventionCandidatesForBehaviorFunction(
      approved,
      params.behaviorFunctions,
      params.behaviorLabel,
    ).find((label) => !isResponseBlockInterventionLabel(label)) ??
    approved.find((label) => !isResponseBlockInterventionLabel(label));
  return preferred ? [preferred] : [];
}

export function buildFrozenSessionContext(ctx: RuntimeGenerationContext): SessionContext {
  const segments = Array.from({ length: ctx.narrativeSegmentCount }, (_, segmentIndex) => {
    const acquisitionOnly = ctx.acquisitionOnlySegmentForHour[segmentIndex] === true;
    const behaviorLabel = acquisitionOnly
      ? ""
      : (ctx.maladaptiveBehaviorForHour[segmentIndex]?.trim() ?? "");
    return {
      segmentIndex,
      acquisitionOnly,
      behaviorLabel,
      replacementLabel: ctx.replacementProgramForHour[segmentIndex]?.trim() ?? "",
      interventionLabels: assignInterventionsForSegment({
        acquisitionOnly,
        behaviorLabel,
        approvedInterventions: ctx.interventions,
        behaviorFunctions: ctx.maladaptiveBehaviorFunctionsForHour[segmentIndex] ?? null,
        functionCandidates: ctx.interventionCandidatesForHour[segmentIndex],
      }),
      activityAntecedent: ctx.activityAntecedentForHour[segmentIndex] ?? null,
      behaviorTopography: ctx.maladaptiveBehaviorTopographyForHour[segmentIndex] ?? null,
      behaviorFunctions: ctx.maladaptiveBehaviorFunctionsForHour[segmentIndex] ?? null,
      trialSummary: ctx.therapistTrialSummaryForReplacementHour[segmentIndex] ?? null,
      rbtActionsOnlyOutcome: ctx.rbtActionsOnlyOutcomeForHour[segmentIndex] === true,
    };
  });

  return SessionContextSchema.parse({
    narrativeSegmentCount: ctx.narrativeSegmentCount,
    therapySetting: ctx.therapySetting,
    gender: ctx.gender ?? null,
    clientAgeYears: ctx.clientAgeYears,
    ageBand: ctx.ageBand ?? null,
    environmentalChanges: ctx.environmentalChanges,
    clientAssessmentTextExcerpt: ctx.clientAssessmentTextExcerpt,
    assessmentReferenceFileName: ctx.assessmentReferenceFileName,
    reinforcementPreferences: ctx.reinforcementPreferences,
    segments,
    planCatalogSnapshot: {
      behaviors: uniqueLabels(ctx.maladaptiveBehaviors),
      replacements: uniqueLabels(ctx.replacementProgramsInOrder),
      interventions: uniqueLabels(ctx.interventions),
    },
    validationProfile: "phase-3-strict",
  });
}

const SUBJECTIVE_RE =
  /\b(upset|frustrated|happy|angry|sad|moody|stubborn|non-?compliant|defiant|rude|lazy|uncooperative|fair performance|bad day|good day|did well|did poorly|appeared|seemed|wanted|felt)\b/i;
const CAREGIVER_RE = /\b(caregiver|mother|father|mom|dad|parent|guardian|grandmother|grandfather)\b/i;
const METRIC_RE = /\b\d+\s*%|\b\d+\s*\/\s*\d+\b|\b\d+\s+(?:of\s+\d+\s+)?(?:trials?|opportunities?|responses?|intervals?)\b/i;

function segmentText(segment: NotePlan["segments"][number]): string {
  return [
    segment.antecedent,
    segment.topography,
    ...segment.interventions.flatMap((item) => [item.label, item.application]),
    segment.responseToIntervention,
    segment.replacementLabel,
    segment.teachingOrPromptingSummary,
    segment.resultSummary,
  ].join(" ");
}

function meaningfulTokens(text: string): string[] {
  const stop = new Set([
    "the", "and", "that", "this", "with", "from", "client", "behavior", "defined", "when",
    "into", "during", "their", "then", "was", "were", "for", "not",
  ]);
  return [...new Set((text.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((word) => !stop.has(word)))];
}

export function validateNotePlan(
  candidate: unknown,
  context: SessionContext,
  options?: { blockedClientNames?: string[]; presentPeople?: string[] },
): { plan: NotePlan | null; issues: NotePlanIssue[] } {
  const parsed = NotePlanSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      plan: null,
      issues: parsed.error.issues.map((issue) => {
        const segmentPathIndex = issue.path[0] === "segments" && typeof issue.path[1] === "number"
          ? issue.path[1]
          : undefined;
        return {
          code: "SCHEMA_INVALID",
          message: issue.message,
          segmentIndex: segmentPathIndex,
          path: issue.path.join("."),
        };
      }),
    };
  }

  const plan = parsed.data;
  const issues: NotePlanIssue[] = [];
  const add = (code: NotePlanIssueCode, message: string, segmentIndex?: number) =>
    issues.push({ code, message, segmentIndex });

  if (plan.segments.length !== context.narrativeSegmentCount) {
    add(
      "SEGMENT_COVERAGE",
      `Expected ${context.narrativeSegmentCount} segments; received ${plan.segments.length}.`,
    );
  }

  for (let index = 0; index < plan.segments.length; index++) {
    const segment = plan.segments[index]!;
    const locked = context.segments[index];
    if (!locked) {
      add("SEGMENT_COVERAGE", "Unexpected extra segment.", index);
      continue;
    }
    if (segment.segmentIndex !== index) {
      add("SEGMENT_INDEX", `segmentIndex must be ${index}.`, index);
    }
    if (segment.acquisitionOnly !== locked.acquisitionOnly) {
      add("ACQUISITION_ONLY", "Acquisition-only flag differs from the frozen context.", index);
    }
    if (segment.behaviorLabel !== locked.behaviorLabel) {
      add("BEHAVIOR_ASSIGNMENT", "Behavior label differs from the frozen segment assignment.", index);
    }
    if (segment.replacementLabel !== locked.replacementLabel) {
      add("PROGRAM_ASSIGNMENT", "Replacement label differs from the frozen segment assignment.", index);
    }

    const interventionLabels = segment.interventions.map((item) => item.label);
    if (JSON.stringify(interventionLabels) !== JSON.stringify(locked.interventionLabels)) {
      add("INTERVENTION_ASSIGNMENT", "Intervention labels/order differ from the frozen assignment.", index);
    }
    for (const label of interventionLabels) {
      if (!context.planCatalogSnapshot.interventions.includes(label)) {
        add("CATALOG_MEMBERSHIP", `Unsupported intervention label "${label}".`, index);
      }
    }
    if (
      segment.behaviorLabel &&
      !context.planCatalogSnapshot.behaviors.includes(segment.behaviorLabel)
    ) {
      add("CATALOG_MEMBERSHIP", `Unsupported behavior label "${segment.behaviorLabel}".`, index);
    }
    if (!context.planCatalogSnapshot.replacements.includes(segment.replacementLabel)) {
      add("CATALOG_MEMBERSHIP", `Unsupported replacement label "${segment.replacementLabel}".`, index);
    }

    if (locked.acquisitionOnly) {
      if (segment.behaviorLabel !== "" || segment.interventions.length !== 0) {
        add(
          "ACQUISITION_ONLY",
          "Acquisition-only segments must omit maladaptive behavior and intervention chains.",
          index,
        );
      }
    } else if (!segment.topography.trim()) {
      add("TOPOGRAPHY_REQUIRED", "Observable topography is required.", index);
    }

    if (locked.behaviorTopography) {
      const expectedTokens = meaningfulTokens(locked.behaviorTopography);
      const actual = segment.topography.toLowerCase();
      if (expectedTokens.length > 0 && !expectedTokens.some((token) => actual.includes(token))) {
        add(
          "TOPOGRAPHY_ASSESSMENT_MISMATCH",
          "Topography does not reflect the stored operational definition.",
          index,
        );
      }
    }

    const text = segmentText(segment);
    if (SUBJECTIVE_RE.test(text)) {
      add("SUBJECTIVE_LANGUAGE", "Fields must contain observable language only.", index);
    }
    if (CAREGIVER_RE.test(text)) {
      add("CAREGIVER_LEAKAGE", "Caregiver language is not allowed in the clinical body plan.", index);
    }
    if (METRIC_RE.test(text)) {
      add(
        "FABRICATED_METRIC",
        "Counts and percentages are server-controlled and must not appear in model fields.",
        index,
      );
    }
    const blockedNames = [
      ...(options?.blockedClientNames ?? []),
      ...(options?.presentPeople ?? []),
    ].map((name) => name.trim()).filter((name) => name.length >= 2);
    if (blockedNames.some((name) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text))) {
      add("CLIENT_NAME_LEAKAGE", "A blocked personal name appears in model fields.", index);
    }
  }

  return { plan, issues };
}
