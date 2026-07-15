/**
 * Clinical-body validators for generated session notes (truth enforcement layer).
 *
 * Scheduling/rotation/rebalancing logic lives in ./note-scheduling and deterministic text
 * normalization in ./note-normalization; both are re-exported below so existing imports from
 * "./note-validation" keep working unchanged.
 */
import {
  findNonContingentReinforcementInterventionLabel,
  functionInterventionAfterSafetyChainHint,
  functionInterventionMismatchHint,
  isDraOrDriInterventionLabel,
  isFunctionMisfitIntervention,
  isInsufficientAttentionInterventionAfterSibSafetyChain,
  isResponseBlockInterventionLabel,
  preferredInterventionCandidatesForBehaviorFunction,
} from "./behavior-function-intervention-mapping";
import {
  assignedBehaviorAllowsResponseBlockSafetyChain,
  isPhysicalAggressionBehaviorLabel,
  isResponseBlockProhibitedBehavior,
} from "./response-block-eligibility";
import {
  findResponseBlockInterventionLabel,
  firstNamedInterventionInConsequenceTail,
  hasFunctionMatchedInterventionAfterResponseBlock,
  interventionTailAfterManifestedBehavior,
  paragraphDocumentsNonContingentReinforcement,
  paragraphHasResponseBlockFirst,
  selectSecondSafetyChainIntervention,
} from "./safety-chain-enforcement";
import {
  elopementEpisodeLacksObservableTopography,
  isElopementFamilyBehaviorLabel,
  manifestedBehaviorSentenceSpan,
  paragraphReflectsStoredTopography,
} from "./maladaptive-behavior-topography";
import {
  containsObservableClinicalAction,
  containsObservableClientOutcome,
} from "./observable-clinical-language";
import { primaryFunctionForReplacementSelection } from "./behavior-function-replacement-mapping";
import {
  MALADAPTIVE_BEHAVIOR_SIB_CANONICAL,
  isMisfitReplacementForMaladaptiveBehavior,
  maladaptiveBehaviorLabelsEquivalent,
  normalizeReplacementProgramKey,
  type TherapistTrialSummaryForHourEntry,
} from "./note-scheduling";
import {
  DEFAULT_UNAUTHORIZED_INTERVENTION_LIKE_PHRASES,
  DEFAULT_UNAUTHORIZED_REPLACEMENT_LIKE_PHRASES,
  catalogInterventionBaseWithoutParenthetical,
  escapeRegExp,
  phraseMatchesAuthorizedIntervention,
  phraseMatchesAuthorizedReplacementProgram,
} from "./note-normalization";
import {
  buildLockedClosingParagraph,
  buildLockedOpening,
  buildNextSessionSentence,
  buildPerformanceSentence,
  type TherapySetting,
} from "./note-assembly";
import {
  clinicalBodyHasUnspecifiedToyDelivery,
  clinicalBodyNamesConcreteToy,
  concreteToyPreferences,
  filterReinforcementPreferencesForNote,
  isYouTubeBannedForAge,
  mentionsYouTube,
  YOUTUBE_MIN_AGE_YEARS,
} from "./reinforcer-preferences";

export * from "./note-scheduling";
export * from "./note-normalization";

export type NoteComplianceContext = {
  /** Billable session duration from the wizard (integer hours). */
  sessionHours: number;
  /** Approved location label from the wizard/API; school notes use teacher-led activity wording. */
  therapySetting?: string | undefined;
  /**
   * Number of ABC paragraphs expected in the clinical body (aligned with ~90-minute narrative/program slots).
   * When omitted, validators fall back to `sessionHours` for backward compatibility.
   */
  narrativeSegmentCount?: number | undefined;
  replacementProgramsInOrder: string[];
  /**
   * Exact replacement program name per **narrative segment** (length = `narrativeSegmentCount ?? sessionHours`).
   * Clinical body must include this substring verbatim in paragraph index `i` when non-empty.
   */
  replacementProgramForHour: string[];
  /**
   * When provided (length matches replacement program array), indices that are true use RBT-actions-only outcome rules for that segment.
   */
  rbtActionsOnlyOutcomeForHour?: boolean[] | undefined;
  /** BIP maladaptive behavior names (exact strings) — used for one-behavior-per-paragraph checks */
  maladaptiveBehaviors: string[];
  /**
   * Exact catalog label assigned to each **narrative segment** (same length contract as `replacementProgramForHour`).
   */
  maladaptiveBehaviorForHour: string[];
  /**
   * Optional ABC Builder: per segment, exact activity/antecedent catalog string that must appear verbatim in the paragraph, or null for AI-chosen antecedent.
   */
  activityAntecedentForHour?: (string | null)[] | undefined;
  /**
   * When set (same length contract), paragraphs at true indices may include brief attributed client speech
   * (verbal/language maladaptive topography); toddler speech checks skip those paragraphs.
   */
  languageMaladaptiveEpisodeForHour?: boolean[] | undefined;
  /**
   * When true at index `i`, paragraph `i` is a **skill-acquisition-only** segment (e.g. Respond to Own Name, Echoic):
   * do not cite a maladaptive catalog label; `maladaptiveBehaviorForHour[i]` is cleared for validators/prompts.
   */
  acquisitionOnlySegmentForHour?: boolean[] | undefined;
  /** Per narrative segment: documented FBA functions for `maladaptiveBehaviorForHour[s]` (from assessment). */
  maladaptiveBehaviorFunctionsForHour?: (import("@workspace/db/schema").ClinicalFunction[] | null)[] | undefined;
  /** Per narrative segment: stored BIP/profile operational topography for the assigned behavior, when set. */
  maladaptiveBehaviorTopographyForHour?: (string | null)[] | undefined;
  /** BIP behavior → replacement program map from structured assessment (for function-match validation). */
  behaviorToReplacementsMap?: Record<string, string[]> | undefined;
  /** BIP intervention names (exact strings) — used for safety-priority response-blocking ordering */
  interventions: string[];
  /**
   * Per narrative segment: therapist-entered discrete-trial rollup for `replacementProgramForHour[s]`.
   * When set, the clinical paragraph must state outcomes as a **rounded success percentage** tied to that program
   * (e.g. successful ~P% of the time / P% of trials), not "N out of M trials" counts (see validators).
   */
  therapistTrialSummaryForReplacementHour?: TherapistTrialSummaryForHourEntry[] | undefined;
  /** Approximate age in years from DOB + session date; null if unknown */
  clientAgeYears: number | null;
  presentPeople: string[];
  /** Profile/assessment-derived learner names forbidden in the AI clinical body. */
  blockedClientNames?: string[] | undefined;
  /** BIP reinforcement preferences used for toy specificity and age-gated reinforcer checks. */
  reinforcementPreferences?: string[] | undefined;
};

export type NoteValidationSeverity = "blocking" | "warning";

export type NoteValidationIssueCode =
  | "FORMAT_QUOTATION"
  | "LANGUAGE_OBJECTIVITY"
  | "AGE_APPROPRIATENESS"
  | "REINFORCER_SPECIFICITY"
  | "SCHOOL_ACTIVITY_OWNERSHIP"
  | "PARAGRAPH_COUNT"
  | "CLIENT_NAME_LEAKAGE"
  | "CAREGIVER_LEAKAGE"
  | "PRESENT_PERSON_LEAKAGE"
  | "PEER_GROUP_LEAKAGE"
  | "ANTECEDENT_INVALID"
  | "PROGRAM_ASSIGNMENT"
  | "PROGRAM_FUNCTION_MISMATCH"
  | "BEHAVIOR_ASSIGNMENT"
  | "BEHAVIOR_TOPOGRAPHY"
  | "INTERVENTION_CATALOG"
  | "INTERVENTION_COUNT"
  | "INTERVENTION_MISSING"
  | "INTERVENTION_FUNCTION_MISMATCH"
  | "POST_INTERVENTION_OUTCOME"
  | "REINFORCEMENT_CONTINGENCY"
  | "TRIAL_DATA"
  | "SAFETY_CHAIN"
  | "UNAUTHORIZED_CONTENT"
  | "UNSUPPORTED_COMPARISON"
  | "LOCKED_OPENING"
  | "LOCKED_ENVIRONMENT"
  | "LOCKED_CLOSING"
  | "END_SEQUENCE"
  | "NEXT_SESSION_LOCATION";

export type NoteValidationIssue = {
  code: NoteValidationIssueCode;
  severity: NoteValidationSeverity;
  message: string;
  paragraphIndex?: number | undefined;
};

export type NoteValidationResult = {
  issues: NoteValidationIssue[];
  blocking: NoteValidationIssue[];
  warnings: NoteValidationIssue[];
};

function validationResult(issues: NoteValidationIssue[]): NoteValidationResult {
  return {
    issues,
    blocking: issues.filter((issue) => issue.severity === "blocking"),
    warnings: issues.filter((issue) => issue.severity === "warning"),
  };
}

const MENTAL_STATE_PATTERNS: RegExp[] = [
  /\bthe client felt\b/i,
  /\bclient felt\b/i,
  /\bthe client feels\b/i,
  /\bthe client wanted\b/i,
  /\bclient wanted\b/i,
  /\bthe client wants\b/i,
  /\bwas frustrated because\b/i,
  /\bfrustrated because\b/i,
  /\bthe client was trying to\b/i,
  /\bclient was trying to\b/i,
  /\bthe client thought\b/i,
  /\bclient thought\b/i,
  /\bthe client believed\b/i,
  /\bappeared (upset|angry|frustrated|sad|anxious|happy)\b/i,
  /\bseemed (upset|angry|frustrated|sad|anxious|happy)\b/i,
  /\bwas upset because\b/i,
  /\binternal(ly)?\s+(upset|distressed|frustrated)\b/i,
  /\bmust have been\b/i,
  /\bprobably felt\b/i,
];

/**
 * Subjective wording forbidden in objective ABA documentation. Catches **bare** state
 * words (the existing MENTAL_STATE_PATTERNS only flagged compound forms such as
 * "appeared upset" or "frustrated because"). RBTs must describe observable topography;
 * never internal states or value judgments.
 */
const SUBJECTIVE_WORDING_PATTERNS: RegExp[] = [
  /\bbecame\s+(upset|frustrated|angry|sad|anxious|happy)\b/i,
  /\bgot\s+(upset|frustrated|angry|sad|happy)\b/i,
  /\b(?:was|were|is|are)\s+(upset|frustrated|angry|sad|anxious|happy|stubborn|noncompliant|non-compliant)\b/i,
  /\bbeing\s+(upset|frustrated|angry|sad|anxious|stubborn|noncompliant|non-compliant)\b/i,
  /\bfeeling\s+(upset|frustrated|angry|sad|anxious|happy)\b/i,
  /\bin\s+a\s+(bad|good)\s+mood\b/i,
  /\b(bad|good)\s+day\b/i,
  /\bfair\s+performance\b/i,
  /\b(?:non-?compliant|stubborn|defiant|rude|lazy|moody|cooperative\s+attitude|uncooperative)\b/i,
  /\bdid\s+(well|poorly)\b/i,
  /\bperformed\s+(well|poorly)\b/i,
];

/** Activities unlikely for very young clients (observable-task framing, not mental state). */
function ageInappropriatePatterns(ageYears: number): RegExp[] {
  if (ageYears < 3) {
    return [
      /\bread(ing)?\s+(a\s+)?(passage|chapter|story|aloud)\b/i,
      /\bwriting\s+(sentences|words|answers|a\s+paragraph)\b/i,
      /\bworksheet\b/i,
      /\bessay\b/i,
      /\bspelling\s+test\b/i,
      /\blong division\b/i,
      /\bhomework\s+assignment\b/i,
    ];
  }
  if (ageYears < 5) {
    return [
      /\bessay\b/i,
      /\bworksheet\s+with\s+written\b/i,
      /\bchapter\s+book\b/i,
      /\breading comprehension\b/i,
    ];
  }
  if (ageYears < 8) {
    return [/\bessay\b/i, /\bresearch\s+project\b/i];
  }
  return [];
}

/**
 * How many distinct catalog strings appear as substrings in a paragraph (longest matched first to reduce nested double-counts).
 * Use for behaviors, replacement programs, or any exact-match catalog list.
 */
export function countDistinctCatalogLabelsInParagraph(paragraph: string, catalog: string[]): number {
  const names = [...new Set(catalog.map((s) => s.trim()).filter((s) => s.length > 0))].sort(
    (a, b) => b.length - a.length,
  );
  if (names.length === 0) return 0;
  let masked = paragraph;
  let count = 0;
  for (const n of names) {
    if (masked.includes(n)) {
      count++;
      masked = masked.split(n).join(" ");
    }
  }
  return count;
}

/** How many distinct catalog behavior names appear in a paragraph. */
export function countCatalogBehaviorsInParagraph(paragraph: string, catalog: string[]): number {
  return countDistinctCatalogLabelsInParagraph(paragraph, catalog);
}

const TODDLER_ATTRIBUTED_SPEECH: RegExp[] = [
  /\bthe client (said|stated|replied|answered|asked|exclaimed|reported|mentioned)\b/i,
  /\bclient (said|stated|replied|answered|asked|exclaimed)\b/i,
  /\bverbally (said|asked|requested|responded|answered|stated)\b/i,
];

/** Tantrum/meltdown wording without nearby observable topography cues. */
function tantrumWithoutTopography(paragraph: string): boolean {
  if (!/\b(tantrum|meltdown)\b/i.test(paragraph)) {
    return false;
  }
  const topographyCue =
    /\b(cried|cry|crying|sob|sobbed|tear|tears|scream|screamed|wail|flop|flopped|floor|dropped|kicked|kicking|threw|throwing|thrown|hit|hitting|slam|slammed|banged|scratch|bit|bite|pushed|pushing|materials|items|toys)\b/i;
  return !topographyCue.test(paragraph);
}

function physicalAggressionParagraphHasVerbalTopography(paragraph: string): boolean {
  const manifestedIdx = paragraph.search(/\bmanifested\s+physical\s+aggression\b/i);
  if (manifestedIdx === -1) return false;
  const behaviorSpan = paragraph.slice(Math.max(0, manifestedIdx - 260), manifestedIdx + 260);
  return (
    /["“][^"”]{1,80}["”]/.test(behaviorSpan) ||
    /\b(shouted|yelled|screamed|said|stated|vocalized|vocalizations?|raised voice|above conversational level)\b/i.test(
      behaviorSpan,
    )
  );
}

function unsupportedProgressComparison(paragraph: string): boolean {
  return /\b(recent sessions|previous sessions|prior sessions|baseline|treatment goals?)\b/i.test(paragraph);
}

const CAREGIVER_LEXICON =
  /\b(caregiver|caregivers|parents?|guardians?|mother|father|mom|dad|mommy|daddy|stepmother|stepfather|grandmother|grandfather|grandma|grandpa|aunt|uncle|cousin|siblings?|brother|sister|(?:maternal|paternal)\s+(?:uncle|aunt|grandmother|grandfather)|family members?)\b/i;

/** Mask quoted catalog labels so exact program names like "Parent Training" do not false-trigger caregiver checks. */
export function maskQuotedCatalogSpans(text: string): string {
  return text.replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");
}

/**
 * Remove unauthorized caregiver/family presence wording from clinical body prose.
 * Quoted catalog labels (replacement program names) are preserved exactly.
 */
export function stripUnauthorizedCaregiverLanguage(
  text: string,
  presentPeople: string[] = [],
): string {
  const protectedSpans: string[] = [];
  const withPlaceholders = text.replace(/"[^"]*"|'[^']*'/g, (match) => {
    protectedSpans.push(match);
    return `\u0000Q${protectedSpans.length - 1}\u0000`;
  });

  let sanitized = withPlaceholders;
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

  sanitized = sanitized
    .replace(
      /\b(?:toward|towards)\s+(?:the\s+)?(?:caregiver|caregivers|parents?|guardians?|mother|father|mom|dad|mommy|daddy|stepmother|stepfather|grandmother|grandfather|grandma|grandpa|aunt|uncle|cousin|siblings?|brother|sister|(?:maternal|paternal)\s+(?:uncle|aunt|grandmother|grandfather)|family members?)\b/gi,
      "toward another person",
    )
    .replace(
      /\b(?:the\s+)?(?:caregiver|caregivers|parents?|guardians?|mother|father|mom|dad|mommy|daddy|stepmother|stepfather|grandmother|grandfather|grandma|grandpa|aunt|uncle|cousin|siblings?|brother|sister|(?:maternal|paternal)\s+(?:uncle|aunt|grandmother|grandfather)|family members?)['’]s\b/gi,
      "another person's",
    )
    .replace(
      /\b(?:the\s+)?(?:caregiver|caregivers|parents?|guardians?|mother|father|mom|dad|mommy|daddy|stepmother|stepfather|grandmother|grandfather|grandma|grandpa|aunt|uncle|cousin|siblings?|brother|sister|(?:maternal|paternal)\s+(?:uncle|aunt|grandmother|grandfather)|family members?)\b/gi,
      "another person",
    )
    .replace(/\banother person(?:\s*\/\s*another person)+\b/gi, "another person")
    .replace(/[^\S\n]+and[^\S\n]+another person[^\S\n]*\)+/gi, " and")
    .replace(/\([^\S\n]*and[^\S\n]+another person[^\S\n]*\)/gi, "")
    // Only strip trailing parens preceded by horizontal whitespace; never touch newlines so
    // the assembled body keeps its blank-line paragraph separators (one paragraph per ABC).
    .replace(/[^\S\n]+\)+/g, "")
    .replace(/[^\S\n]{2,}/g, " ")
    .replace(/[^\S\n]*\n[^\S\n]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return sanitized.replace(/\u0000Q(\d+)\u0000/g, (_, index) => protectedSpans[Number(index)] ?? "");
}

/**
 * Caregiver / family roles and anyone listed as present must not appear after the note's first sentence.
 * Deterministic locked closing / performance / next-session spans are ignored (server-authored).
 * Quoted catalog labels are masked so approved program names containing "Parent" are allowed.
 */
export function validateCaregiverMentionRule(
  fullNote: string,
  presentPeople: string[],
  options?: { ignoreSpans?: string[] | undefined },
): string[] {
  const issues: string[] = [];
  const { rest } = splitFirstSentence(fullNote);
  if (!rest.trim()) {
    return issues;
  }

  let scanTarget = rest;
  for (const span of options?.ignoreSpans ?? []) {
    const trimmed = span.trim();
    if (trimmed.length > 0) {
      scanTarget = scanTarget.split(trimmed).join(" ");
    }
  }
  scanTarget = maskQuotedCatalogSpans(scanTarget);

  if (CAREGIVER_LEXICON.test(scanTarget)) {
    issues.push(
      "Caregiver/family role language appears after the first sentence; it must appear only in the opening sentence.",
    );
  }

  for (const name of presentPeople) {
    const n = name.trim().replace(/^[\s,;:([]+/g, "").replace(/[\s,;:)\]]+$/g, "");
    if (n.length < 2) continue;
    const re = new RegExp(`\\b${escapeRegExp(n)}\\b`, "i");
    if (re.test(scanTarget)) {
      issues.push(
        `A listed present person ("${n}") appears after the first sentence; caregivers/present people must only appear in the first sentence.`,
      );
    }
  }

  return issues;
}

const PEER_OR_GROUP_ACTIVITY_LEXICON =
  /\b(small[- ]group|group activity|group play|peer|peers|classmate|classmates|children|kids|other students|other children|student group)\b/i;

const SCHOOL_SETTING_RE = /\bschool\b/i;

function isSchoolSettingLabel(therapySetting: string | undefined): boolean {
  return typeof therapySetting === "string" && SCHOOL_SETTING_RE.test(therapySetting);
}

function isTeacherRole(name: string): boolean {
  return /\bteacher\b/i.test(name.trim());
}

function schoolParagraphHasRbtOwnedClassroomActivity(paragraph: string): boolean {
  const rbtOwnedActivity =
    /\b(?:the\s+)?RBT\s+(?:arranged|set up|setup|prepared|created|designed|led|conducted|introduced|presented)\b[^.]{0,140}\b(?:lesson|activity|worksheet|classwork|assignment|academic task|classroom task|floor activity|table activity|puzzle|board game|game|transition from|materials?|instruction|instructions|direction|directions)\b/i;
  const explicitRbtMaterialOwnership =
    /\b(?:the\s+)?RBT\s+arranged\s+(?:the\s+)?materials?\b/i;
  const explicitRbtClassroomInstruction =
    /\b(?:the\s+)?RBT\s+presented\s+(?:a\s+|the\s+)?(?:simple\s+|classroom\s+|academic\s+|coloring\s+)?(?:instruction|direction|task)\b/i;
  return (
    rbtOwnedActivity.test(paragraph) ||
    explicitRbtMaterialOwnership.test(paragraph) ||
    explicitRbtClassroomInstruction.test(paragraph)
  );
}

function acquisitionOnlySkillDeficitFraming(paragraph: string): string | null {
  const checks: { label: string; re: RegExp }[] = [
    {
      label: "vocalizations that did not match the model",
      re: /\bvocalizations?\b[^.]{0,80}\bdid\s+not\s+match\b[^.]{0,40}\bmodel\b/i,
    },
    {
      label: "inconsistent head turns/orienting",
      re: /\binconsistent\b[^.]{0,60}\b(?:head\s+turns?|orient(?:ing|ation)|gaze|eye\s+contact)\b/i,
    },
    {
      label: "looked down or away from the teaching target",
      re: /\b(?:frequently\s+)?look(?:ed|ing)\s+(?:down|away)\b[^.]{0,80}\b(?:materials?|RBT'?s?\s+face|speaker|model|teaching\s+target)\b/i,
    },
    {
      label: "continued manipulating materials instead of responding",
      re: /\bcontinued\s+(?:manipulating|playing\s+with|moving)\b[^.]{0,80}\b(?:without|instead\s+of|rather\s+than|not)\b/i,
    },
    {
      label: "failed/unable/struggled skill-performance wording",
      re: /\b(?:failed\s+to|unable\s+to|struggled\s+to)\b[^.]{0,80}\b(?:imitate|echo|orient|respond|turn|look|gaze|match)\b/i,
    },
    {
      label: "did not orient/respond/imitate/match wording",
      re: /\bdid\s+not\b[^.]{0,80}\b(?:imitate|echo|orient|respond|turn|look|gaze|match)\b/i,
    },
    {
      label: "required repeated prompts as skill-deficit framing",
      re: /\brequir(?:ed|ing)\s+repeated\s+(?:prompts?|cues?|guidance)\b/i,
    },
  ];
  for (const check of checks) {
    if (check.re.test(paragraph)) return check.label;
  }
  return null;
}

function firstSentences(text: string, count: number): string {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.slice(0, count).join(" ");
}

function antecedentSpecificityIssue(paragraph: string, paragraphIndex: number): string | null {
  const opening = firstSentences(paragraph, 2);
  if (opening.length === 0) return null;
  const cueChecks = [
    /\b(?:shape sorter|stacking rings?|puzzle|peg board|blocks?|toy(?:s)?|animal figures?|cars?|bin|cards?|crayons?|paper|markers?|ball|bubbles?|musical toy|visual card|visual cue|worksheet|materials?|pieces?)\b/i,
    /\b(?:RBT|teacher)\s+(?:placed|presented|set up|arranged|held|modeled|paused|removed|pointed|gestured|guided|positioned|called|opened|closed|handed|showed|moved|signaled)\b/i,
    /\b(?:floor|table|chair|sofa|shelf|doorway|hallway|carpet|mat|TV stand|classroom table|living room table|small table)\b/i,
    /\b(?:instruction|demand|clean-?up|transition|one at a time|first-then|prompted\s+to|signaled\s+to|access\s+to|return\s+to|move\s+to)\b/i,
  ];
  const cueCount = cueChecks.reduce((n, re) => n + (re.test(opening) ? 1 : 0), 0);
  const vagueOpening =
    /^(?:during|while|at|in)\s+(?:the\s+)?(?:activity|task|work|routine|cleanup|clean-up|session)\b/i.test(opening) ||
    /\b(?:during the activity|during cleanup|while working|during the task)\b/i.test(opening);
  if (cueCount >= 2 && !vagueOpening) return null;
  if (cueCount >= 3) return null;
  return `Antecedent specificity: paragraph ${paragraphIndex + 1} must make the antecedent concrete in the first one to two sentences. Include at least two clear details such as specific materials/tasks, what the RBT or teacher did, where the client/materials were positioned, and the exact instruction/demand/transition immediately before the response. Avoid vague openings like "during cleanup", "during the activity", or "while working" unless the same opening names the materials and instruction.`;
}

function interventionFollowUpDetail(paragraph: string): string | null {
  const m = /\bFollowing (?:this|these) interventions?\b/i.exec(paragraph);
  if (!m || m.index === undefined) return null;
  const tail = paragraph.slice(m.index);
  const replacementIdx = tail.search(/\b(?:Additionally,\s+)?The RBT implemented the replacement program\b/i);
  return (replacementIdx >= 0 ? tail.slice(0, replacementIdx) : tail).trim();
}

function maladaptiveReinforcementContingencyIssue(paragraph: string, paragraphIndex: number): string | null {
  if (!/\bthe client manifested\b/i.test(paragraph)) return null;
  const detail = interventionFollowUpDetail(paragraph);
  if (!detail) return null;

  const deliversReinforcement =
    /\b(?:delivered|provided)\b[^.]{0,140}\b(?:verbal praise|brief praise|praise|preferred toy|musical toy|preferred item|access to)\b/i.test(detail) ||
    /\bbrief access to\b/i.test(detail);
  if (!deliversReinforcement) return null;

  const documentsWithholding =
    /\b(?:withheld|removed access|no access|did not (?:deliver|provide)|minimal attention)\b/i.test(detail) ||
    /\bblocked(?:\s+(?:path|movement|access|further|the client|exit|doorway))?\b/i.test(detail);

  const compatibleContingency =
    /\b(?:contingent on|after|when)\b[^.]{0,220}\b(?:the client (?:completed|placed|stopped|responded|followed|remained|maintained|accepted|initiated|kept)|(?:stop|wait|proximity|safety|shape|step|placement|task|instruction|demand|responses?|worksheet|cleanup))\b/i.test(
      detail,
    );

  const reinforcementAfterVagueReturn =
    /\b(?:delivered|provided)\b[^.]{0,180}\b(?:when|after)\s+the client\b[^.]{0,180}\b(?:moved back|returned toward|came back|oriented(?:\s+toward)?)\b/i.test(
      detail,
    ) &&
    !/\b(?:when|after)\s+the client\b[^.]{0,180}\b(?:stopped|stop\b|wait\b|completed|placed|maintained proximity|responded to|remained within|followed the)\b/i.test(
      detail,
    );

  if (reinforcementAfterVagueReturn) {
    return `Reinforcement contingency: paragraph ${paragraphIndex + 1} documents praise or preferred-item access when the client only moved back or oriented after a maladaptive behavior. Document withheld access or blocked movement during the maladaptive response, then deliver reinforcement only after a specific replacement- or safety-compatible behavior (for example stop, wait, proximity, completed step, or placement)—not for returning after elopement or refusal alone.`;
  }

  if (!documentsWithholding && !compatibleContingency) {
    return `Reinforcement contingency: paragraph ${paragraphIndex + 1} documents praise or access after a maladaptive behavior without stating that reinforcement was withheld during the maladaptive topography and without tying delivery to a specific compatible response (completed step, placement, stop/wait, proximity, or replacement-program behavior).`;
  }

  return null;
}

function compoundDraDroInterventionLabelIssue(paragraph: string, paragraphIndex: number): string | null {
  if (
    /\bDifferential Reinforcement\s*\(\s*DRA\s*\/\s*DRO\s*\)/i.test(paragraph) ||
    /\bimplemented\s+DRA\s*\/\s*DRO\b/i.test(paragraph)
  ) {
    return `Intervention exact match: paragraph ${paragraphIndex + 1} must not combine DRA and DRO into one catalog label (for example "Differential Reinforcement (DRA/DRO)"). Document exactly one approved intervention string from JSON per naming sentence.`;
  }
  return null;
}

function postInterventionOutcomeIssue(paragraph: string, paragraphIndex: number): string | null {
  const detail = interventionFollowUpDetail(paragraph);
  if (!detail) {
    return `Post-intervention outcome: paragraph ${paragraphIndex + 1} must include a "Following this intervention" or "Following these interventions" section that states the observable result after the intervention, not only the intervention label.`;
  }
  const outcomePatterns = [
    /\bthe client\b[^.]{0,180}\b(?:completed|returned|remained|sat|engaged|placed|picked up|moved|oriented|accepted|followed|initiated|approached|walked|kept|responded|reached|touched|used|selected|pointed|vocalized|imitated|turned|looked|contacted)\b/i,
    /\b(?:when|after)\s+the client\b/i,
    /\bafter each\b[^.]{0,120}\b(?:placement|response|step|trial|opportunity|completed)\b/i,
    /\bafter\b[^.]{0,120}\b(?:responses?|steps?|placements?|task completion|worksheet responses|completed cleanup|completed step)\b/i,
    /\bwhen\b[^.]{0,120}\b(?:orientation|head turns?|eye contact|placement|sitting|proximity|engagement|appropriate contact)\b/i,
    /\b(?:items?|materials?|toys?|blocks?|pieces?)\s+were\s+(?:placed|returned|put|moved|removed)\b/i,
    /\b(?:remained|returned|completed|engaged|sat|walked|oriented|responded)\b[^.]{0,120}\b(?:with|after|following|across)\b/i,
  ];
  if (
    containsObservableClientOutcome(detail) ||
    outcomePatterns.some((re) => re.test(detail))
  ) {
    return null;
  }
  return `Post-intervention outcome: paragraph ${paragraphIndex + 1} must state an observable result after the intervention (for example, the client completed one step, returned to the task, remained seated/nearby, placed materials, or engaged with materials). Do not stop after listing only RBT actions.`;
}

function stripStraightDoubleQuotes(s: string): string {
  return s.replace(/"/g, "");
}

function normInterventionWhitespace(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

/**
 * Two distinct approved intervention strings appear as one adjacent phrase
 * (comma or "and" only between them), which breaks exact per-intervention
 * documentation. Uses a de-quoted scan so `"A" and "B"` is still detected.
 * Skips when some catalog entry is literally a single label equal to
 * "A and B" / "A, B" so legitimate multi-word intervention names are not flagged.
 */
function findJoinedInterventionPairPhrase(
  text: string,
  interventionNames: string[],
): { a: string; b: string } | null {
  const list = [...new Set(interventionNames.map((s) => s.trim()).filter((s) => s.length > 1))].sort(
    (a, b) => b.length - a.length,
  );
  if (list.length < 2) return null;
  const scan = stripStraightDoubleQuotes(text);
  for (let i = 0; i < list.length; i++) {
    for (let j = 0; j < list.length; j++) {
      if (i === j) continue;
      const a = list[i]!;
      const b = list[j]!;
      const andJoined = normInterventionWhitespace(`${a} and ${b}`);
      if (list.some((c) => normInterventionWhitespace(c) === andJoined)) {
        continue;
      }
      const commaJoined = normInterventionWhitespace(`${a}, ${b}`);
      if (list.some((c) => normInterventionWhitespace(c) === commaJoined)) {
        continue;
      }
      const between = String.raw`\s*(?:,\s*|\s+and\s+)\s*`;
      const re = new RegExp(escapeRegExp(a) + between + escapeRegExp(b));
      if (re.test(scan)) return { a, b };
    }
  }
  return null;
}

/** Catalog intervention immediately followed by comma before "by" (breaks exact-match phrasing). */
function firstInterventionWithCommaBeforeBy(paragraph: string, interventionNames: string[]): string | null {
  const list = interventionNames.map((s) => s.trim()).filter((s) => s.length > 1);
  for (const name of list) {
    const re = new RegExp(escapeRegExp(name) + String.raw`,\s*by\b`);
    if (re.test(paragraph)) return name;
  }
  return null;
}

/** Catalog intervention wrapped in straight double quotes (breaks plain substring checks). */
function firstQuotedCatalogIntervention(paragraph: string, interventionNames: string[]): string | null {
  const list = interventionNames.map((s) => s.trim()).filter((s) => s.length > 1);
  for (const name of list) {
    const re = new RegExp(`"${escapeRegExp(name)}"`);
    if (re.test(paragraph)) return name;
  }
  return null;
}

/** Legacy / invalid: catalog name immediately followed by **by** in the same clause as implemented/applied. */
function firstInterventionNameWithAttachedByClause(
  paragraph: string,
  interventionNames: string[],
): string | null {
  const list = [...new Set(interventionNames.map((s) => s.trim()).filter((s) => s.length > 1))].sort(
    (a, b) => b.length - a.length,
  );
  for (const name of list) {
    const re = new RegExp(`(?:implemented|applied)\\s+${escapeRegExp(name)}\\s+by\\b`, "i");
    if (re.test(paragraph)) return name;
  }
  return null;
}


/** Catalog label denotes physical aggression (person-directed); excludes Verbal Aggression. */
function isPhysicalAggressionCatalogLabel(behaviorName: string): boolean {
  return isPhysicalAggressionBehaviorLabel(behaviorName);
}

/** Re-export for callers that imported from note-validation. */
export { isResponseBlockInterventionLabel } from "./behavior-function-intervention-mapping";

/**
 * Assigned maladaptive labels where response-blocking may precede function interventions — see safety-chain-enforcement.ts.
 */

/**
 * Count distinct catalog interventions documented with **implemented** / **applied** + exact catalog name,
 * where the **naming sentence ends with a period** immediately after the name (no **by** clause in that sentence).
 * Longest catalog strings first to avoid double-counting a shorter label inside a longer one.
 */
export function countInterventionImplementationsInParagraph(
  paragraph: string,
  interventionCatalog: string[],
): number {
  const names = [...new Set(interventionCatalog.map((s) => s.trim()).filter((s) => s.length > 0))].sort(
    (a, b) => b.length - a.length,
  );
  const spans: { start: number; end: number }[] = [];
  for (const name of names) {
    const re = new RegExp(`(?:implemented|applied)\\s+${escapeRegExp(name)}\\s*\\.`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(paragraph)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      const overlaps = spans.some((s) => !(end <= s.start || start >= s.end));
      if (!overlaps) {
        spans.push({ start, end });
      }
    }
  }
  return spans.length;
}

/** Rounded % of trials that met criterion (standard rounding of successes/total). */
function therapistTrialSuccessPercentRounded(successfulTrialCount: number, totalTrials: number): number {
  const m = totalTrials;
  let n = successfulTrialCount;
  if (!Number.isFinite(n) || !Number.isFinite(m) || m < 1 || n < 0) return 0;
  n = Math.min(n, m);
  return Math.round((n / m) * 100);
}

/**
 * True when the paragraph states therapist-entered discrete-trial outcomes as a **percentage** aligned with JSON
 * (rounded successes/total), not as "N out of M trials were successful".
 */
function therapistTrialPercentRollupPhrasePresent(
  paragraph: string,
  successfulTrialCount: number,
  totalTrials: number,
): boolean {
  const m = totalTrials;
  let n = successfulTrialCount;
  if (!Number.isFinite(n) || !Number.isFinite(m) || m < 1 || n < 0) return false;
  n = Math.min(n, m);
  const p = therapistTrialSuccessPercentRounded(n, m);
  const pStr = String(p);

  const legacyOut = new RegExp(`\\b${n}\\s+out\\s+of\\s+${m}\\s+trials?\\b`, "i");
  const legacyOf = new RegExp(`\\b${n}\\s+of\\s+${m}\\s+trials?\\b`, "i");
  const legacyWasWere = new RegExp(
    `\\b${n}\\s+out\\s+of\\s+${m}\\s+trials?\\s+(?:was|were)\\s+successful\\b`,
    "i",
  );
  if (legacyOut.test(paragraph) || legacyOf.test(paragraph) || legacyWasWere.test(paragraph)) {
    return false;
  }

  // No trailing \b after "%": there is no word boundary between "%" and a following space,
  // so `\b20%\b` would reject correctly-phrased "…20% of trials…" paragraphs.
  if (!new RegExp(`\\b${pStr}%`, "i").test(paragraph)) return false;

  return new RegExp(
    `\\b${pStr}%\\s+of\\s+the\\s+time|` +
      `\\bsuccessful\\b[^.;]{0,160}?\\b${pStr}%|` +
      `\\b${pStr}%[^.;]{0,160}?\\bsuccessful|` +
      `\\bsucceeded\\b[^.;]{0,160}?\\b${pStr}%|` +
      `\\b${pStr}%\\s+of\\s+(?:recorded\\s+)?(?:discrete\\s+)?trials?|` +
      `\\bcriterion\\b[^.;]{0,160}?\\b${pStr}%|` +
      `\\b${pStr}%[^.;]{0,160}?\\bcriterion`,
    "i",
  ).test(paragraph);
}

function findEnvironmentalManipulationInterventionLabel(interventions: string[]): string | null {
  const names = interventions.map((s) => s.trim()).filter((s) => s.length > 0);
  return names.find((s) => /^environmental manipulation$/i.test(s)) ?? null;
}

function isSibMaladaptiveBehavior(behaviorName: string): boolean {
  const t = behaviorName.trim();
  if (!t) return false;
  if (maladaptiveBehaviorLabelsEquivalent(t, MALADAPTIVE_BEHAVIOR_SIB_CANONICAL)) return true;
  return /\bSIB\b/i.test(t) || /self[- ]?injurious\s+behavior/i.test(t);
}

/** True when the manifested-behavior sentence names the catalog label without observable topography detail. */
function manifestedBehaviorLacksObservableTopography(paragraph: string): boolean {
  const sentence = manifestedBehaviorSentenceSpan(paragraph);
  if (!sentence) return false;
  return !containsObservableClinicalAction(sentence);
}

function paragraphDocumentsInterventionFromList(paragraph: string, labels: string[]): boolean {
  const names = [...new Set(labels.map((s) => s.trim()).filter((s) => s.length > 0))].sort(
    (a, b) => b.length - a.length,
  );
  for (const name of names) {
    const re = new RegExp(`(?:implemented|applied)\\s+${escapeRegExp(name)}\\s*\\.`, "i");
    if (re.test(paragraph)) return true;
  }
  return false;
}

function findDraOrDriInterventionLabel(interventions: string[]): string | null {
  const names = interventions.map((s) => s.trim()).filter((s) => s.length > 0);
  return (
    names.find((s) => /differential reinforcement of alternative behaviors?\s*\(DRA\)/i.test(s)) ??
    names.find((s) => /differential reinforcement of incompatible behaviors?\s*\(DRI\)/i.test(s)) ??
    names.find((s) => /\(DRA\)/i.test(s)) ??
    names.find((s) => /\(DRI\)/i.test(s)) ??
    names.find((s) => /^DRA$/i.test(s)) ??
    names.find((s) => /^DRI$/i.test(s)) ??
    null
  );
}

function isNonBlockingFirstInterventionForSib(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (!n) return false;
  if (/^response block(?:ing)?$/i.test(n)) return false;
  if (/\bresponse block(?:ing)?\b/i.test(n)) return false;
  if (/^environmental manipulation$/i.test(n)) return false;
  if (/^dra$/i.test(n) || /\(dra\)/i.test(n) || /differential reinforcement of alternative/i.test(n)) {
    return true;
  }
  if (/^dri$/i.test(n) || /\(dri\)/i.test(n) || /differential reinforcement of incompatible/i.test(n)) {
    return true;
  }
  if (/^redirection$/i.test(n)) return true;
  if (/premack/.test(n)) return true;
  if (/^dro$/i.test(n) || /\(dro\)/i.test(n)) return true;
  return false;
}

function findDemandEscapeInterventionLabel(interventions: string[]): string | null {
  const names = interventions.map((s) => s.trim()).filter((s) => s.length > 0);
  return (
    names.find((s) => /^escape\s+extinction$/i.test(s)) ??
    names.find((s) => /^demand\s+fading$/i.test(s)) ??
    names.find((s) => /\bescape\s+extinction\b/i.test(s)) ??
    names.find((s) => /\bdemand\s+fading\b/i.test(s)) ??
    null
  );
}

function paragraphSuggestsDemandEscapePhysicalAggression(paragraph: string): boolean {
  return (
    /\b(?:guided|guiding|prompted|prompting|presented|re-presented|placed|placing|instruction|demand|task|clean-?up|stacking|shape sorter|worksheet|table work|hand-over-hand|hand over hand)\b/i.test(
      paragraph,
    ) &&
    /\b(?:pushed|pushing|struck|hit|hitting|swatted|kicked|scratched|pinched|bit|headbutt|head-butt|throwing\s+items?\s+at)\b/i.test(
      paragraph,
    )
  );
}

/** First catalog intervention naming sentence in consequence text (case-insensitive). */
function firstInterventionMentionInText(text: string, interventionNames: string[]): string | null {
  return firstNamedInterventionInConsequenceTail(text, interventionNames);
}


function findInterventionPartialMatchIssue(paragraph: string, catalog: string[]): string | null {
  for (const full of catalog) {
    const base = catalogInterventionBaseWithoutParenthetical(full);
    if (!base || paragraph.includes(full)) continue;
    const re = new RegExp(`(?:implemented|applied)\\s+${escapeRegExp(base)}\\s*\\.`, "i");
    if (re.test(paragraph)) {
      const suffix = full.match(/\(([^)]+)\)\s*$/)?.[1] ?? "acronym";
      return `Interventions: use exact catalog string "${full}" including (${suffix}), not "${base}" without the parenthetical.`;
    }
  }
  return null;
}

function findInventedInterventionLikePhraseIssues(
  paragraph: string,
  interventionCatalog: string[],
): string | null {
  for (const pat of DEFAULT_UNAUTHORIZED_INTERVENTION_LIKE_PHRASES) {
    const m = pat.exec(paragraph);
    if (!m) continue;
    const matched = m[0].trim();
    if (phraseMatchesAuthorizedIntervention(matched, interventionCatalog)) {
      continue;
    }
    return `Interventions: do not use detail phrasing that resembles an unauthorized intervention name (found "${matched}"). After the single catalog naming sentence, describe RBT actions in plain prose only (e.g. delivered praise, demonstrated placing an item)—do not title reinforcement or modeling with invented intervention-like labels.`;
  }

  const reinforcedWithPraise =
    /\breinforced\s+((?:[a-z]+\s+){1,6}?)\s+with\s+(?:verbal|behavior-specific)\s+praise\b/gi;
  let rp: RegExpExecArray | null;
  while ((rp = reinforcedWithPraise.exec(paragraph)) !== null) {
    const label = rp[1]!.trim();
    if (label.length < 6) continue;
    if (phraseMatchesAuthorizedIntervention(label, interventionCatalog)) continue;
    if (
      phraseMatchesAuthorizedIntervention(`${label} with verbal praise`, interventionCatalog) ||
      phraseMatchesAuthorizedIntervention(
        `${label} with behavior-specific praise`,
        interventionCatalog,
      )
    ) {
      continue;
    }
    return `Interventions: do not write "reinforced ${label} with verbal/behavior-specific praise" as if it were a catalog intervention; use plain prose (e.g. delivered praise contingent on …) after the one exact naming sentence for the catalog intervention.`;
  }

  return null;
}

function findInventedReplacementProgramPhraseIssues(
  paragraph: string,
  authorizedPrograms: string[],
): string | null {
  for (const pat of DEFAULT_UNAUTHORIZED_REPLACEMENT_LIKE_PHRASES) {
    const m = pat.exec(paragraph);
    if (!m) continue;
    const matched = m[0].trim();
    if (phraseMatchesAuthorizedReplacementProgram(matched, authorizedPrograms)) {
      continue;
    }
    return `Do not use teaching target phrasing that resembles an unauthorized replacement program (found "${matched}"; not on the client's approved replacement list). Describe observable prompting in plain prose only—the only replacement program name in the paragraph must be the verbatim replacementProgramForHour[s] inside the required quoted replacement-program sentence (e.g. avoid "keep both hands on the table", "hands-down behavior").`;
  }

  const reinforcedBehavior = /\breinforced\s+([a-z][a-z0-9-]*(?:\s+[a-z][a-z0-9-]*){0,4})\s+behavior\b/gi;
  let rb: RegExpExecArray | null;
  while ((rb = reinforcedBehavior.exec(paragraph)) !== null) {
    const label = rb[1]!.trim();
    if (label.length < 4) continue;
    if (phraseMatchesAuthorizedReplacementProgram(label, authorizedPrograms)) continue;
    if (/\b(verbal|appropriate|inappropriate|maladaptive|target)\b/i.test(label)) continue;
    return `Do not name reinforced teaching as "${label} behavior" unless that exact phrase is an approved replacement program on the client's list; use observable wording (e.g. reinforced appropriate hand placement) and cite only the verbatim replacementProgramForHour[s] in the replacement-program sentence.`;
  }

  return null;
}

function findMaladaptiveBehaviorAbbreviationIssue(
  paragraph: string,
  assigned: string,
  catalog: string[],
): string | null {
  const catalogHasFullSib = catalog.some((c) =>
    maladaptiveBehaviorLabelsEquivalent(c, MALADAPTIVE_BEHAVIOR_SIB_CANONICAL),
  );
  if (!catalogHasFullSib) return null;
  if (!maladaptiveBehaviorLabelsEquivalent(assigned, MALADAPTIVE_BEHAVIOR_SIB_CANONICAL)) {
    return null;
  }
  if (!/\bmanifested\b/i.test(paragraph)) return null;
  if (paragraph.includes(MALADAPTIVE_BEHAVIOR_SIB_CANONICAL)) return null;
  if (/\bmanifested\s+SIB\b/i.test(paragraph) || /\bmanifested\s+[^.;]{0,80}\bSIB\b/i.test(paragraph)) {
    return `Maladaptive behavior: use the full catalog label "${MALADAPTIVE_BEHAVIOR_SIB_CANONICAL}" in the manifested-behavior line, not "SIB" alone.`;
  }
  return null;
}

export function findUnauthorizedQuotedReplacementProgramIssue(
  paragraph: string,
  assignedProgram: string,
  authorizedPrograms: string[],
): string | null {
  // Program names can themselves contain quotes (e.g. Accept 'No' as an answer). Mask the assigned and
  // authorized program strings out of the paragraph first so the quoted-span scanner does not split
  // "Accept 'No' as an answer" into a bogus "Accept" token and flag it as unauthorized.
  const namesToMask = [assignedProgram, ...authorizedPrograms]
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .sort((a, b) => b.length - a.length);
  let masked = paragraph;
  for (const name of namesToMask) {
    masked = masked.split(name).join(" \u0000PROGRAM\u0000 ");
  }

  const authorizedKeys = new Set(
    authorizedPrograms.map((s) => normalizeReplacementProgramKey(s)).filter(Boolean),
  );
  const assignedKey = normalizeReplacementProgramKey(assignedProgram);
  const re = /replacement program\s+["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(masked)) !== null) {
    const quoted = m[1]!.trim();
    if (quoted.includes("\u0000")) continue;
    const quotedKey = normalizeReplacementProgramKey(quoted);
    if (quotedKey && quotedKey !== assignedKey && !authorizedKeys.has(quotedKey)) {
      return `Unauthorized replacement program "${quoted}" — use only the verbatim assigned program "${assignedProgram}" in the replacement-program sentence.`;
    }
  }
  return null;
}

/** First sentence = text up to first ". " (MVP; avoids most abbreviations in our locked prose). */
export function splitFirstSentence(fullNote: string): { first: string; rest: string } {
  const t = fullNote.trim();
  const idx = t.indexOf(". ");
  if (idx === -1) {
    return { first: t, rest: "" };
  }
  return { first: t.slice(0, idx + 1), rest: t.slice(idx + 2) };
}

const issuedMessageMetadata = new Map<string, Pick<NoteValidationIssue, "code" | "severity">>();
const MAX_COMPATIBILITY_MESSAGE_METADATA = 1_000;

/** Compatibility helper for callers that still retain validator messages as strings. */
export function isCriticalComplianceIssue(issue: string): boolean {
  return issuedMessageMetadata.get(issue)?.severity === "blocking";
}

/** Split string output using source-assigned metadata, never mutable English prefixes. */
export function classifyComplianceIssues(issues: string[]): {
  critical: string[];
  stylistic: string[];
} {
  const critical: string[] = [];
  const stylistic: string[] = [];
  for (const issue of issues) {
    (isCriticalComplianceIssue(issue) ? critical : stylistic).push(issue);
  }
  return { critical, stylistic };
}

function validateClinicalBodyComplianceInternal(
  clinicalBody: string,
  ctx: NoteComplianceContext,
  typedSink?: NoteValidationIssue[],
): string[] {
  const issues: string[] = [];
  const emittedIssueKeys = new Set<string>();
  const maxIssues = 200;
  const add = (
    code: NoteValidationIssueCode,
    severity: NoteValidationSeverity,
    message: string,
    paragraphIndex?: number,
  ): void => {
    const key = `${code}\u0000${paragraphIndex ?? -1}\u0000${message}`;
    if (emittedIssueKeys.has(key) || issues.length >= maxIssues) return;
    emittedIssueKeys.add(key);
    const issue = { code, severity, message, paragraphIndex };
    issues.push(message);
    typedSink?.push(issue);
    issuedMessageMetadata.set(message, { code, severity });
    if (issuedMessageMetadata.size > MAX_COMPATIBILITY_MESSAGE_METADATA) {
      const oldest = issuedMessageMetadata.keys().next().value;
      if (oldest !== undefined) issuedMessageMetadata.delete(oldest);
    }
  };
  const schoolSetting = isSchoolSettingLabel(ctx.therapySetting);

  if (/\\["']/.test(clinicalBody)) {
    add("FORMAT_QUOTATION", "warning",
      'Quotation marks: do not use backslash characters before quotes in the clinical body. Write plain straight double quotes only (for example Respond to safety instructions "Stop" or "wait", not \\"Stop\\").',
    );
  }

  let mentalHits = 0;
  for (const re of MENTAL_STATE_PATTERNS) {
    if (re.test(clinicalBody)) {
      add("LANGUAGE_OBJECTIVITY", "warning",
        `Observational-only rule: remove mental-state / interpretation phrasing (pattern "${re.source.slice(0, 48)}…") — document only observable actions and events.`,
      );
      if (++mentalHits >= 3) {
        break;
      }
    }
  }

  let subjectiveHits = 0;
  for (const re of SUBJECTIVE_WORDING_PATTERNS) {
    const m = re.exec(clinicalBody);
    if (m) {
      const snippet = m[0];
      add("LANGUAGE_OBJECTIVITY", "warning",
        `Subjective wording: remove "${snippet}" — ABA notes must be objective and observable. Replace with topography (e.g. "cried, dropped to the floor, kicked legs, threw materials") and measurable performance, not value words like upset/frustrated/happy/noncompliant/stubborn/bad day/fair performance/did well/did poorly.`,
      );
      if (++subjectiveHits >= 3) {
        break;
      }
    }
  }

  if (ctx.clientAgeYears !== null && ctx.clientAgeYears >= 0) {
    for (const re of ageInappropriatePatterns(ctx.clientAgeYears)) {
      if (re.test(clinicalBody)) {
        add("AGE_APPROPRIATENESS", "warning",
          `Age-appropriate activities: narrative may describe tasks unsuitable for approximately ${ctx.clientAgeYears} years old; use toddler/early-childhood activities only when age is low.`,
        );
        break;
      }
    }
  }

  if (isYouTubeBannedForAge(ctx.clientAgeYears) && mentionsYouTube(clinicalBody)) {
    add("AGE_APPROPRIATENESS", "warning",
      `Age gate: clients under ${YOUTUBE_MIN_AGE_YEARS} must not receive YouTube as a reinforcer, reward, or activity. Use another preference from reinforcementPreferences.`,
    );
  }

  const reinforcerPrefs = filterReinforcementPreferencesForNote(ctx.reinforcementPreferences ?? [], {
    clientAgeYears: ctx.clientAgeYears,
  });
  const concreteToys = concreteToyPreferences(reinforcerPrefs);
  if (
    concreteToys.length > 0 &&
    clinicalBodyHasUnspecifiedToyDelivery(clinicalBody) &&
    !clinicalBodyNamesConcreteToy(clinicalBody, concreteToys)
  ) {
    add("REINFORCER_SPECIFICITY", "warning",
      `Toy reinforcers must name a specific preferred toy from the client's list (e.g. ${concreteToys.slice(0, 3).join(", ")}), not bare "preferred toys" / unspecified "toys".`,
    );
  }

  const paragraphs = clinicalBody
    .trim()
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (schoolSetting) {
    for (let i = 0; i < paragraphs.length; i++) {
      if (schoolParagraphHasRbtOwnedClassroomActivity(paragraphs[i]!)) {
        add("SCHOOL_ACTIVITY_OWNERSHIP", "warning",
          `School setting activity ownership: paragraph ${i + 1} makes the RBT sound like they created, arranged, led, or presented the classroom lesson/activity. In school notes, the teacher should present classroom lessons/activities/materials, while the RBT supports the client and implements ABA programs, prompts, interventions, reinforcement, and data collection.`,
          i,
        );
      }
    }
  }

  const expectedParagraphs = ctx.narrativeSegmentCount ?? ctx.sessionHours;
  if (paragraphs.length !== expectedParagraphs) {
    add("PARAGRAPH_COUNT", "blocking",
      `Expected exactly ${expectedParagraphs} clinical paragraph(s) separated by blank lines (aligned with narrative segments for this session duration); found ${paragraphs.length}.`,
    );
  }

  const langEpisode = ctx.languageMaladaptiveEpisodeForHour ?? [];
  if (ctx.clientAgeYears !== null && ctx.clientAgeYears <= 3) {
    let speechHits = 0;
    for (let i = 0; i < paragraphs.length; i++) {
      if (langEpisode[i]) continue;
      const p = paragraphs[i]!;
      for (const re of TODDLER_ATTRIBUTED_SPEECH) {
        if (re.test(p)) {
          add("LANGUAGE_OBJECTIVITY", "warning",
            `Toddler / limited verbal: for very young clients, minimize complex speech attributed to the client (e.g. avoid "the client said/stated/replied…"); use vocalizations, gestures, and observable actions instead.`,
            i,
          );
          if (++speechHits >= 1) {
            break;
          }
        }
      }
      if (speechHits >= 1) break;
    }
  }

  const programs = ctx.replacementProgramsInOrder.filter((p) => p.trim().length > 0);
  const replacementPerHour = ctx.replacementProgramForHour ?? [];
  const behaviorCatalog = ctx.maladaptiveBehaviors ?? [];
  const assignedPerHour = ctx.maladaptiveBehaviorForHour ?? [];
  const acquisitionFlags = ctx.acquisitionOnlySegmentForHour ?? [];

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i]!;
    if (programs.length === 0) {
      continue;
    }
    const progCount = countDistinctCatalogLabelsInParagraph(p, programs);
    if (progCount > 1) {
      add("PROGRAM_ASSIGNMENT", "blocking",
        `One program per ABC: paragraph ${i + 1} references more than one distinct replacement program name from the catalog; that segment must name only the assigned program and must not describe or cite a second program from the list.`,
        i,
      );
    }
    const assignedRp = replacementPerHour[i]?.trim() ?? "";
    if (assignedRp.length > 0 && !p.includes(assignedRp)) {
      add("PROGRAM_ASSIGNMENT", "blocking",
        `Replacement program for paragraph ${i + 1}: include the assigned program exactly as given (character-for-character, including every "(" and ")"): "${assignedRp}".`,
        i,
      );
    }
    const assignedBeh = assignedPerHour[i]?.trim() ?? "";
    const acquisitionOnly = acquisitionFlags[i] === true;
    const behaviorToReplacementsMap = ctx.behaviorToReplacementsMap ?? {};
    const segmentFunctions = ctx.maladaptiveBehaviorFunctionsForHour?.[i];
    if (!acquisitionOnly && assignedBeh && assignedRp) {
      if (
        isMisfitReplacementForMaladaptiveBehavior(
          assignedBeh,
          assignedRp,
          behaviorToReplacementsMap,
          segmentFunctions,
        )
      ) {
        const primary = primaryFunctionForReplacementSelection(segmentFunctions);
        const functionHint =
          primary != null
            ? ` Documented function: ${primary}. Use only replacement programs mapped to "${assignedBeh}" in the BIP (see JSON \`behaviorReplacementCandidatesForHour[${i}]\`)—not generic function-category programs unless they appear in that candidate list.`
            : " Use a BIP-aligned replacement program for that behavior's topography—not safety stop/wait or leave-area programs unless the behavior is elopement/wandering.";
        add("PROGRAM_FUNCTION_MISMATCH", "blocking",
          `Replacement program function: paragraph ${i + 1} pairs "${assignedBeh}" with "${assignedRp}".${functionHint} The server rebalances auto-assignment when possible; align antecedent and teaching prose to the assigned program's function.`,
          i,
        );
      }
    }
  }

  for (let i = 0; i < replacementPerHour.length; i++) {
    for (let j = i + 1; j < replacementPerHour.length; j++) {
      const rpI = replacementPerHour[i]?.trim() ?? "";
      const rpJ = replacementPerHour[j]?.trim() ?? "";
      if (!rpI || rpI !== rpJ) continue;
      if (acquisitionFlags[i] || acquisitionFlags[j]) continue;
      const behI = assignedPerHour[i]?.trim() ?? "";
      const behJ = assignedPerHour[j]?.trim() ?? "";
      if (!behI || !behJ || behI === behJ) continue;
      const fnI = primaryFunctionForReplacementSelection(ctx.maladaptiveBehaviorFunctionsForHour?.[i]);
      const fnJ = primaryFunctionForReplacementSelection(ctx.maladaptiveBehaviorFunctionsForHour?.[j]);
      if (fnI && fnJ && fnI !== fnJ) {
        add("PROGRAM_FUNCTION_MISMATCH", "blocking",
          `Replacement program logic: paragraphs ${i + 1} (${behI}, ${fnI}) and ${j + 1} (${behJ}, ${fnJ}) share the same replacement program "${rpI}" but document different behavior functions. Use function-matched replacements from behaviorReplacementCandidatesForHour for each segment.`,
          i,
        );
      }
    }
  }

  const activityLockedPerHour = ctx.activityAntecedentForHour ?? [];

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i]!;
    const acquisitionOnly = acquisitionFlags[i] === true;
    const antecedentIssue = antecedentSpecificityIssue(p, i);
    if (antecedentIssue) {
      add("ANTECEDENT_INVALID", "warning", antecedentIssue, i);
    }
    const lockedActivity = activityLockedPerHour[i];
    if (typeof lockedActivity === "string" && lockedActivity.length > 0 && !p.includes(lockedActivity)) {
      add("ANTECEDENT_INVALID", "warning",
        `ABC Builder: paragraph ${i + 1} must include the selected activity/antecedent string verbatim (character-for-character): "${lockedActivity.slice(0, 80)}${lockedActivity.length > 80 ? "…" : ""}".`,
        i,
      );
    }
    if (behaviorCatalog.length > 0) {
      const bCount = countCatalogBehaviorsInParagraph(p, behaviorCatalog);
      if (acquisitionOnly) {
        if (bCount > 0) {
          add("BEHAVIOR_ASSIGNMENT", "blocking",
            `Skill-acquisition segment (paragraph ${i + 1}): do not cite any maladaptive behavior catalog label; this segment documents only the assigned skill-acquisition replacement program (no "manifested [maladaptive]" framing).`,
            i,
          );
        }
        const deficit = acquisitionOnlySkillDeficitFraming(p);
        if (deficit) {
          add("BEHAVIOR_ASSIGNMENT", "blocking",
            `Skill-acquisition segment (paragraph ${i + 1}): remove deficit/nonperformance wording (${deficit}). Skill-acquisition programs such as Echoic, Respond to Own Name, and Improve eye contact are teaching targets, not maladaptive behaviors targeted for reduction. Describe RBT teaching opportunities, prompt levels, observed approximations/orienting responses, and the entered trial percentage without framing missed or inconsistent responses as problem behavior.`,
            i,
          );
        }
      } else if (bCount > 1) {
        add("BEHAVIOR_ASSIGNMENT", "blocking",
          `One maladaptive behavior per ABC: paragraph ${i + 1} references more than one behavior name from the client catalog; use exactly one catalog behavior per narrative segment.`,
          i,
        );
      }
    }
    const assigned = assignedPerHour[i]?.trim();
    if (!acquisitionOnly && assigned && !p.includes(assigned)) {
      add("BEHAVIOR_ASSIGNMENT", "blocking",
        `Maladaptive behavior rotation: paragraph ${i + 1} must cite the assigned catalog label "${assigned}" (maladaptiveBehaviorForHour[${i}]) verbatim in the manifested-behavior portion.`,
        i,
      );
    }
    if (!acquisitionOnly && assigned && /\bthe client manifested\b/i.test(p) && manifestedBehaviorLacksObservableTopography(p)) {
      add("BEHAVIOR_TOPOGRAPHY", "blocking",
        `Behavior topography: paragraph ${i + 1} must describe observable actions in the manifested-behavior sentence (e.g. "manifested ${assigned} by …" with specific body movements, vocalizations, or contact)—not the catalog label alone. Use maladaptiveBehaviorTopographyForHour[${i}] when provided.`,
        i,
      );
    }
    if (!acquisitionOnly && assigned) {
      const abbrev = findMaladaptiveBehaviorAbbreviationIssue(p, assigned, behaviorCatalog);
      if (abbrev) {
        add("BEHAVIOR_ASSIGNMENT", "blocking", `Maladaptive behavior rotation: paragraph ${i + 1}: ${abbrev}`, i);
      }
      if (/physical\s+aggression/i.test(assigned) && physicalAggressionParagraphHasVerbalTopography(p)) {
        add("BEHAVIOR_TOPOGRAPHY", "blocking",
          `Physical Aggression topography: paragraph ${i + 1} must not include quoted speech, shouting, raised voice, or other verbal/vocal topography in the Physical Aggression episode. Use only person-directed physical contact/attempts such as hitting, kicking, pushing, scratching, pinching, headbutting, hair pulling, or throwing items at a person. If verbal aggression occurred, it requires a separate assigned verbal/language behavior paragraph; do not bundle it into Physical Aggression.`,
          i,
        );
      }
    }
    if (!acquisitionOnly && tantrumWithoutTopography(p)) {
      add("BEHAVIOR_TOPOGRAPHY", "blocking",
        `Tantrum topography: paragraph ${i + 1} mentions tantrum/meltdown without enough observable detail; describe what the client did (sounds, movements, materials) consistent with the assessment behavior definitions.`,
        i,
      );
    }
    if (!acquisitionOnly && assigned) {
      const storedTopography = ctx.maladaptiveBehaviorTopographyForHour?.[i]?.trim() ?? "";
      if (
        isElopementFamilyBehaviorLabel(assigned) &&
        elopementEpisodeLacksObservableTopography(p, assigned)
      ) {
        add("BEHAVIOR_TOPOGRAPHY", "blocking",
          `Elopement topography: paragraph ${i + 1} must describe observable leaving/boundary topography in the manifested-behavior sentence (e.g. ran toward exit/hallway, left the activity area without permission, moved beyond arm's reach)—not the catalog label alone. Use the client's stored BIP topography when provided in JSON maladaptiveBehaviorTopographyForHour[${i}].`,
          i,
        );
      }
      if (
        storedTopography.length > 0 &&
        !paragraphReflectsStoredTopography(
          manifestedBehaviorSentenceSpan(p),
          storedTopography,
        )
      ) {
        add("BEHAVIOR_TOPOGRAPHY", "blocking",
          `Behavior topography: paragraph ${i + 1} addresses "${assigned}" but does not reflect observable actions from the client's stored operational definition (${storedTopography.slice(0, 120)}${storedTopography.length > 120 ? "…" : ""}). Describe those same actions in natural session wording in the manifested-behavior sentence—do not paste the BIP/VIP definition verbatim.`,
          i,
        );
      }
    }
  }

  const interventionCatalog = (ctx.interventions ?? []).map((s) => s.trim()).filter((s) => s.length > 0);
  if (interventionCatalog.length >= 2) {
    for (let i = 0; i < paragraphs.length; i++) {
      const joined = findJoinedInterventionPairPhrase(paragraphs[i]!, interventionCatalog);
      if (joined) {
        add("INTERVENTION_CATALOG", "blocking",
          `Interventions: paragraph ${i + 1} joins two catalog interventions (${joined.a} and ${joined.b}) in one phrase (comma or "and" between names). Do not combine two catalog names into one noun phrase; use exact JSON labels in separate naming sentences (each ending with a period after the name). For most ABC segments document **one** intervention only—only safety-priority segments with Response Block on the client's list may use multiple **separate** naming sentences (never a compound label).`,
          i,
        );
      }
    }
  }
  if (interventionCatalog.length >= 1) {
    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i]!;
      for (const label of interventionCatalog) {
        const loose = new RegExp(`(?:implemented|applied)\\s+${escapeRegExp(label)}\\s*\\.`, "i");
        const exact = new RegExp(`(?:implemented|applied)\\s+${escapeRegExp(label)}\\s*\\.`);
        if (loose.test(p) && !exact.test(p)) {
          add(
            "INTERVENTION_CATALOG",
            "blocking",
            `Intervention exact match: paragraph ${i + 1} must use the catalog label "${label}" with exact capitalization, spacing, and punctuation.`,
            i,
          );
        }
      }
      const commaAfter = firstInterventionWithCommaBeforeBy(p, interventionCatalog);
      if (commaAfter) {
        add("INTERVENTION_CATALOG", "blocking",
          `Interventions: paragraph ${i + 1}: remove the comma between "${commaAfter}" and "by" (do not use a "…, by …" clause attached to the catalog name). End the naming sentence after the exact catalog name with a period, then describe implementation in a new sentence.`,
          i,
        );
      }
      const quoted = firstQuotedCatalogIntervention(p, interventionCatalog);
      if (quoted) {
        add("INTERVENTION_CATALOG", "blocking",
          `Interventions: paragraph ${i + 1}: remove double quotes around "${quoted}"; write the catalog intervention as plain text matching JSON exactly, in its own sentence ending with a period after the name.`,
          i,
        );
      }
      const attachedBy = firstInterventionNameWithAttachedByClause(p, interventionCatalog);
      if (attachedBy) {
        add("INTERVENTION_CATALOG", "blocking",
          `Interventions: paragraph ${i + 1}: do not attach "by …" to "${attachedBy}" in the same sentence as implemented/applied. Use two sentences: (1) "The RBT implemented ${attachedBy}." or "To address this behavior, the RBT implemented ${attachedBy}." with the exact JSON string and a period immediately after the name; (2) a separate sentence describing what was done (for example beginning with "Following this intervention, …").`,
          i,
        );
      }
      const partial = findInterventionPartialMatchIssue(p, interventionCatalog);
      if (partial) {
        add("INTERVENTION_CATALOG", "blocking", `Interventions: paragraph ${i + 1}: ${partial}`, i);
      }
      const inventedIntervention = findInventedInterventionLikePhraseIssues(p, interventionCatalog);
      if (inventedIntervention) {
        add("UNAUTHORIZED_CONTENT", "blocking", `Interventions: paragraph ${i + 1}: ${inventedIntervention}`, i);
      }
      const draDroCompound = compoundDraDroInterventionLabelIssue(p, i);
      if (draDroCompound) {
        add("INTERVENTION_CATALOG", "blocking", draDroCompound, i);
      }
    }
  }

  const replacementCatalog = (ctx.replacementProgramsInOrder ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i]!;
    const assigned = ctx.replacementProgramForHour[i]?.trim() ?? "";
    const invented = findInventedReplacementProgramPhraseIssues(p, replacementCatalog);
    if (invented) {
      add("UNAUTHORIZED_CONTENT", "blocking", `Replacement programs: paragraph ${i + 1}: ${invented}`, i);
    }
    if (assigned) {
      const unauthorized = findUnauthorizedQuotedReplacementProgramIssue(p, assigned, replacementCatalog);
      if (unauthorized) {
        add("UNAUTHORIZED_CONTENT", "blocking", `Replacement programs: paragraph ${i + 1}: ${unauthorized}`, i);
      }
    }
  }

  const trialSummaries = ctx.therapistTrialSummaryForReplacementHour;
  const responseBlockLabel = findResponseBlockInterventionLabel(ctx.interventions ?? []);
  const interventionList = ctx.interventions ?? [];
  const sibFunctionInterventionLabel = findDraOrDriInterventionLabel(interventionList);
  const sibEnvironmentalManipulationLabel = findEnvironmentalManipulationInterventionLabel(interventionList);
  const demandEscapeInterventionLabel = findDemandEscapeInterventionLabel(interventionList);

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i]!;
    const acquisitionOnly = acquisitionFlags[i] === true;
    const assignedBehavior = acquisitionOnly ? "" : (assignedPerHour[i]?.trim() ?? "");
    const trialEntry = trialSummaries?.[i];
    if (trialEntry && trialEntry.totalTrials >= 1) {
      const successN = trialEntry.successfulTrialNumbers.length;
      const pct = therapistTrialSuccessPercentRounded(successN, trialEntry.totalTrials);
      if (!therapistTrialPercentRollupPhrasePresent(p, successN, trialEntry.totalTrials)) {
        add("TRIAL_DATA", "blocking",
          `Therapist trial counts: paragraph ${i + 1} must state discrete-trial outcomes as a **percentage** tied to that program (rounded from intake: **${pct}%** of trials met criterion / **~${pct}%** of the time / **successful ~${pct}%** of the time — same rounding as the end-of-note performance line). Do **not** use "${successN} out of ${trialEntry.totalTrials} trials were successful" or other N-of-M trial count rollups. Do not use "trials were conducted" plus separate per-trial success lists.`,
          i,
        );
      }
    }
    if (ctx.rbtActionsOnlyOutcomeForHour?.[i] !== true && unsupportedProgressComparison(p)) {
      add("UNSUPPORTED_COMPARISON", "warning",
        `Unsupported progress comparison: paragraph ${i + 1} compares current performance to recent/prior sessions, baseline, or treatment goals, but prior-session trajectory data is not part of the session context. Remove the comparison and state only current-session performance supported by the entered data.`,
        i,
      );
    }

    // Phase 3 acquisition-only segments are teaching narratives, not maladaptive ABC chains.
    // Their labels/metrics are still checked above, but no behavior intervention is assigned.
    if (acquisitionOnly) {
      continue;
    }

    if (interventionCatalog.length === 0) {
      continue;
    }
    const implCount = countInterventionImplementationsInParagraph(p, interventionCatalog);
    const safetyChainAllowed =
      Boolean(responseBlockLabel) &&
      assignedBehavior.length > 0 &&
      assignedBehaviorAllowsResponseBlockSafetyChain(assignedBehavior);

    if (!safetyChainAllowed && implCount > 1) {
      add("INTERVENTION_COUNT", "blocking",
        `Interventions: paragraph ${i + 1} must document **one** catalog intervention for this ABC segment (one naming sentence: "… implemented [exact JSON label]." or "… applied [exact JSON label]." with a period immediately after the name, then separate sentences for detail). Pick the single best-matching entry from JSON interventions unless the segment is a safety-priority behavior with a response-blocking label on the client's list (Self-Injurious Behavior (SIB), **Physical Aggression**, wandering, elopement, baiting, bolting, running away, Property Destruction when immediately preventing harm)—then that response-blocking label must be first with additional interventions in separate naming sentences. **Never** use Response Block for Verbal Aggression, Task Refusal, Inappropriate Language, screaming/yelling alone, or noncompliance without unsafe physical behavior.`,
        i,
      );
    }
    if (implCount === 0) {
      add("INTERVENTION_MISSING", "blocking",
        `Interventions: paragraph ${i + 1} must document at least one catalog intervention using the exact JSON label in a naming sentence ending with a period right after the name (for example "The RBT implemented [exact label]." or "To address this behavior, the RBT implemented [exact label]."), then describe what was done in following sentences—do not put "by …" in the same sentence as the catalog name.`,
        i,
      );
    }
    if (implCount > 0) {
      const outcomeIssue = postInterventionOutcomeIssue(p, i);
      if (outcomeIssue) {
        add("POST_INTERVENTION_OUTCOME", "blocking", outcomeIssue, i);
      }
    }
    if (!acquisitionOnly && /\bthe client manifested\b/i.test(p)) {
      const reinforcementIssue = maladaptiveReinforcementContingencyIssue(p, i);
      if (reinforcementIssue) {
        add("REINFORCEMENT_CONTINGENCY", "blocking", reinforcementIssue, i);
      }
    }
    if (
      responseBlockLabel &&
      assignedBehavior &&
      isResponseBlockProhibitedBehavior(assignedBehavior)
    ) {
      const responseBlockLabels = interventionList.filter(isResponseBlockInterventionLabel);
      if (paragraphDocumentsInterventionFromList(p, responseBlockLabels)) {
        add("SAFETY_CHAIN", "blocking",
          `Response Block prohibited: paragraph ${i + 1} addresses "${assignedBehavior}" but names "${responseBlockLabel}". Response Blocking is only for immediate safety-risk physical topographies (Physical Aggression, Self-Injurious Behavior (SIB), elopement/wandering/bolting, Property Destruction when immediately preventing harm)—use function-based interventions from interventionCandidatesForHour[s] instead.`,
          i,
        );
      }
    }
    if (isSibMaladaptiveBehavior(assignedBehavior)) {
      const consequenceTail = interventionTailAfterManifestedBehavior(p);
      const firstNamed = firstInterventionMentionInText(consequenceTail, interventionList);
      const segmentFunctions = ctx.maladaptiveBehaviorFunctionsForHour?.[i];
      const primaryFunction = primaryFunctionForReplacementSelection(segmentFunctions);
      const attentionInterventions =
        primaryFunction === "attention"
          ? preferredInterventionCandidatesForBehaviorFunction(
              interventionList,
              segmentFunctions,
              assignedBehavior,
            )
          : [];
      if (responseBlockLabel) {
        const responseBlockFirst = paragraphHasResponseBlockFirst(p, responseBlockLabel, interventionList);
        if (!responseBlockFirst) {
          if (firstNamed && isResponseBlockInterventionLabel(firstNamed)) {
            add("SAFETY_CHAIN", "blocking",
              `SIB response blocking: paragraph ${i + 1} must use exact catalog spelling "${responseBlockLabel}" in the intervention naming sentence (for example "The RBT implemented ${responseBlockLabel}.").`,
              i,
            );
          } else {
            add("SAFETY_CHAIN", "blocking",
              `SIB response blocking: paragraph ${i + 1} addresses "${MALADAPTIVE_BEHAVIOR_SIB_CANONICAL}" but must name "${responseBlockLabel}" as the **first** catalog intervention after the manifested-behavior line—before DRA, DRI, Premack principle, Redirection, Environmental Manipulation, or any other approved intervention. Use "To address this behavior, the RBT implemented ${responseBlockLabel}." then describe blocking/protection in **Following this intervention,** and only then name any additional approved catalog intervention or replacement program.`,
              i,
            );
          }
        } else {
          const draDriCandidates = attentionInterventions.filter(isDraOrDriInterventionLabel);
          const functionCandidates =
            primaryFunction === "attention" && draDriCandidates.length > 0
              ? draDriCandidates
              : attentionInterventions.length > 0
                ? attentionInterventions
                : preferredInterventionCandidatesForBehaviorFunction(
                    interventionList,
                    segmentFunctions,
                    assignedBehavior,
                  ).filter((s) => !isResponseBlockInterventionLabel(s));
          const checkCandidates =
            functionCandidates.length > 0
              ? functionCandidates
              : interventionList.filter((s) => !isResponseBlockInterventionLabel(s.trim()));
          if (
            checkCandidates.length > 0 &&
            !hasFunctionMatchedInterventionAfterResponseBlock(p, responseBlockLabel, checkCandidates)
          ) {
            const sample =
              selectSecondSafetyChainIntervention({
                assignedBehavior,
                interventions: interventionList,
                behaviorFunctions: segmentFunctions,
              }) ?? checkCandidates[0];
            if (
              primaryFunction === "attention" &&
              draDriCandidates.length > 0
            ) {
              add("SAFETY_CHAIN", "blocking",
                `SIB attention function: paragraph ${i + 1} addresses "${MALADAPTIVE_BEHAVIOR_SIB_CANONICAL}" with documented attention function and Response Block first. Name "${draDriCandidates[0]}" (or another listed DRA/DRI label) as the **second** catalog intervention naming sentence after blocking is described—Attention independent response delivery alone does not target the attention-maintained contingency when DRA/DRI are on the approved list.`,
                i,
              );
            } else {
              add("SAFETY_CHAIN", "blocking",
                `Safety chain function match: paragraph ${i + 1} pairs "${assignedBehavior}" with "${responseBlockLabel}" only. Response Block is safety/support only—not primary treatment. Name "${sample}" as the **second** catalog intervention naming sentence after blocking is described.`,
                i,
              );
            }
          } else {
            const tail = interventionTailAfterManifestedBehavior(p);
            const blockRe = new RegExp(
              `(?:implemented|applied)\\s+${escapeRegExp(responseBlockLabel)}\\s*\\.`,
              "i",
            );
            const blockMatch = blockRe.exec(tail);
            const afterBlock = blockMatch
              ? tail.slice(blockMatch.index + blockMatch[0].length)
              : tail;
            const secondNamed = firstInterventionMentionInText(afterBlock, interventionList);
            if (
              secondNamed &&
              primaryFunction === "attention" &&
              draDriCandidates.length > 0 &&
              isInsufficientAttentionInterventionAfterSibSafetyChain(secondNamed, interventionList)
            ) {
              add("SAFETY_CHAIN", "blocking",
                `SIB attention function: paragraph ${i + 1} names "${secondNamed}" after Response Block, but DRA/DRI are on the approved intervention list for attention-maintained SIB. Use "${draDriCandidates[0]}" as the second catalog intervention naming sentence to reinforce an alternative/incompatible behavior.`,
                i,
              );
            }
          }
        }
      } else if (
        primaryFunction === "attention" &&
        attentionInterventions.length > 0 &&
        firstNamed &&
        isFunctionMisfitIntervention(
          firstNamed,
          segmentFunctions,
          interventionList,
          MALADAPTIVE_BEHAVIOR_SIB_CANONICAL,
        )
      ) {
        add("INTERVENTION_FUNCTION_MISMATCH", "blocking",
          `SIB function match: paragraph ${i + 1} addresses "${MALADAPTIVE_BEHAVIOR_SIB_CANONICAL}" with documented attention function but names "${firstNamed}" as the catalog intervention. ${functionInterventionMismatchHint("attention", attentionInterventions)} Do not use Environmental Manipulation alone for attention-maintained SIB when attention-matched interventions are on the approved list.`,
          i,
        );
      } else if (
        sibEnvironmentalManipulationLabel &&
        firstNamed &&
        isNonBlockingFirstInterventionForSib(firstNamed) &&
        firstNamed !== sibEnvironmentalManipulationLabel
      ) {
        add("SAFETY_CHAIN", "blocking",
          `SIB safety: paragraph ${i + 1} addresses "${MALADAPTIVE_BEHAVIOR_SIB_CANONICAL}" but names "${firstNamed}" before immediate physical protection. Response Block/Response Blocking is not on the client's approved intervention list—add it to the BIP when possible. Until then, use "${sibEnvironmentalManipulationLabel}" as the first catalog intervention naming sentence for SIB (for example padding/removing hard surfaces or blocking access), then describe protective blocking in following plain prose before any DRA/Redirection/Premack naming sentence.`,
          i,
        );
      } else if (!sibEnvironmentalManipulationLabel && firstNamed && isNonBlockingFirstInterventionForSib(firstNamed)) {
        add("SAFETY_CHAIN", "blocking",
          `SIB safety: paragraph ${i + 1} addresses "${MALADAPTIVE_BEHAVIOR_SIB_CANONICAL}" but the client's approved intervention list does not include Response Block, Response Blocking, or Environmental Manipulation. Add Response Block/Response Blocking to the client BIP for SIB episodes; do not use "${firstNamed}" as the first named intervention without a documented response-blocking safety chain.`,
          i,
        );
      } else if (
        sibFunctionInterventionLabel &&
        firstNamed &&
        /^redirection$/i.test(firstNamed.trim())
      ) {
        add("SAFETY_CHAIN", "blocking",
          `SIB intervention coherence: paragraph ${i + 1} addresses "${MALADAPTIVE_BEHAVIOR_SIB_CANONICAL}" with Redirection even though "${sibFunctionInterventionLabel}" is on the client's approved intervention list. Use "${sibFunctionInterventionLabel}" only after response blocking is documented (Response Block/Response Blocking when listed, otherwise Environmental Manipulation when listed). Redirection alone does not address SIB safety.`,
          i,
        );
      }
    }
    if (!acquisitionOnly && assignedBehavior) {
      const segmentFunctions = ctx.maladaptiveBehaviorFunctionsForHour?.[i];
      const consequenceTail = interventionTailAfterManifestedBehavior(p);
      const firstNamedIntervention = firstInterventionMentionInText(consequenceTail, interventionList);
      const primaryFunction = primaryFunctionForReplacementSelection(segmentFunctions);
      const safetyChainBehavior =
        Boolean(responseBlockLabel) &&
        assignedBehaviorAllowsResponseBlockSafetyChain(assignedBehavior);
      const responseBlockIsFirst =
        safetyChainBehavior &&
        Boolean(responseBlockLabel) &&
        paragraphHasResponseBlockFirst(p, responseBlockLabel!, interventionList);
      if (
        firstNamedIntervention &&
        !isSibMaladaptiveBehavior(assignedBehavior) &&
        !responseBlockIsFirst &&
        isFunctionMisfitIntervention(
          firstNamedIntervention,
          segmentFunctions,
          interventionList,
          assignedBehavior,
        )
      ) {
        const candidates = preferredInterventionCandidatesForBehaviorFunction(
          interventionList,
          segmentFunctions,
          assignedBehavior,
        );
        const mismatchFn =
          primaryFunction && primaryFunction !== "automatic" ? primaryFunction : "tangible";
        add("INTERVENTION_FUNCTION_MISMATCH", "blocking",
          `Intervention function match: paragraph ${i + 1} pairs "${assignedBehavior}" with "${firstNamedIntervention}". ${functionInterventionMismatchHint(mismatchFn, candidates)} Use one exact catalog intervention from JSON \`interventionCandidatesForHour[${i}]\` when that array is non-empty.`,
          i,
        );
      }
      if (
        responseBlockIsFirst &&
        primaryFunction &&
        primaryFunction !== "automatic"
      ) {
        const candidates = preferredInterventionCandidatesForBehaviorFunction(
          interventionList,
          segmentFunctions,
          assignedBehavior,
        ).filter((s) => !isResponseBlockInterventionLabel(s));
        const checkCandidates =
          candidates.length > 0
            ? candidates
            : interventionList.filter((s) => !isResponseBlockInterventionLabel(s.trim()));
        if (
          checkCandidates.length > 0 &&
          !hasFunctionMatchedInterventionAfterResponseBlock(p, responseBlockLabel!, checkCandidates)
        ) {
          const sample =
            selectSecondSafetyChainIntervention({
              assignedBehavior,
              interventions: interventionList,
              behaviorFunctions: segmentFunctions,
            }) ?? checkCandidates[0];
          add("SAFETY_CHAIN", "blocking",
            `Safety chain function match: paragraph ${i + 1} pairs "${assignedBehavior}" with "${responseBlockLabel}" only. Response Block is safety/support only—not primary treatment. ${functionInterventionAfterSafetyChainHint(primaryFunction, checkCandidates)} Name "${sample}" as the **second** catalog intervention naming sentence after blocking is described.`,
            i,
          );
        } else if (primaryFunction === "attention" && candidates.some(isDraOrDriInterventionLabel)) {
          const consequenceAfterBlock = interventionTailAfterManifestedBehavior(p);
          const blockIdx = consequenceAfterBlock.indexOf(responseBlockLabel!);
          const afterBlock =
            blockIdx >= 0
              ? consequenceAfterBlock.slice(blockIdx + responseBlockLabel!.length)
              : consequenceAfterBlock;
          const secondNamed = firstInterventionMentionInText(afterBlock, interventionList);
          if (
            secondNamed &&
            isInsufficientAttentionInterventionAfterSibSafetyChain(secondNamed, interventionList)
          ) {
            const draDri = candidates.filter(isDraOrDriInterventionLabel);
            add("SAFETY_CHAIN", "blocking",
              `Attention function safety chain: paragraph ${i + 1} names "${secondNamed}" after Response Block, but DRA/DRI are on the approved list for attention-maintained "${assignedBehavior}". Use "${draDri[0] ?? "DRA/DRI"}" as the second catalog intervention naming sentence.`,
              i,
            );
          }
        }
      } else if (
        primaryFunction === "attention" &&
        !responseBlockIsFirst &&
        interventionList.some(isDraOrDriInterventionLabel) &&
        /\bthe client manifested\b/i.test(p)
      ) {
        const draDriLabels = interventionList.filter(isDraOrDriInterventionLabel);
        if (!paragraphDocumentsInterventionFromList(p, draDriLabels)) {
          add("INTERVENTION_FUNCTION_MISMATCH", "blocking",
            `Mandatory DRA: paragraph ${i + 1} documents attention-maintained "${assignedBehavior}" but does not name DRA/DRI from JSON interventions. Include ${draDriLabels[0] ?? "DRA/DRI"} as the catalog intervention naming sentence when listed.`,
            i,
          );
        }
      } else if (
        responseBlockIsFirst &&
        implCount === 1 &&
        safetyChainBehavior
      ) {
        const fallback = interventionList.filter((s) => !isResponseBlockInterventionLabel(s.trim()));
        if (
          fallback.length > 0 &&
          !hasFunctionMatchedInterventionAfterResponseBlock(p, responseBlockLabel!, fallback)
        ) {
          const sample =
            selectSecondSafetyChainIntervention({
              assignedBehavior,
              interventions: interventionList,
              behaviorFunctions: segmentFunctions,
            }) ?? fallback[0];
          add("SAFETY_CHAIN", "blocking",
            `Safety chain function match: paragraph ${i + 1} documents "${responseBlockLabel}" only for "${assignedBehavior}". Response Block is safety/support only. Name "${sample}" as a **second** catalog intervention naming sentence after blocking is described.`,
            i,
          );
        }
      }
      if (
        isSibMaladaptiveBehavior(assignedBehavior) &&
        primaryFunction === "attention" &&
        /\bthe client manifested\b/i.test(p)
      ) {
        const ncrLabel = findNonContingentReinforcementInterventionLabel(interventionList);
        if (ncrLabel && !paragraphDocumentsNonContingentReinforcement(p)) {
          add("SAFETY_CHAIN", "warning",
            `Attention NCR: paragraph ${i + 1} documents attention-maintained "${assignedBehavior}" but does not name "${ncrLabel}" (non-contingent reinforcement / attention independent response delivery). NCR is the BIP-mapped intervention that targets the attention contingency maintaining SIB; Response Block manages topography and DRA reinforces an alternative behavior, but neither reduces the reinforcing value of attention on its own. Add "${ncrLabel}" as a catalog intervention naming sentence alongside the rest of the chain when it is on the approved list—confirm the strategy with the BCBA.`,
            i,
          );
        }
      }
    }
    if (
      demandEscapeInterventionLabel &&
      /physical\s+aggression/i.test(assignedBehavior) &&
      paragraphSuggestsDemandEscapePhysicalAggression(p)
    ) {
      const consequenceTail = interventionTailAfterManifestedBehavior(p);
      const firstNamed = firstInterventionMentionInText(consequenceTail, interventionList);
      if (responseBlockLabel && firstNamed && isResponseBlockInterventionLabel(firstNamed)) {
        if (
          !paragraphHasResponseBlockFirst(p, responseBlockLabel, interventionList)
        ) {
          add("SAFETY_CHAIN", "blocking",
            `Physical Aggression intervention coherence: paragraph ${i + 1} must use exact catalog spelling "${responseBlockLabel}" when Response Block is the first intervention.`,
            i,
          );
        } else if (
          !hasFunctionMatchedInterventionAfterResponseBlock(p, responseBlockLabel, [
            demandEscapeInterventionLabel,
          ])
        ) {
          add("SAFETY_CHAIN", "blocking",
            `Physical Aggression intervention coherence: paragraph ${i + 1} describes physical aggression during a demand or guided task with Response Block/Response Blocking first. Also name "${demandEscapeInterventionLabel}" in a **second** catalog intervention naming sentence after blocking is described, then describe DRA/prompting/reinforcement only as plain follow-up detail if clinically appropriate and approved.`,
            i,
          );
        }
      } else if (firstNamed && firstNamed !== demandEscapeInterventionLabel) {
        add("INTERVENTION_FUNCTION_MISMATCH", "blocking",
          `Physical Aggression intervention coherence: paragraph ${i + 1} describes physical aggression during a demand or guided task and the approved intervention list includes "${demandEscapeInterventionLabel}". Use "${demandEscapeInterventionLabel}" as the exact catalog intervention naming sentence for this demand-escape episode, then describe DRA/prompting/reinforcement only as plain follow-up detail if clinically appropriate and approved.`,
          i,
        );
      }
    }
  }

  if (responseBlockLabel) {
    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i]!;
      if (acquisitionFlags[i] === true) {
        continue;
      }
      const assignedBehavior = assignedPerHour[i]?.trim() ?? "";
      if (!assignedBehavior || !assignedBehaviorAllowsResponseBlockSafetyChain(assignedBehavior)) {
        continue;
      }
      if (isSibMaladaptiveBehavior(assignedBehavior)) {
        continue;
      }
      const consequenceTail = interventionTailAfterManifestedBehavior(p);
      if (
        responseBlockLabel &&
        !paragraphHasResponseBlockFirst(p, responseBlockLabel, interventionList) &&
        firstInterventionMentionInText(consequenceTail, interventionList)
      ) {
        add("SAFETY_CHAIN", "blocking",
          `Safety-priority behavior (${assignedBehavior}): paragraph ${i + 1} must name "${responseBlockLabel}" as the first catalog intervention after the manifested-behavior line (before other listed interventions such as environmental manipulation), in its own naming sentence ending with a period after the exact label—for example "To address this behavior, the RBT implemented ${responseBlockLabel}."`,
          i,
        );
      }
    }
  }

  if (CAREGIVER_LEXICON.test(maskQuotedCatalogSpans(clinicalBody))) {
    add("CAREGIVER_LEAKAGE", "blocking",
      "Clinical body must not mention caregivers, parents, or guardians; the fixed opening already covers presence once.",
    );
  }

  if (PEER_OR_GROUP_ACTIVITY_LEXICON.test(clinicalBody)) {
    add("PEER_GROUP_LEAKAGE", "warning",
      "Clinical body must document only the RBT's one-to-one work with the client. Remove small-group, peer, classmate, children, kids, other-student, or group-play language; describe the materials/activity as arranged for the client only.",
    );
  }

  for (const name of ctx.presentPeople) {
    const n = name.trim();
    if (n.length < 2) continue;
    if (schoolSetting && isTeacherRole(n)) continue;
    const re = new RegExp(`\\b${escapeRegExp(n)}\\b`, "i");
    if (re.test(clinicalBody)) {
      add("PRESENT_PERSON_LEAKAGE", "blocking",
        `Clinical body must not name present people (e.g. "${n}"); only the system opening sentence lists who was present.`,
      );
    }
  }

  const blockedNames = [...new Set((ctx.blockedClientNames ?? []).map((name) => name.trim()).filter((name) => name.length >= 2))];
  for (const name of blockedNames) {
    const re = new RegExp(`\\b${escapeRegExp(name)}\\b`, "i");
    if (re.test(clinicalBody)) {
      add(
        "CLIENT_NAME_LEAKAGE",
        "blocking",
        `Clinical body must refer to the learner only as "the client"; remove the learner name "${name}".`,
      );
    }
  }

  return issues;
}

export function validateClinicalBodyComplianceDetailed(
  clinicalBody: string,
  ctx: NoteComplianceContext,
): NoteValidationResult {
  const typed: NoteValidationIssue[] = [];
  validateClinicalBodyComplianceInternal(clinicalBody, ctx, typed);
  return validationResult(typed);
}

/** Backward-compatible string-only validator output. */
export function validateClinicalBodyCompliance(
  clinicalBody: string,
  ctx: NoteComplianceContext,
): string[] {
  return validateClinicalBodyComplianceInternal(clinicalBody, ctx);
}

export type AssembledSessionNoteValidationContext = {
  presentPeople: string[];
  hasEnvironmentalChanges: boolean;
  therapySetting: TherapySetting;
  nextSessionDate?: string | undefined;
  clientFirstName?: string | null | undefined;
  blockedClientNames?: string[] | undefined;
  narrativeProgramSegmentCount: number;
  therapistTrialSummaryForReplacementHour?: TherapistTrialSummaryForHourEntry[] | undefined;
  reinforcementPreferences?: string[] | null | undefined;
  clientAgeYears?: number | null | undefined;
};

/** Final deterministic gate for locked prose and end-of-note ordering. */
export function validateAssembledSessionNote(
  fullNote: string,
  ctx: AssembledSessionNoteValidationContext,
): NoteValidationResult {
  const issues: NoteValidationIssue[] = [];
  const add = (code: NoteValidationIssueCode, message: string): void => {
    issues.push({ code, severity: "blocking", message });
  };
  const opening = buildLockedOpening(
    ctx.presentPeople,
    ctx.hasEnvironmentalChanges,
    ctx.therapySetting,
    ctx.clientFirstName,
  );
  const closing = buildLockedClosingParagraph(ctx.reinforcementPreferences, {
    clientAgeYears: ctx.clientAgeYears,
  });
  const performance = buildPerformanceSentence(
    ctx.narrativeProgramSegmentCount,
    ctx.therapistTrialSummaryForReplacementHour,
    ctx.clientFirstName,
  );
  const nextSession = buildNextSessionSentence(ctx.nextSessionDate);
  const expectedTail = `${closing}\n\n${performance}\n\n${nextSession}`;

  if (!fullNote.startsWith(`${opening}\n\n`)) {
    add("LOCKED_OPENING", "Assembled note does not begin with the exact runtime locked opening.");
    const expectedEnvironment = opening.slice(opening.indexOf(". ") + 2);
    if (!fullNote.includes(expectedEnvironment)) {
      add("LOCKED_ENVIRONMENT", "Assembled note is missing or contradicts the runtime environmental-status sentence.");
    }
  }
  if (!fullNote.endsWith(expectedTail)) {
    if (!fullNote.includes(closing)) {
      add("LOCKED_CLOSING", "Assembled note is missing the exact runtime locked closing paragraph.");
    }
    add(
      "END_SEQUENCE",
      "Assembled note must end with locked closing, performance sentence, and date-only next-session sentence in exact order.",
    );
  }
  if (/\bnext session\b[^\n]*(?:home|school|community|clinic|center)\b/i.test(fullNote)) {
    add("NEXT_SESSION_LOCATION", "Next-session sentence must contain only the date and no session location.");
  }
  for (const message of validateCaregiverMentionRule(fullNote, ctx.presentPeople, {
    ignoreSpans: [closing, performance, nextSession],
  })) {
    add("CAREGIVER_LEAKAGE", message);
  }

  const blockedNames = [...new Set((ctx.blockedClientNames ?? []).map((name) => name.trim()).filter((name) => name.length >= 2))];
  const learnerNameLeakScan = fullNote.replace(opening, "").replace(performance, "");
  for (const name of blockedNames) {
    if (new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(learnerNameLeakScan)) {
      add(
        "CLIENT_NAME_LEAKAGE",
        `Assembled note uses learner name "${name}" outside the locked opening/performance slots.`,
      );
    }
  }

  return validationResult(issues);
}

