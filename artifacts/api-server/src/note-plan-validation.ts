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
import {
  containsObservableClinicalAction,
  containsObservableClientOutcome,
} from "./observable-clinical-language";
import {
  elopementEpisodeLacksObservableTopography,
  isElopementFamilyBehaviorLabel,
} from "./maladaptive-behavior-topography";

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
  | "POST_INTERVENTION_OUTCOME"
  | `PROSE_${string}`;

export type NotePlanIssue = {
  code: NotePlanIssueCode;
  message: string;
  segmentIndex?: number | undefined;
  path?: string | undefined;
};

type RuntimeGenerationContext = {
  firstName?: string | undefined;
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Convert an authoritative assessment definition into a bounded narrative clause.
 * Scoring/timing text and learner names are metadata, not observable episode prose.
 */
export function sanitizeStoredTopographyForNarrative(
  rawTopography: string,
  blockedClientNames: string[] = [],
): string {
  let text = rawTopography.trim().replace(/\s+/g, " ");
  for (const name of [...new Set(blockedClientNames.map((value) => value.trim()).filter(Boolean))]) {
    text = text
      .replace(new RegExp(`\\b${escapeRegExp(name)}['’]s\\b`, "gi"), "the client's")
      .replace(new RegExp(`\\b${escapeRegExp(name)}\\b`, "gi"), "the client");
  }

  const descriptiveSentence =
    text
      .split(/(?<=[.!?])\s+/)
      .find(
        (sentence) =>
          !/^(?:episodes?|responses?|instances?)\s+(?:are|were|must|should)\b/i.test(sentence) &&
          !/^(?:scor(?:ed|ing)|data are|an instance is)\b/i.test(sentence),
      ) ?? text;
  text = descriptiveSentence
    .replace(/[.!?]+$/, "")
    .replace(/\s+(?:for|lasting)\s+(?:at least\s+)?\d+\s*(?:seconds?|minutes?)\b[\s\S]*$/i, "")
    .replace(/^(?:characterized by|defined as)\s+/i, "")
    .replace(
      /^any\s+(?:instance|episode|incidence|occurrence)\s+(?:in which|when|where|of)\s+/i,
      "",
    )
    .replace(/^when\s+/i, "")
    .replace(/^the client(?!['’]s)\s+/i, "")
    .trim();

  return text;
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

export function buildFrozenSessionContext(
  ctx: RuntimeGenerationContext,
  options?: { blockedClientNames?: string[] | undefined },
): SessionContext {
  const blockedClientNames = [
    ...(options?.blockedClientNames ?? []),
    ...(ctx.firstName && !/^the client$/i.test(ctx.firstName.trim()) ? [ctx.firstName] : []),
  ];
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
      behaviorTopography: ctx.maladaptiveBehaviorTopographyForHour[segmentIndex]
        ? sanitizeStoredTopographyForNarrative(
            ctx.maladaptiveBehaviorTopographyForHour[segmentIndex]!,
            blockedClientNames,
          )
        : null,
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

/**
 * Apply only source-preserving corrections before validation:
 * - authoritative stored topography replaces a weaker model restatement;
 * - an observable client result already present in resultSummary is reused when the model
 *   accidentally placed only RBT actions in responseToIntervention.
 */
export function groundNotePlanWithFrozenContext(
  plan: NotePlan,
  context: SessionContext,
): NotePlan {
  return {
    segments: plan.segments.map((segment, index) => {
      const locked = context.segments[index];
      if (!locked) return segment;
      const topography =
        !locked.acquisitionOnly &&
        locked.behaviorTopography &&
        containsObservableClinicalAction(locked.behaviorTopography)
          ? locked.behaviorTopography
          : segment.topography;
      const responseToIntervention =
        !locked.acquisitionOnly &&
        !containsObservableClientOutcome(segment.responseToIntervention) &&
        containsObservableClientOutcome(segment.resultSummary)
          ? segment.resultSummary
          : segment.responseToIntervention;
      return { ...segment, topography, responseToIntervention };
    }),
  };
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
    } else if (
      !segment.topography.trim() ||
      !containsObservableClinicalAction(segment.topography)
    ) {
      add(
        "TOPOGRAPHY_REQUIRED",
        "topography must describe a specific observable client action. Use the frozen behaviorTopography wording when provided; do not repeat only the behavior label or write a generic movement category.",
        index,
      );
    } else if (
      isElopementFamilyBehaviorLabel(locked.behaviorLabel) &&
      elopementEpisodeLacksObservableTopography(
        `The client manifested ${locked.behaviorLabel} by ${segment.topography}.`,
        locked.behaviorLabel,
      )
    ) {
      add(
        "TOPOGRAPHY_REQUIRED",
        "Elopement topography must state the observable leaving action or movement toward/beyond a supervised boundary. Use the frozen behaviorTopography wording.",
        index,
      );
    }

    if (
      !locked.acquisitionOnly &&
      !containsObservableClientOutcome(segment.responseToIntervention)
    ) {
      add(
        "POST_INTERVENTION_OUTCOME",
        'responseToIntervention must state an observable client result after the intervention in the form "The client [observable action] ..."; RBT actions alone are not an outcome. If resultSummary already contains that observed result, copy the same supported fact into responseToIntervention.',
        index,
      );
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
