import {
  findNonContingentReinforcementInterventionLabel,
  inferBehaviorFunctionsFromLabel,
  isAttentionOnlyInterventionLabel,
  isEnvironmentalManipulationInterventionLabel,
  isResponseBlockInterventionLabel,
  isSibMaladaptiveBehaviorLabel,
  preferredInterventionCandidatesForBehaviorFunction,
} from "./behavior-function-intervention-mapping";
import {
  assignedBehaviorAllowsResponseBlockSafetyChain,
  isPhysicalAggressionBehaviorLabel,
  isPropertyDestructionBehaviorLabel,
} from "./response-block-eligibility";
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
  isTaskRefusalBehaviorLabel,
  isUnusableStoredTopography,
  isVagueMaladaptiveTopography,
  lastResortObservableTopographyForBehavior,
  looksLikePastedBipDefinitionTopography,
  paragraphReflectsStoredTopography,
  pickSingleTopographyActionForSegment,
  recoverTopographyFromSegmentProse,
  splitTopographyActionAlternatives,
  taskRefusalTopographyDescribesAppropriateBehavior,
  taskRefusalTopographyFromAntecedent,
} from "./maladaptive-behavior-topography";
import { filterReinforcementPreferencesForNote } from "./reinforcer-preferences";
import { scrubMedicationReferences } from "./note-normalization";
import { enrichTeachingOrPromptingForProgram } from "./program-teaching-templates";

/** True when topography is a bare gerund phrase that would assemble as a dangling fragment sentence. */
function isOrphanGerundTopography(text: string): boolean {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t) return false;
  if (/\b(?:the\s+)?(?:rbt|client)\b/i.test(t)) return false;
  return /^(?:orienting|providing|re-?presenting|prompting|restating|redirecting|requiring|delivering|modeling|arranging|reinforcing|maintaining|engaging)\b/i.test(
    t,
  );
}

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
  let sanitized = scrubMedicationReferences(replaceBlockedNames(text, blockedClientNames));
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
/** True when model topography names a person-directed contact action with an explicit target. */
function modelDescribesPersonDirectedContact(model: string): boolean {
  const m = model.toLowerCase();
  const contactAction =
    /\b(?:contact(?:ed|ing|s)?|hit|hitting|struck|strik(?:e|ing)|slap(?:ped|ping|s)?|kick(?:ed|ing|s)?|push(?:ed|es|ing)?|scratch(?:ed|es|ing)?|pinch(?:ed|es|ing)?|bit|bite|biting|headbutt(?:ed|ing|s)?|grab(?:bed|bing|s)?|threw|throw(?:ing|s)?|pull(?:ed|ing|s)?)\b/i;
  const target =
    /\b(?:the rbt|another person|a person|adult|arm|arms|hand|hands|leg|legs|head|face|shoulder|shoulders|back|chest|hair|body|torso)\b/i;
  return contactAction.test(m) && target.test(m);
}

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

  // Never paste BIP operational-definition dumps into the note when the model already wrote a
  // concrete session action (especially Wandering Away / elopement family).
  if (looksLikePastedBipDefinitionTopography(stored) && containsObservableClinicalAction(model)) {
    if (
      isElopementFamilyBehaviorLabel(behaviorLabel) &&
      !elopementEpisodeLacksObservableTopography(
        `The client manifested ${behaviorLabel} by ${model}.`,
        behaviorLabel,
      )
    ) {
      return false;
    }
    if (!isElopementFamilyBehaviorLabel(behaviorLabel)) {
      return false;
    }
  }

  // Task Refusal must describe refusal, not the appropriate activity ("washing hands").
  // Prefer stored only when stored is itself a real refusal topography — otherwise fall through
  // so groundNotePlan can recover from antecedent / last-resort.
  if (
    isTaskRefusalBehaviorLabel(behaviorLabel) &&
    taskRefusalTopographyDescribesAppropriateBehavior(model)
  ) {
    if (stored && !taskRefusalTopographyDescribesAppropriateBehavior(stored)) {
      return true;
    }
    return false;
  }

  // Physical Aggression BIP definitions are usually vague ("any part of another person's body …").
  // When the model names a specific person-directed contact action with a body part/target, keep it
  // so the note documents exactly what the client did (e.g. "made contact with the RBT's arm").
  if (
    isPhysicalAggressionBehaviorLabel(behaviorLabel) &&
    modelDescribesPersonDirectedContact(model)
  ) {
    return false;
  }

  const manifested = `The client manifested ${behaviorLabel} by ${model}.`;
  if (
    isElopementFamilyBehaviorLabel(behaviorLabel) &&
    elopementEpisodeLacksObservableTopography(manifested, behaviorLabel)
  ) {
    // Prefer stored only when it is a usable single-action topography — not a BIP definition dump.
    if (looksLikePastedBipDefinitionTopography(stored)) return false;
    return true;
  }

  // Model prose may paraphrase, but must reflect the stored observable actions strongly enough to pass
  // the FINAL BEHAVIOR_TOPOGRAPHY gate (>=2 stored action tokens in the manifested-behavior sentence).
  // Using the same threshold here means: keep the model's natural wording when it genuinely describes
  // the stored actions, otherwise fall back to the sanitized stored topography (which is derived from
  // the operational definition and therefore always satisfies the gate) so generation is not blocked.
  // Exception: for elopement/wandering, never force a BIP definition dump over a usable model episode.
  if (
    isElopementFamilyBehaviorLabel(behaviorLabel) &&
    looksLikePastedBipDefinitionTopography(stored)
  ) {
    return false;
  }
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

  // Documented functions first; when the profile has none, infer from the behavior label so the
  // fallback stays function-appropriate instead of grabbing the first approved intervention (the root
  // cause of the "Pivot Praise for every behavior" audit failure).
  const effectiveFunctions =
    params.behaviorFunctions && params.behaviorFunctions.length > 0
      ? params.behaviorFunctions
      : inferBehaviorFunctionsFromLabel(params.behaviorLabel);
  const behaviorIsAttentionMaintained = (effectiveFunctions ?? []).includes("attention");

  const functionPool = uniqueLabels([
    ...candidates,
    ...preferredInterventionCandidatesForBehaviorFunction(
      approved,
      effectiveFunctions,
      params.behaviorLabel,
    ),
  ]).filter((label) => approved.includes(label) && !isResponseBlockInterventionLabel(label));

  // Never let an attention-only intervention (Pivot Praise) treat a non-attention behavior when any
  // function-matched or other non-attention-only approved intervention exists.
  const functionPoolPreferred = behaviorIsAttentionMaintained
    ? functionPool
    : functionPool.filter((label) => !isAttentionOnlyInterventionLabel(label));

  const nonResponseBlockApproved = approved.filter(
    (label) => !isResponseBlockInterventionLabel(label),
  );
  const nonAttentionOnlyApproved = behaviorIsAttentionMaintained
    ? nonResponseBlockApproved
    : nonResponseBlockApproved.filter((label) => !isAttentionOnlyInterventionLabel(label));

  const preferred =
    functionPoolPreferred[0] ??
    functionPool[0] ??
    nonAttentionOnlyApproved[0] ??
    nonResponseBlockApproved[0];
  return preferred ? [preferred] : [];
}

/**
 * Reduce clinically inaccurate reuse of the SAME intervention across ABC segments. When a non-safety
 * segment's primary intervention already appeared in an earlier segment, swap it for a DISTINCT
 * function-appropriate approved alternative when one exists. Swaps only ever draw from the behavior's
 * function-matched approved pool, so we never trade a mismatch for variety; when the only
 * function-appropriate option is the repeated one, it is kept (defensible repetition). Safety-chain
 * segments (Response Block first) are left untouched — that primary is required and may repeat.
 */
export function diversifyInterventionLabelsAcrossSegments(
  segments: {
    behaviorLabel: string;
    acquisitionOnly: boolean;
    interventionLabels: string[];
    behaviorFunctions: RuntimeGenerationContext["maladaptiveBehaviorFunctionsForHour"][number];
  }[],
  approvedInterventions: string[],
  functionCandidatesForHour: (string[] | undefined)[],
): void {
  const approved = uniqueLabels(approvedInterventions);
  const usedPrimary = new Set<string>();
  segments.forEach((segment, index) => {
    if (segment.acquisitionOnly || segment.interventionLabels.length === 0) return;
    const primary = segment.interventionLabels[0]!;
    const primaryKey = primary.trim().toLowerCase();

    // Required safety primaries (Response Block first) may legitimately repeat across safety segments.
    if (isResponseBlockInterventionLabel(primary)) {
      usedPrimary.add(primaryKey);
      return;
    }
    if (!usedPrimary.has(primaryKey)) {
      usedPrimary.add(primaryKey);
      return;
    }

    const effectiveFunctions =
      segment.behaviorFunctions && segment.behaviorFunctions.length > 0
        ? segment.behaviorFunctions
        : inferBehaviorFunctionsFromLabel(segment.behaviorLabel);
    const attentionMaintained = (effectiveFunctions ?? []).includes("attention");
    const pool = uniqueLabels([
      ...(functionCandidatesForHour[index] ?? []),
      ...preferredInterventionCandidatesForBehaviorFunction(
        approved,
        effectiveFunctions,
        segment.behaviorLabel,
      ),
    ]).filter(
      (label) =>
        approved.includes(label) &&
        !isResponseBlockInterventionLabel(label) &&
        (attentionMaintained || !isAttentionOnlyInterventionLabel(label)),
    );
    const alternative = pool.find(
      (label) => label.trim().toLowerCase() !== primaryKey && !usedPrimary.has(label.trim().toLowerCase()),
    );
    if (alternative) {
      segment.interventionLabels[0] = alternative;
      usedPrimary.add(alternative.trim().toLowerCase());
    } else {
      usedPrimary.add(primaryKey);
    }
  });
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

  // Avoid documenting the same intervention for every behavior when function-appropriate approved
  // alternatives exist (audit compliance: intervention must match the behavior's function).
  diversifyInterventionLabelsAcrossSegments(
    segments,
    ctx.interventions,
    ctx.interventionCandidatesForHour,
  );

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
 * Compact, model-facing view of the frozen SessionContext. Omits fields the model must not use
 * (empty assessment excerpt, validation profile, trial metrics the server owns) and pretty-print
 * whitespace. Assembly/validation continue to use the full SessionContext.
 */
export function toModelFacingSessionContext(context: SessionContext): Record<string, unknown> {
  return {
    narrativeSegmentCount: context.narrativeSegmentCount,
    gender: context.gender,
    clientAgeYears: context.clientAgeYears,
    ageBand: context.ageBand,
    assessmentReferenceFileName: context.assessmentReferenceFileName,
    reinforcementPreferences: context.reinforcementPreferences,
    // Name-safe structured grounding: per-segment topography/functions already scrubbed server-side.
    // Raw assessment prose is intentionally never included (learner/caregiver name leak risk).
    assessmentGrounding: context.segments.map((s) => ({
      segmentIndex: s.segmentIndex,
      behaviorLabel: s.behaviorLabel,
      behaviorTopography: s.behaviorTopography,
      behaviorFunctions: s.behaviorFunctions,
      replacementLabel: s.replacementLabel,
      interventionLabels: s.interventionLabels,
    })),
    planCatalogSnapshot: context.planCatalogSnapshot,
    segments: context.segments.map((s) => ({
      segmentIndex: s.segmentIndex,
      acquisitionOnly: s.acquisitionOnly,
      behaviorLabel: s.behaviorLabel,
      replacementLabel: s.replacementLabel,
      interventionLabels: s.interventionLabels,
      activityAntecedent: s.activityAntecedent,
      behaviorTopography: s.behaviorTopography,
      behaviorFunctions: s.behaviorFunctions,
      rbtActionsOnlyOutcome: s.rbtActionsOnlyOutcome,
    })),
  };
}

/**
 * Apply only source-preserving corrections before validation:
 * - force-lock behavior/replacement/intervention labels and acquisitionOnly from frozen context
 *   (model must not own catalog labels; wrong echoes must not burn repair budget);
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
      // Force-lock catalog labels from the server assignment before any narrative sanitization.
      const lockedInterventions = locked.acquisitionOnly
        ? []
        : locked.interventionLabels.map((label, i) => {
            const prior =
              segment.interventions.find(
                (item) => item.label.trim().toLowerCase() === label.trim().toLowerCase(),
              ) ?? segment.interventions[i];
            return {
              label,
              application: prior?.application?.trim() || "implementing the assigned intervention as outlined in the treatment plan",
            };
          });
      const sanitized = {
        ...segment,
        segmentIndex: locked.segmentIndex,
        acquisitionOnly: locked.acquisitionOnly,
        behaviorLabel: locked.behaviorLabel,
        replacementLabel: locked.replacementLabel,
        interventions: lockedInterventions,
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
      // Re-sanitize applications after label lock (applications may have been remapped).
      sanitized.interventions = sanitized.interventions.map((intervention) => ({
        ...intervention,
        application: sanitizeModelNarrativeText(
          intervention.application,
          blockedClientNames,
          presentPeople,
        ),
      }));
      let topography = sanitized.topography;
      if (locked.acquisitionOnly) {
        // Acquisition-only segments have no maladaptive topography. Keep a complete schema-safe
        // placeholder that assembly deliberately does NOT emit as its own sentence (teaching prose
        // carries the narrative). Never use a bare gerund filler — that leaked as
        // "orienting toward the presented materials." fragments in saved notes.
        if (!topography.trim() || !/[a-z0-9]/i.test(topography) || isOrphanGerundTopography(topography)) {
          topography = "The client oriented toward the presented materials.";
        }
      } else {
        if (
          shouldPreferStoredTopographyOverModel(
            topography,
            locked.behaviorTopography,
            locked.behaviorLabel,
          ) &&
          locked.behaviorTopography &&
          !looksLikePastedBipDefinitionTopography(locked.behaviorTopography) &&
          !(
            isTaskRefusalBehaviorLabel(locked.behaviorLabel) &&
            taskRefusalTopographyDescribesAppropriateBehavior(locked.behaviorTopography)
          )
        ) {
          topography = locked.behaviorTopography;
        } else if (
          isUnusableStoredTopography(topography) ||
          looksLikePastedBipDefinitionTopography(topography) ||
          isVagueMaladaptiveTopography(topography) ||
          (isTaskRefusalBehaviorLabel(locked.behaviorLabel) &&
            taskRefusalTopographyDescribesAppropriateBehavior(topography))
        ) {
          // Never keep BIP status placeholders, pasted BIP definitions, vague interpretations
          // ("refusing to comply"), or Task Refusal framed as the appropriate activity
          // ("washing hands"). Prefer session refusal/leaving topography.
          const fromAntecedent =
            isTaskRefusalBehaviorLabel(locked.behaviorLabel)
              ? taskRefusalTopographyFromAntecedent(sanitized.antecedent)
              : null;
          const fromStored =
            !fromAntecedent &&
            locked.behaviorTopography &&
            !isUnusableStoredTopography(locked.behaviorTopography) &&
            !looksLikePastedBipDefinitionTopography(locked.behaviorTopography) &&
            !isVagueMaladaptiveTopography(locked.behaviorTopography) &&
            !(
              isTaskRefusalBehaviorLabel(locked.behaviorLabel) &&
              taskRefusalTopographyDescribesAppropriateBehavior(locked.behaviorTopography)
            )
              ? locked.behaviorTopography
              : "";
          const fromProse =
            !fromAntecedent && !fromStored
              ? recoverTopographyFromSegmentProse(locked.behaviorLabel, [
                  sanitized.responseToIntervention,
                  sanitized.resultSummary,
                  ...sanitized.interventions.map((item) => item.application),
                ])
              : null;
          const fromLastResort =
            !fromAntecedent && !fromStored && !fromProse
              ? lastResortObservableTopographyForBehavior(locked.behaviorLabel)
              : null;
          topography = fromAntecedent || fromStored || fromProse || fromLastResort || "";
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
          isIncompleteTopographyAction(topography) ||
          looksLikePastedBipDefinitionTopography(topography) ||
          isVagueMaladaptiveTopography(topography) ||
          (isTaskRefusalBehaviorLabel(locked.behaviorLabel) &&
            taskRefusalTopographyDescribesAppropriateBehavior(topography))
        ) {
          topography =
            (isTaskRefusalBehaviorLabel(locked.behaviorLabel)
              ? taskRefusalTopographyFromAntecedent(sanitized.antecedent)
              : null) ||
            (locked.behaviorTopography &&
            !isUnusableStoredTopography(locked.behaviorTopography) &&
            !isIncompleteTopographyAction(locked.behaviorTopography) &&
            !looksLikePastedBipDefinitionTopography(locked.behaviorTopography) &&
            !isVagueMaladaptiveTopography(locked.behaviorTopography)
              ? locked.behaviorTopography
              : null) ||
            lastResortObservableTopographyForBehavior(locked.behaviorLabel) ||
            topography;
        }
      }

      const interventions = sanitized.interventions.map((intervention) => ({
        ...intervention,
        application: enrichInterventionApplicationForBehavior(
          intervention.application,
          locked.behaviorLabel,
          intervention.label,
        ),
      }));

      const teachingOrPromptingSummary = enrichTeachingOrPromptingForProgram(
        sanitized.teachingOrPromptingSummary,
        locked.replacementLabel,
      );

      const responseToIntervention =
        !locked.acquisitionOnly &&
        !containsObservableClientOutcome(sanitized.responseToIntervention) &&
        containsObservableClientOutcome(sanitized.resultSummary)
          ? sanitized.resultSummary
          : sanitized.responseToIntervention;
      return {
        ...sanitized,
        topography,
        interventions,
        teachingOrPromptingSummary,
        responseToIntervention,
      };
    }),
  };
}

/**
 * Ensure Physical Aggression / Property Destruction intervention-application clauses document what
 * the RBT did (restate contingency, re-present demand, redirect to retrieve) — not only a thin
 * Premack "required X before access to Y" contingency without therapist action detail.
 */
export function enrichInterventionApplicationForBehavior(
  application: string,
  behaviorLabel: string,
  interventionLabel: string,
): string {
  const app = application.trim().replace(/\s+/g, " ");
  if (!app) return app;
  const behavior = behaviorLabel.trim();
  const label = interventionLabel.trim();
  // Require at least two concrete therapist actions before treating the clause as rich enough to
  // skip enrichment. A single "restated the demand…" boilerplate must still be expanded for
  // Property Destruction / Premack / DRA (audit reviewers reject thin application detail).
  const richActionHits = (
    app.match(
      /\b(?:restat(?:ed|ing)|re-?present(?:ed|ing)|redirect(?:ed|ing)|block(?:ed|ing)|retriev(?:ed|ing)|maintain(?:ed|ing)\s+the\s+(?:demand|expectation)|kept\s+the\s+demand|reinforc(?:ed|ing)\s+the\s+alternative|arrang(?:ed|ing)\s+the\s+(?:activity|environment)|remov(?:ed|ing)\s+(?:distracting|extra|competing)|point(?:ed|ing)\s+to\s+the\s+task)\b/gi,
    ) ?? []
  ).length;
  if (richActionHits >= 2 && app.length >= 90) return app;

  const thinPremack =
    /\brequir(?:ed|ing)\b.+\bbefore\s+access\b/i.test(app) ||
    (/premack/i.test(label) && /\bbefore\s+access\b/i.test(app));
  const thinGeneric =
    app.length < 90 ||
    richActionHits < 2 ||
    /\bapplying the assigned contingency\b/i.test(app) ||
    /\brestat(?:ed|ing) the demand and (?:delivered|delivering) reinforcement\b/i.test(app);

  if (isPropertyDestructionBehaviorLabel(behavior) && (thinPremack || thinGeneric)) {
    return "redirecting the client to retrieve the item, re-presenting the task demand, and requiring completion of the activity before access to the reinforcer";
  }
  if (isPhysicalAggressionBehaviorLabel(behavior) && (thinPremack || thinGeneric)) {
    // Keep the reinforcer/item cue from the thin clause when present.
    const accessMatch = app.match(/\bbefore\s+access\s+to\s+(.+?)(?:\.|$)/i);
    const accessTarget = accessMatch?.[1]?.trim().replace(/\.$/, "") || "the preferred item";
    return `restating the contingency, re-presenting the demand, and requiring completion of the presented task before access to ${accessTarget}`;
  }

  // Deterministic application skeletons for common catalog interventions when the model is thin.
  if (/premack/i.test(label) && (thinPremack || thinGeneric)) {
    const accessMatch = app.match(/\bbefore\s+access\s+to\s+(.+?)(?:\.|$)/i);
    const accessTarget = accessMatch?.[1]?.trim().replace(/\.$/, "") || "the preferred item";
    return `restating that completing the current task step was required before access to ${accessTarget}, pointing to the task materials, and re-presenting the instruction`;
  }
  if (
    /environmental\s+manipulat|antecedent\s+manipulat/i.test(label) &&
    thinGeneric
  ) {
    return "arranging the activity area so that only the materials required for the current task were available, removing distracting items, and presenting the instruction again using a clear, concise verbal prompt";
  }
  if (
    /differential\s+reinforcement|\bDRA\b|\bDRI\b/i.test(label) &&
    thinGeneric &&
    !/\breinforc(?:ed|ing)\s+the\s+alternative\b/i.test(app)
  ) {
    return "reinforcing the alternative response of engaging with the presented task materials and providing praise following appropriate responding";
  }
  if (/escape\s+extinction/i.test(label) && thinGeneric) {
    return "maintaining the presented demand, re-presenting the instruction without removing the task expectation, and prompting completion before access to the reinforcer";
  }
  if (/high-?probability|behavioral momentum/i.test(label) && thinGeneric) {
    return "delivering a brief series of high-probability instructions the client was likely to complete, then re-presenting the target demand and reinforcing compliance with the sequence";
  }
  return app;
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
