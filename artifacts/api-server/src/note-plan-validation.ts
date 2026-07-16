import {
  findNonContingentReinforcementInterventionLabel,
  isEnvironmentalManipulationInterventionLabel,
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
  isIncompleteTopographyAction,
  isUnusableStoredTopography,
  lastResortObservableTopographyForBehavior,
  paragraphReflectsStoredTopography,
  pickSingleTopographyActionForSegment,
  recoverTopographyFromSegmentProse,
  splitTopographyActionAlternatives,
} from "./maladaptive-behavior-topography";
import { filterReinforcementPreferencesForNote } from "./reinforcer-preferences";

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

const FAMILY_ROLE_SOURCE =
  "(?:aunt|uncle|cousin|sibling|brother|sister|(?:maternal|paternal)\\s+(?:uncle|aunt|grandmother|grandfather)|grandma|grandpa|grandmother|grandfather|relative|family member|maternal|paternal)";
const STAFF_OR_CAREGIVER_ROLE_SOURCE =
  "(?:caregiver|mother|father|mom|dad|parent|guardian|therapist|peers?)";
const THIRD_PARTY_ROLE_SOURCE = `(?:${FAMILY_ROLE_SOURCE}|${STAFF_OR_CAREGIVER_ROLE_SOURCE})`;

function replaceBlockedNames(text: string, blockedClientNames: string[]): string {
  let sanitized = text;
  for (const name of [...new Set(blockedClientNames.map((value) => value.trim()).filter(Boolean))]) {
    const cleaned = name.replace(/[\s,;:()\]]+$/g, "").replace(/^[\s,;:([]+/g, "").trim();
    if (cleaned.length < 2) continue;
    sanitized = sanitized
      .replace(new RegExp(`\\b${escapeRegExp(cleaned)}['’]s\\b`, "gi"), "the client's")
      .replace(new RegExp(`\\b${escapeRegExp(cleaned)}\\b`, "gi"), "the client");
  }
  return sanitized;
}

function sanitizeModelNarrativeText(
  text: string,
  blockedClientNames: string[],
  presentPeople: string[] = [],
): string {
  let sanitized = replaceBlockedNames(text, blockedClientNames);
  for (const person of presentPeople) {
    const cleaned = person
      .trim()
      .replace(/^[\s,;:([]+/g, "")
      .replace(/[\s,;:)\]]+$/g, "")
      .trim();
    if (cleaned.length < 2) continue;
    sanitized = sanitized
      .replace(new RegExp(`\\b${escapeRegExp(cleaned)}['’]s\\b`, "gi"), "another person's")
      .replace(new RegExp(`\\b${escapeRegExp(cleaned)}\\b`, "gi"), "another person");
  }
  return sanitized
    .replace(
      new RegExp(
        `\\b(?:toward|towards)\\s+(?:the\\s+)?${THIRD_PARTY_ROLE_SOURCE}(?:\\s*\\/\\s*${THIRD_PARTY_ROLE_SOURCE})*`,
        "gi",
      ),
      "toward another person",
    )
    .replace(new RegExp(`\\b(?:the\\s+)?${FAMILY_ROLE_SOURCE}['’]s\\b`, "gi"), "another person's")
    .replace(new RegExp(`\\b(?:the\\s+)?${FAMILY_ROLE_SOURCE}\\b`, "gi"), "another person")
    .replace(new RegExp(`\\b(?:the\\s+)?${STAFF_OR_CAREGIVER_ROLE_SOURCE}['’]s\\b`, "gi"), "the RBT's")
    .replace(new RegExp(`\\b(?:the\\s+)?${STAFF_OR_CAREGIVER_ROLE_SOURCE}\\b`, "gi"), "the RBT")
    .replace(/\bthe RBT(?:\s*\/\s*the RBT)+\b/gi, "the RBT")
    .replace(/\banother person(?:\s*\/\s*another person)+\b/gi, "another person")
    // Presence leaks like "and Maternal uncle) remained" → "and remained"
    .replace(/\s+and\s+another person\s*\)+/gi, " and")
    .replace(/\(\s*and\s+another person\s*\)/gi, "")
    .replace(/\s+\)+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Convert an authoritative assessment definition into a bounded narrative clause for
 * "manifested … by …" — session-episode wording, not pasted BIP/VIP legalese.
 * Scoring/timing text and learner names are metadata, not observable episode prose.
 */
export function sanitizeStoredTopographyForNarrative(
  rawTopography: string,
  blockedClientNames: string[] = [],
): string {
  if (isUnusableStoredTopography(rawTopography)) {
    return "";
  }
  let text = replaceBlockedNames(
    rawTopography.trim().replace(/\s+/g, " "),
    blockedClientNames,
  )
    .replace(
      new RegExp(
        `\\b(?:toward|towards)\\s+${THIRD_PARTY_ROLE_SOURCE}(?:\\s*\\/\\s*${THIRD_PARTY_ROLE_SOURCE})*`,
        "gi",
      ),
      "toward another person",
    )
    .replace(new RegExp(`\\b${THIRD_PARTY_ROLE_SOURCE}\\b`, "gi"), "another person")
    .replace(/\banother person(?:\s*\/\s*another person)+\b/gi, "another person");

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
    .replace(
      /^(?:operationally\s+)?(?:characterized by|defined as|definition(?:\s+is)?)\s+/i,
      "",
    )
    .replace(
      /^any\s+(?:instance|episode|incidence|occurrence)\s+(?:in which|when|where|of)\s+/i,
      "",
    )
    .replace(/^when\s+/i, "")
    .replace(/^the client(?!['’]s)\s+/i, "")
    .trim();

  // Prefer concrete action examples after "including …" over abstract definition frames.
  const includingMatch = text.match(/\bincluding\s+(.+)$/i);
  if (
    includingMatch?.[1] &&
    /(?:movement pattern|motor (?:behavior|response)|specific (?:actions?|behaviors?|movements?)|the following)\b/i.test(
      text,
    )
  ) {
    text = includingMatch[1].trim();
  }

  text = text
    .replace(/^(?:frequently|consistently|repeatedly)\s+/i, "")
    .replace(/\s+,?\s*repetitively\b/gi, "")
    .replace(/\bhis\/her\/their\b/gi, "the client's")
    .replace(/\s+/g, " ")
    .trim();

  if (isUnusableStoredTopography(text) || !containsObservableClinicalAction(text)) {
    return "";
  }
  return text;
}

/**
 * Keep model-authored topography when it already describes a natural, observable episode
 * consistent with the stored definition. Only fall back to sanitized BIP wording when the
 * model output is label-only, non-observable, or inconsistent with the assessment.
 */
export function shouldPreferStoredTopographyOverModel(
  modelTopography: string,
  storedTopography: string | null | undefined,
  behaviorLabel: string,
): boolean {
  const stored = storedTopography?.trim() ?? "";
  if (
    !stored ||
    isUnusableStoredTopography(stored) ||
    !containsObservableClinicalAction(stored)
  ) {
    return false;
  }

  const model = modelTopography.trim();
  if (!model || isUnusableStoredTopography(model)) return true;
  if (model.toLowerCase() === behaviorLabel.trim().toLowerCase()) return true;
  if (!containsObservableClinicalAction(model)) return true;

  const manifested = `The client manifested ${behaviorLabel} by ${model}.`;
  if (
    isElopementFamilyBehaviorLabel(behaviorLabel) &&
    elopementEpisodeLacksObservableTopography(manifested, behaviorLabel)
  ) {
    return true;
  }

  // Model prose may paraphrase, but must reflect the stored observable actions strongly enough to pass
  // the FINAL BEHAVIOR_TOPOGRAPHY gate (>=2 stored action tokens in the manifested-behavior sentence).
  // Using the same threshold here means: keep the model's natural wording when it genuinely describes
  // the stored actions, otherwise fall back to the sanitized stored topography (which is derived from
  // the operational definition and therefore always satisfies the gate) so generation is not blocked.
  return !paragraphReflectsStoredTopography(manifested, stored, 2);
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

  // SIB with NO approved Response Block/Response Blocking: the safety validator requires Environmental
  // Manipulation to be the FIRST (and, without a response-blocking label, the ONLY) catalog intervention
  // naming sentence for the segment; protective blocking is then described in plain prose. Because the
  // safety chain is not "allowed" without a Response Block label, INTERVENTION_COUNT permits exactly one
  // catalog naming sentence — so assign only Environmental Manipulation here (a second catalog
  // intervention would trip INTERVENTION_COUNT). See SAFETY_CHAIN + INTERVENTION_COUNT in note-validation.ts.
  if (safetyEligible && isSibMaladaptiveBehaviorLabel(params.behaviorLabel)) {
    const environmentalManipulation = approved.find((label) =>
      isEnvironmentalManipulationInterventionLabel(label),
    );
    if (environmentalManipulation) {
      return [environmentalManipulation];
    }
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
      behaviorTopography: (() => {
        const raw = ctx.maladaptiveBehaviorTopographyForHour[segmentIndex];
        if (!raw || isUnusableStoredTopography(raw)) return null;
        const cleaned = sanitizeStoredTopographyForNarrative(raw, blockedClientNames);
        if (!cleaned) return null;
        // One observable action per ABC hour — do not freeze the full BIP alternative list.
        const single = pickSingleTopographyActionForSegment(cleaned, segmentIndex);
        return single.length > 0 ? single : null;
      })(),
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
    // The model receives the assessment reference plus server-extracted topographies/functions.
    // Raw prose is intentionally withheld because it can contain learner/caregiver names that are
    // forbidden in the clinical body; the authoritative assessment still grounds this context.
    clientAssessmentTextExcerpt: "",
    assessmentReferenceFileName: ctx.assessmentReferenceFileName,
    reinforcementPreferences: filterReinforcementPreferencesForNote(ctx.reinforcementPreferences, {
      clientAgeYears: ctx.clientAgeYears,
    }),
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
 * - when model topography is weak or assessment-inconsistent, use the sanitized BIP clause;
 *   otherwise keep the model's natural session wording (do not paste VIP/BIP definitions);
 * - an observable client result already present in resultSummary is reused when the model
 *   accidentally placed only RBT actions in responseToIntervention.
 */
export function groundNotePlanWithFrozenContext(
  plan: NotePlan,
  context: SessionContext,
  options?: {
    blockedClientNames?: string[] | undefined;
    presentPeople?: string[] | undefined;
  },
): NotePlan {
  const blockedClientNames = options?.blockedClientNames ?? [];
  const presentPeople = options?.presentPeople ?? [];
  return {
    segments: plan.segments.map((segment, index) => {
      const locked = context.segments[index];
      if (!locked) return segment;
      const sanitized = {
        ...segment,
        antecedent: sanitizeModelNarrativeText(
          segment.antecedent,
          blockedClientNames,
          presentPeople,
        ),
        topography: sanitizeModelNarrativeText(
          segment.topography,
          blockedClientNames,
          presentPeople,
        ),
        interventions: segment.interventions.map((intervention) => ({
          ...intervention,
          application: sanitizeModelNarrativeText(
            intervention.application,
            blockedClientNames,
            presentPeople,
          ),
        })),
        responseToIntervention: sanitizeModelNarrativeText(
          segment.responseToIntervention,
          blockedClientNames,
          presentPeople,
        ),
        teachingOrPromptingSummary: sanitizeModelNarrativeText(
          segment.teachingOrPromptingSummary,
          blockedClientNames,
          presentPeople,
        ),
        resultSummary: sanitizeModelNarrativeText(
          segment.resultSummary,
          blockedClientNames,
          presentPeople,
        ),
      };
      let topography = sanitized.topography;
      if (!locked.acquisitionOnly) {
        if (
          shouldPreferStoredTopographyOverModel(
            topography,
            locked.behaviorTopography,
            locked.behaviorLabel,
          ) &&
          locked.behaviorTopography
        ) {
          topography = locked.behaviorTopography;
        } else if (isUnusableStoredTopography(topography)) {
          // Never keep BIP status placeholders ("Status: To be initiated") in the manifested-behavior
          // slot. Prefer stored definition → cues already in other segment fields → last-resort
          // observable phrase for that behavior family. (BIP extract already ran upstream in
          // enrichMaladaptiveTargetsWithAssessmentTopography before the context was frozen.)
          const fromStored =
            locked.behaviorTopography && !isUnusableStoredTopography(locked.behaviorTopography)
              ? locked.behaviorTopography
              : "";
          const fromProse =
            !fromStored
              ? recoverTopographyFromSegmentProse(locked.behaviorLabel, [
                  sanitized.responseToIntervention,
                  sanitized.resultSummary,
                  ...sanitized.interventions.map((item) => item.application),
                ])
              : null;
          const fromLastResort =
            !fromStored && !fromProse
              ? lastResortObservableTopographyForBehavior(locked.behaviorLabel)
              : null;
          topography = fromStored || fromProse || fromLastResort || "";
        }

        // One observable action per ABC — never dump the full BIP "including A, B, or C" list.
        if (topography.trim()) {
          const actions = splitTopographyActionAlternatives(topography);
          if (actions.length > 1) {
            const lockedSingle = locked.behaviorTopography?.trim() ?? "";
            const lockedMatches = lockedSingle
              ? actions.find(
                  (action) =>
                    action.toLowerCase() === lockedSingle.toLowerCase() ||
                    lockedSingle.toLowerCase().includes(action.toLowerCase()) ||
                    action.toLowerCase().includes(lockedSingle.toLowerCase()),
                )
              : undefined;
            topography = lockedMatches ?? pickSingleTopographyActionForSegment(topography, index);
          } else if (actions.length === 1) {
            topography = actions[0]!;
          }
        }
        if (
          !topography.trim() ||
          isUnusableStoredTopography(topography) ||
          isIncompleteTopographyAction(topography)
        ) {
          topography =
            (locked.behaviorTopography &&
            !isUnusableStoredTopography(locked.behaviorTopography) &&
            !isIncompleteTopographyAction(locked.behaviorTopography)
              ? locked.behaviorTopography
              : null) ||
            lastResortObservableTopographyForBehavior(locked.behaviorLabel) ||
            topography;
        }
      }
      const responseToIntervention =
        !locked.acquisitionOnly &&
        !containsObservableClientOutcome(sanitized.responseToIntervention) &&
        containsObservableClientOutcome(sanitized.resultSummary)
          ? sanitized.resultSummary
          : sanitized.responseToIntervention;
      return { ...sanitized, topography, responseToIntervention };
    }),
  };
}

const SUBJECTIVE_RE =
  /\b(upset|frustrated|happy|angry|sad|moody|stubborn|non-?compliant|defiant|rude|lazy|uncooperative|fair performance|bad day|good day|did well|did poorly|appeared|seemed|wanted|felt)\b/i;
const CAREGIVER_RE =
  /\b(caregiver|parents?|guardians?|mother|father|mom|dad|grandmother|grandfather|grandma|grandpa|aunt|uncle|cousin|siblings?|brother|sister|(?:maternal|paternal)\s+(?:uncle|aunt)|family members?)\b/i;
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
      isUnusableStoredTopography(segment.topography) ||
      !containsObservableClinicalAction(segment.topography)
    ) {
      add(
        "TOPOGRAPHY_REQUIRED",
        'topography must describe a specific observable client action for this session episode. Never use BIP status lines such as "Status: To be initiated." Ground details in frozen behaviorTopography actions when provided, but write natural session prose—do not repeat only the behavior label or paste assessment definition wording.',
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
        "Elopement topography must state the observable leaving action or movement toward/beyond a supervised boundary in natural session wording consistent with frozen behaviorTopography.",
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
          "Topography must use observable actions consistent with the stored operational definition, written as natural session prose (not a pasted assessment quotation).",
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
