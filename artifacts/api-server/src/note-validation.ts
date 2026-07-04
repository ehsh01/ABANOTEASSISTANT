import {
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
  findResponseBlockInterventionLabel,
  firstNamedInterventionInConsequenceTail,
  hasFunctionMatchedInterventionAfterResponseBlock,
  interventionTailAfterManifestedBehavior,
  paragraphHasResponseBlockFirst,
  selectSecondSafetyChainIntervention,
} from "./safety-chain-enforcement";
import {
  elopementEpisodeLacksObservableTopography,
  isElopementFamilyBehaviorLabel,
  paragraphReflectsStoredTopography,
} from "./maladaptive-behavior-topography";
import {
  functionBasedReplacementPredicates,
  isElopementSafetyNavigationBehavior,
  isFunctionMisfitReplacement,
  isSafetyLeaveAreaReplacementProgram,
  primaryFunctionForReplacementSelection,
  replacementProgramMatchesFunctionCategory,
} from "./behavior-function-replacement-mapping";

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
};

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
  /\b(caregiver|caregivers|parent|parents|guardian|guardians|mother|father|mom|dad|mommy|daddy|stepmother|stepfather)\b/i;

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
  if (outcomePatterns.some((re) => re.test(detail))) return null;
  return `Post-intervention outcome: paragraph ${paragraphIndex + 1} must state an observable result after the intervention (for example, the client completed one step, returned to the task, remained seated/nearby, placed materials, or engaged with materials). Do not stop after listing only RBT actions.`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

/**
 * Full BIP catalog label for self-injury — use verbatim in notes; never substitute bare "SIB"
 * when this label is on the client's catalog or assigned for the hour/segment.
 */
export const MALADAPTIVE_BEHAVIOR_SIB_CANONICAL = "Self-Injurious Behavior (SIB)";

/** Map common profile/assessment aliases to the catalog string used in rotation and narrative. */
export function canonicalMaladaptiveBehaviorLabel(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  const lower = t.toLowerCase();
  if (
    lower === "sib" ||
    lower === "self-injurious behavior" ||
    lower === "self injurious behavior" ||
    lower === "self-injurious behavior (sib)"
  ) {
    return MALADAPTIVE_BEHAVIOR_SIB_CANONICAL;
  }
  return t;
}

export function maladaptiveBehaviorLabelsEquivalent(a: string, b: string): boolean {
  return canonicalMaladaptiveBehaviorLabel(a) === canonicalMaladaptiveBehaviorLabel(b);
}

function assessmentTextMentionsStandardMaladaptiveBehavior(
  assessment: string,
  standardLabel: string,
): boolean {
  if (assessment.includes(standardLabel)) return true;
  if (maladaptiveBehaviorLabelsEquivalent(standardLabel, MALADAPTIVE_BEHAVIOR_SIB_CANONICAL)) {
    return /\bSIB\b/i.test(assessment) || /self[- ]?injurious\s+behavior/i.test(assessment);
  }
  return false;
}

/** Canonical rotation order for common BIP maladaptive behavior names (exact spelling for substring match in assessment text). */
export const STANDARD_MALADAPTIVE_BEHAVIOR_ROTATION_ORDER: readonly string[] = [
  "Physical Aggression",
  "Task Refusal",
  "Property Destruction",
  MALADAPTIVE_BEHAVIOR_SIB_CANONICAL,
  "Inappropriate Social Behavior",
  "Bolting",
  "Disruption",
] as const;

function dedupeMaladaptiveBehaviorOrder(catalog: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const raw of catalog) {
    const s = canonicalMaladaptiveBehaviorLabel(raw.trim());
    if (!s || seen.has(s)) continue;
    seen.add(s);
    ordered.push(s);
  }
  return ordered;
}

export type MaladaptiveBehaviorsCatalogForRotationResult = {
  /** Labels used for maladaptiveBehaviorForHour + compliance (exact strings for the model). */
  catalog: string[];
  /** Standard-order names found in assessment text but not on the client profile. */
  labelsAddedFromAssessmentText: string[];
  /**
   * Catalog labels whose exact text does not appear verbatim in the stored assessment snapshot (OCR/wording drift).
   * They remain in rotation when listed on the client profile; the RBT should verify BIP wording if this is non-empty.
   */
  labelsOmittedNotFoundInAssessment: string[];
};

/**
 * Build the maladaptive-behavior rotation list:
 * - Order profile entries using STANDARD_MALADAPTIVE_BEHAVIOR_ROTATION_ORDER when names match exactly.
 * - Append other profile labels (custom BIP wording) after that block.
 * - When assessment text is non-empty: add standard names that appear verbatim in the text but were missing from the profile.
 * - **All profile-listed behaviors stay in the catalog** even when the PDF snapshot does not contain that exact substring
 *   (common with OCR, line breaks, or alternate wording). Narrowing to “verbatim in text only” caused notes to repeat the same
 *   few behaviors; rotation must cover the full client/BIP list from the profile plus assessment-detected standards.
 */
export function maladaptiveBehaviorsCatalogForRotation(
  profileBehaviors: string[],
  assessmentTextFull: string,
): MaladaptiveBehaviorsCatalogForRotationResult {
  const profile = dedupeMaladaptiveBehaviorOrder(profileBehaviors);
  const assessment = assessmentTextFull.trim();

  const head = STANDARD_MALADAPTIVE_BEHAVIOR_ROTATION_ORDER.filter((s) =>
    profile.some((p) => maladaptiveBehaviorLabelsEquivalent(p, s)),
  );
  const profileRemainder = profile.filter(
    (p) => !head.some((h) => maladaptiveBehaviorLabelsEquivalent(p, h)),
  );

  const labelsAddedFromAssessmentText: string[] = [];
  if (assessment.length > 0) {
    for (const s of STANDARD_MALADAPTIVE_BEHAVIOR_ROTATION_ORDER) {
      if (
        assessmentTextMentionsStandardMaladaptiveBehavior(assessment, s) &&
        !profile.some((p) => maladaptiveBehaviorLabelsEquivalent(p, s))
      ) {
        labelsAddedFromAssessmentText.push(s);
      }
    }
  }

  const standardBlock = dedupeMaladaptiveBehaviorOrder([...head, ...labelsAddedFromAssessmentText]);

  const catalog = dedupeMaladaptiveBehaviorOrder([...standardBlock, ...profileRemainder]);

  const labelsOmittedNotFoundInAssessment =
    assessment.length > 0 && catalog.length > 0
      ? catalog.filter((c) => !assessmentTextMentionsStandardMaladaptiveBehavior(assessment, c))
      : [];

  return {
    catalog,
    labelsAddedFromAssessmentText,
    labelsOmittedNotFoundInAssessment,
  };
}

/** Non-cryptographic hash for rotating which catalog behavior starts hour 0 (variety across regenerations). */
export function hashStringForRotation(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * One assigned behavior label per service hour, cycling `catalog` in order (deduped, first-seen order preserved).
 * Ensures multi-hour notes rotate through the full BIP list before repeating (e.g. all seven behaviors across seven hours).
 * When `rotationSeed` is set, hour 0 starts at a pseudorandom offset into the catalog so the same three labels are not
 * always the first block for short sessions.
 */
export function maladaptiveBehaviorsForSessionHours(
  catalog: string[],
  sessionHours: number,
  rotationSeed?: string,
): string[] {
  const ordered = dedupeMaladaptiveBehaviorOrder(catalog);
  if (sessionHours <= 0) return [];
  if (ordered.length === 0) {
    return Array.from({ length: sessionHours }, () => "");
  }
  const start =
    rotationSeed && rotationSeed.length > 0 ? hashStringForRotation(rotationSeed) % ordered.length : 0;
  return Array.from(
    { length: sessionHours },
    (_, h) => ordered[(start + h) % ordered.length]!,
  );
}

/**
 * One assigned replacement program per service hour, cycling the wizard-ordered list.
 */
export function replacementProgramsForSessionHours(programNames: string[], sessionHours: number): string[] {
  const names = programNames.map((s) => s.trim()).filter((s) => s.length > 0);
  if (sessionHours <= 0) return [];
  if (names.length === 0) {
    return Array.from({ length: sessionHours }, () => "");
  }
  return Array.from({ length: sessionHours }, (_, h) => names[h % names.length]!);
}

/**
 * Build a pool of program ids: wizard-selected ids that appear in `linkedProgramIds` first (in selection order),
 * then every other linked id (stable ascending by id). Used so auto-filled hours can draw from **all** linked
 * programs instead of only cycling the small selected subset.
 */
export function replacementProgramPoolOrdered(selectedIdsOrdered: number[], linkedProgramIds: number[]): number[] {
  const linkedSet = new Set(linkedProgramIds);
  const seen = new Set<number>();
  const pool: number[] = [];
  for (const id of selectedIdsOrdered) {
    if (linkedSet.has(id) && !seen.has(id)) {
      seen.add(id);
      pool.push(id);
    }
  }
  const rest = [...linkedProgramIds].filter((id) => !seen.has(id)).sort((a, b) => a - b);
  for (const id of rest) {
    if (!seen.has(id)) {
      seen.add(id);
      pool.push(id);
    }
  }
  return pool;
}

/**
 * Replacement program rotation buckets session time into **slots**:
 * - **Exactly 2 session hours:** two slots (one per hour) so each hour can document a different selected program.
 * - **All other lengths:** one slot per **90 minutes** of session time; consecutive calendar hours in the same
 *   bucket share the same replacement program unless ABC Builder sets an explicit `replacementProgramId` for an hour.
 */
export function replacementProgramSlotIdForHour(sessionHours: number, hourIndex: number): number {
  if (sessionHours <= 0 || hourIndex < 0 || hourIndex >= sessionHours) {
    return 0;
  }
  if (sessionHours === 2) {
    return hourIndex;
  }
  return Math.floor((hourIndex * 60) / 90);
}

/** Number of replacement-program slots for `sessionHours` (see `replacementProgramSlotIdForHour`). */
export function replacementProgramSlotCount(sessionHours: number): number {
  if (sessionHours <= 0) {
    return 0;
  }
  if (sessionHours === 2) {
    return 2;
  }
  return Math.floor(((sessionHours - 1) * 60) / 90) + 1;
}

/** Calendar-hour indices (0 … sessionHours−1) that belong to `slotId` for replacement-program rotation. */
export function replacementProgramSlotHours(sessionHours: number, slotId: number): number[] {
  const out: number[] = [];
  for (let h = 0; h < sessionHours; h++) {
    if (replacementProgramSlotIdForHour(sessionHours, h) === slotId) {
      out.push(h);
    }
  }
  return out;
}

export type TherapistTrialSummaryForHourEntry = {
  totalTrials: number;
  successfulTrialNumbers: number[];
} | null;

/**
 * Collapse per-calendar-hour narrative inputs to one row per **replacement-program slot** (~90 minutes, except
 * 2-hour sessions = two hourly slots). OpenAI and compliance use the collapsed arrays; `sessionHours` stays the
 * billable duration for context elsewhere.
 */
export function collapseHourlyNoteNarrativeToSegments(params: {
  sessionHours: number;
  maladaptiveBehaviorForHour: string[];
  replacementProgramForHour: string[];
  rbtActionsOnlyOutcomeForHour: boolean[];
  activityAntecedentForHour: (string | null)[];
  languageMaladaptiveEpisodeForHour: boolean[];
  therapistTrialSummaryForReplacementHour: TherapistTrialSummaryForHourEntry[];
}): {
  narrativeSegmentCount: number;
  maladaptiveBehaviorForHour: string[];
  replacementProgramForHour: string[];
  rbtActionsOnlyOutcomeForHour: boolean[];
  activityAntecedentForHour: (string | null)[];
  languageMaladaptiveEpisodeForHour: boolean[];
  therapistTrialSummaryForReplacementHour: TherapistTrialSummaryForHourEntry[];
} {
  const H = params.sessionHours;
  const S = replacementProgramSlotCount(H);
  const firstHourInSlot = (s: number): number => {
    const xs = replacementProgramSlotHours(H, s);
    return xs.length > 0 ? xs[0]! : 0;
  };
  const firstNonNullActivityInSlot = (s: number): string | null => {
    for (const h of replacementProgramSlotHours(H, s)) {
      const a = params.activityAntecedentForHour[h];
      if (typeof a === "string" && a.length > 0) {
        return a;
      }
    }
    return null;
  };
  return {
    narrativeSegmentCount: S,
    maladaptiveBehaviorForHour: Array.from({ length: S }, (_, s) => params.maladaptiveBehaviorForHour[firstHourInSlot(s)]!),
    replacementProgramForHour: Array.from({ length: S }, (_, s) => params.replacementProgramForHour[firstHourInSlot(s)]!),
    rbtActionsOnlyOutcomeForHour: Array.from({ length: S }, (_, s) => params.rbtActionsOnlyOutcomeForHour[firstHourInSlot(s)]!),
    activityAntecedentForHour: Array.from({ length: S }, (_, s) => firstNonNullActivityInSlot(s)),
    languageMaladaptiveEpisodeForHour: Array.from({ length: S }, (_, s) =>
      replacementProgramSlotHours(H, s).some((h) => params.languageMaladaptiveEpisodeForHour[h]),
    ),
    therapistTrialSummaryForReplacementHour: Array.from({ length: S }, (_, s) => {
      const h0 = firstHourInSlot(s);
      return params.therapistTrialSummaryForReplacementHour[h0] ?? null;
    }),
  };
}

/**
 * Pool used to auto-fill hours that do not have an explicit `replacementProgramId` in ABC hints.
 *
 * - When **fewer** programs are selected than **replacement-program slots** for this session (see
 *   `replacementProgramSlotCount`), the pool is **selection order first**, then **other linked** program ids
 *   (ascending), so extra slots can draw from the rest of the client catalog.
 * - When the wizard selected **at least as many** programs as **slot count**, the pool is **only** those
 *   selections (order preserved, deduped). Assignment walks that pool in slot order for auto-filled hours (see
 *   `replacementProgramAssignmentsForSessionHours` + `sessionSelectionCoversHours`) so programs the user did not
 *   select are never introduced.
 */
export function replacementProgramPoolForAutoAssignment(
  selectedIdsOrdered: number[],
  linkedProgramIds: number[],
  sessionHours: number,
): number[] {
  if (sessionHours <= 0) {
    return [];
  }
  const slotNeed = replacementProgramSlotCount(sessionHours);
  if (selectedIdsOrdered.length < slotNeed) {
    return replacementProgramPoolOrdered(selectedIdsOrdered, linkedProgramIds);
  }
  return replacementProgramPoolOrdered(selectedIdsOrdered, selectedIdsOrdered);
}

/**
 * Per-hour replacement program **names** and RBT-only flags. Explicit `replacementProgramId` per hour wins when
 * present in `idToName`. Other hours share a program when they fall in the same **90-minute slot** (except a
 * **2-hour** session, which uses one program per hour). See `replacementProgramSlotIdForHour`.
 *
 * Pool comes from `replacementProgramPoolForAutoAssignment`: session-selected programs only when selection count ≥
 * replacement-program **slot** count; otherwise selected first then other linked ids. Avoids matching the **previous**
 * calendar hour's program name when `pool.length > 1` at slot boundaries.
 *
 * When `sessionSelectionCoversHours` is true (wizard selected at least as many programs as **slots**), each
 * auto-filled **slot** consumes the next id from the queue (all auto hours in that slot get the same program),
 * skipping ids already taken by explicit ABC rows—so each selected program is used at most once before any repeat.
 */
export function replacementProgramAssignmentsForSessionHours(params: {
  sessionHours: number;
  poolIds: number[];
  idToName: Map<number, string>;
  selectedIdSet: Set<number>;
  explicitProgramIdByHour: (number | null | undefined)[];
  /**
   * True when `selectedReplacements.length >= replacementProgramSlotCount(sessionHours)` (selection-only pool).
   * Auto-filled **slots** then take programs sequentially from the pool in wizard order, excluding explicit picks.
   */
  sessionSelectionCoversHours?: boolean | undefined;
}): {
  names: string[];
  rbtActionsOnly: boolean[];
  /** Program id assigned for hour h (for mapping therapist-entered trial metadata); null if unassigned. */
  programIdForHour: (number | null)[];
} {
  const { sessionHours, poolIds, idToName, selectedIdSet, explicitProgramIdByHour, sessionSelectionCoversHours } =
    params;
  const H = sessionHours;
  const names: string[] = Array.from({ length: H }, () => "");
  const rbt: boolean[] = Array.from({ length: H }, () => false);
  const programIdForHour: (number | null)[] = Array.from({ length: H }, () => null);

  for (let h = 0; h < H; h++) {
    const pid = explicitProgramIdByHour[h];
    if (typeof pid === "number" && idToName.has(pid)) {
      names[h] = idToName.get(pid)!;
      rbt[h] = !selectedIdSet.has(pid);
      programIdForHour[h] = pid;
    }
  }

  const pool = poolIds.filter((id) => idToName.has(id));
  if (pool.length === 0) {
    return { names, rbtActionsOnly: rbt, programIdForHour };
  }

  const usedByExplicit = new Set<number>();
  for (let h = 0; h < H; h++) {
    const pid = explicitProgramIdByHour[h];
    if (typeof pid === "number" && idToName.has(pid)) {
      usedByExplicit.add(pid);
    }
  }
  const queueForSequential =
    sessionSelectionCoversHours === true ? pool.filter((id) => !usedByExplicit.has(id)) : [];

  const slotIdForHour = (h: number) => replacementProgramSlotIdForHour(H, h);
  const slotsNeeding = new Set<number>();
  for (let h = 0; h < H; h++) {
    if (!names[h]) {
      slotsNeeding.add(slotIdForHour(h));
    }
  }
  const uniqueSlots = [...slotsNeeding].sort((a, b) => a - b);

  let autoSlot = 0;
  for (const slot of uniqueSlots) {
    const hoursToFill: number[] = [];
    for (let h = 0; h < H; h++) {
      if (names[h]) continue;
      if (slotIdForHour(h) !== slot) continue;
      hoursToFill.push(h);
    }
    if (hoursToFill.length === 0) {
      continue;
    }

    let pick: number;
    if (sessionSelectionCoversHours === true && queueForSequential.length > 0) {
      pick = queueForSequential.shift()!;
    } else {
      let pickIdx = autoSlot % pool.length;
      pick = pool[pickIdx]!;
      const prevH = hoursToFill[0]! - 1;
      if (prevH >= 0 && names[prevH] === idToName.get(pick) && pool.length > 1) {
        for (let k = 1; k < pool.length; k++) {
          const tryPick = pool[(pickIdx + k) % pool.length]!;
          if (idToName.get(tryPick) !== names[prevH]) {
            pick = tryPick;
            break;
          }
        }
      }
    }

    const label = idToName.get(pick)!;
    const rbtFlag = !selectedIdSet.has(pick);
    for (const h of hoursToFill) {
      names[h] = label;
      rbt[h] = rbtFlag;
      programIdForHour[h] = pick;
    }
    autoSlot++;
  }
  return { names, rbtActionsOnly: rbt, programIdForHour };
}

/**
 * True when the replacement program name is the common BIP line for ending activities
 * (e.g. Indicate 'All Done' to End an Activity). Matching is substring-based so minor catalog
 * punctuation variants still qualify.
 */
export function isIndicateAllDoneReplacementProgramName(name: string): boolean {
  const t = name.trim().toLowerCase();
  return t.includes("indicate") && t.includes("all done");
}

const TASK_REFUSAL_CATALOG = "Task Refusal";

/** Catalog maladaptive labels for off-task / inattention (escape or attention function). */
export function isOffTaskInattentionMaladaptiveBehavior(behaviorName: string): boolean {
  const b = behaviorName.trim().toLowerCase();
  return (
    /\boff[- ]?task\b/.test(b) ||
    /\binattention\b/.test(b) ||
    /\binattentive\b/.test(b) ||
    /\bdistract/.test(b)
  );
}

/** Replacement programs teaching safety stop/wait compliance—not primary targets for off-task/inattention. */
export function isSafetyStopWaitReplacementProgramName(name: string): boolean {
  const p = name.trim().toLowerCase();
  return (
    (/respond/.test(p) && /safety/.test(p)) ||
    (/safety/.test(p) && (/\bstop\b/.test(p) || /\bwait\b/.test(p))) ||
    (/\bstop\b/.test(p) && /\bwait\b/.test(p) && /instruction/.test(p))
  );
}

/** BIP map lookup with case-insensitive key fallback. */
function mappedReplacementsForBehaviorKey(
  behaviorName: string,
  map: Record<string, string[]>,
): string[] {
  const behavior = behaviorName.trim();
  if (!behavior) return [];
  let mapped = map[behavior];
  if (!mapped?.length) {
    const key = Object.keys(map).find((k) => k.toLowerCase() === behavior.toLowerCase());
    if (key) mapped = map[key];
  }
  return mapped?.map((s) => s.trim()).filter((s) => s.length > 0) ?? [];
}

function preferencePredicatesForBehaviorPattern(behaviorName: string): ((n: string) => boolean)[] {
  const b = behaviorName.toLowerCase();
  if (isOffTaskInattentionMaladaptiveBehavior(behaviorName)) {
    return [
      (n) => /^on task behavior$/i.test(n.trim()) || /\bon[- ]?task\b/i.test(n),
      (n) => /time on task/i.test(n),
      (n) => /eye contact|attend|attention/i.test(n),
      (n) => /visual schedule|3-element/i.test(n),
      (n) => /follow.*non-preferred|following non-preferred/i.test(n),
      (n) => /\bdra\b|\(dra\)/i.test(n),
      (n) => n.toLowerCase().includes("redirection"),
    ];
  }
  if (
    b.includes("verbal aggression") ||
    b.includes("inappropriate language") ||
    b.includes("inappropriate remark")
  ) {
    return [
      (n) => /functional communication|\bfct\b/i.test(n),
      (n) => n.toLowerCase().includes("request help"),
      (n) => n.toLowerCase().includes("accepting no"),
      (n) => /follow.*non-preferred|following non-preferred/i.test(n),
      (n) => /\bdra\b|\(dra\)/i.test(n),
      (n) => n.toLowerCase().includes("redirection"),
    ];
  }
  if (/\belope/.test(b) || /\bwandering\b/.test(b) || /\bbolting\b/.test(b) || /\brunning\s+away\b/.test(b)) {
    return [
      (n) => /functional communication|\bfct\b/i.test(n),
      (n) => n.toLowerCase().includes("accepting no"),
      (n) => /visual schedule|3-element/i.test(n),
      (n) => /follow.*non-preferred|following non-preferred/i.test(n),
      (n) => /walk within close|close distance|safety skills/i.test(n),
    ];
  }
  if (
    /\bphysical\s+aggression\b/.test(b) ||
    /\bself[- ]?injurious\s+behavior\b/.test(b) ||
    /\bsib\b/.test(b) ||
    /\btantrum\b/.test(b) ||
    /\bproperty\s+destruction\b/.test(b)
  ) {
    return [
      (n) => /accept.*alternative|alternative.*redirect/i.test(n),
      (n) => /delay(?:s|ed)?\s+of\s+reinforcers?|delay.*reinforcer/i.test(n),
      (n) => /follow.*non-preferred|following non-preferred|follow.*demand/i.test(n),
      (n) => /functional communication|\bfct\b|request help/i.test(n),
      (n) => /\bdra\b|\(dra\)|\bdri\b|\(dri\)/i.test(n),
    ];
  }
  return [];
}

/**
 * Ordered BIP-aligned replacement program names for a maladaptive behavior (map first, then heuristics).
 */
export function behaviorReplacementCandidatesForMaladaptiveBehavior(
  behaviorName: string,
  behaviorToReplacementsMap: Record<string, string[]>,
  authorizedProgramNames: string[],
  behaviorFunctions?: import("@workspace/db/schema").ClinicalFunction[] | null,
): string[] {
  const authorized = [...new Set(authorizedProgramNames.map((s) => s.trim()).filter((s) => s.length > 0))];
  const primary = primaryFunctionForReplacementSelection(behaviorFunctions);
  const mapped = mappedReplacementsForBehaviorKey(behaviorName, behaviorToReplacementsMap);
  let mappedViable = mapped.filter(
    (p) =>
      authorized.includes(p) &&
      !isHardMisfitReplacementForMaladaptiveBehavior(behaviorName, p, behaviorFunctions),
  );
  if (mappedViable.length > 0) {
    if (primary) {
      const functionMatched = mappedViable.filter((p) =>
        replacementProgramMatchesFunctionCategory(p, primary),
      );
      if (functionMatched.length > 0) {
        return functionMatched;
      }
    }
    return mappedViable;
  }
  const preds: ((n: string) => boolean)[] = [];
  if (primary) {
    preds.push(...functionBasedReplacementPredicates(primary));
  }
  preds.push(...preferencePredicatesForBehaviorPattern(behaviorName));
  const ordered: string[] = [];
  for (const pred of preds) {
    for (const p of authorized) {
      if (
        pred(p) &&
        !isHardMisfitReplacementForMaladaptiveBehavior(behaviorName, p, behaviorFunctions) &&
        !ordered.includes(p)
      ) {
        ordered.push(p);
      }
    }
  }
  return ordered;
}

/**
 * Definitive function mismatches that override an incorrect BIP behavior→replacement map.
 */
function isHardMisfitReplacementForMaladaptiveBehavior(
  behaviorName: string,
  replacementProgramName: string,
  behaviorFunctions?: import("@workspace/db/schema").ClinicalFunction[] | null,
): boolean {
  const behavior = behaviorName.trim();
  const program = replacementProgramName.trim();
  if (!behavior || !program) return false;

  if (isFunctionMisfitReplacement(behavior, program, behaviorFunctions)) {
    return true;
  }

  if (isOffTaskInattentionMaladaptiveBehavior(behavior) && isSafetyStopWaitReplacementProgramName(program)) {
    return true;
  }
  if (
    isOffTaskInattentionMaladaptiveBehavior(behavior) &&
    /walk within close|close distance|safety skills?/i.test(program)
  ) {
    return true;
  }
  if (
    isSafetyLeaveAreaReplacementProgram(program) &&
    !isElopementSafetyNavigationBehavior(behavior)
  ) {
    return true;
  }
  return false;
}

/**
 * True when auto-assigned replacement program is a poor function match for the maladaptive behavior.
 */
export function isMisfitReplacementForMaladaptiveBehavior(
  behaviorName: string,
  replacementProgramName: string,
  behaviorToReplacementsMap: Record<string, string[]>,
  behaviorFunctions?: import("@workspace/db/schema").ClinicalFunction[] | null,
): boolean {
  const behavior = behaviorName.trim();
  const program = replacementProgramName.trim();
  if (!behavior || !program) return false;

  if (isHardMisfitReplacementForMaladaptiveBehavior(behavior, program, behaviorFunctions)) {
    return true;
  }

  const primary = primaryFunctionForReplacementSelection(behaviorFunctions);
  const mapped = mappedReplacementsForBehaviorKey(behavior, behaviorToReplacementsMap);
  if (primary && primary !== "automatic") {
    const functionAlignedMapped = mapped.filter(
      (p) =>
        replacementProgramMatchesFunctionCategory(p, primary) &&
        !isHardMisfitReplacementForMaladaptiveBehavior(behavior, p, behaviorFunctions),
    );
    if (functionAlignedMapped.length > 0) {
      return !functionAlignedMapped.includes(program);
    }
  }

  const mappedNonHard = mapped.filter(
    (p) => !isHardMisfitReplacementForMaladaptiveBehavior(behavior, p, behaviorFunctions),
  );
  if (mappedNonHard.length > 0) {
    return !mappedNonHard.includes(program);
  }

  if (primary && !replacementProgramMatchesFunctionCategory(program, primary)) {
    const hasFunctionMatch = Object.values(behaviorToReplacementsMap)
      .flat()
      .some((p) => replacementProgramMatchesFunctionCategory(p, primary));
    if (!hasFunctionMatch) {
      // No BIP map guidance — still flag if authorized list has function-aligned options and this isn't one
      return isFunctionMisfitReplacement(behavior, program, behaviorFunctions);
    }
    return true;
  }

  const b = behavior.toLowerCase();
  const p = program.toLowerCase();
  if (
    (b.includes("verbal aggression") ||
      b.includes("inappropriate language") ||
      b.includes("inappropriate remark")) &&
    /wait/.test(p) &&
    /transition/.test(p)
  ) {
    return true;
  }
  if (
    (/\belope/.test(b) || /\bwandering\b/.test(b) || /\bbolting\b/.test(b) || /\brunning\s+away\b/.test(b)) &&
    p === "on task behavior"
  ) {
    return true;
  }
  if (/\bphysical\s+aggression\b/.test(b) && /walk within close|close distance|safety skills?/i.test(p)) {
    return true;
  }
  return false;
}

/**
 * Per narrative segment: BIP-aligned replacement candidates for the assigned maladaptive behavior.
 */
export function buildBehaviorReplacementCandidatesForNarrativeSegments(params: {
  narrativeSegmentCount: number;
  maladaptiveBehaviorForHour: string[];
  acquisitionOnlySegmentForHour: boolean[];
  behaviorToReplacementsMap: Record<string, string[]>;
  authorizedProgramNames: string[];
  maladaptiveBehaviorFunctionsForHour?: (import("@workspace/db/schema").ClinicalFunction[] | null)[] | undefined;
}): string[][] {
  const result: string[][] = [];
  for (let s = 0; s < params.narrativeSegmentCount; s++) {
    if (params.acquisitionOnlySegmentForHour[s]) {
      result.push([]);
      continue;
    }
    const b = params.maladaptiveBehaviorForHour[s]?.trim() ?? "";
    if (!b) {
      result.push([]);
      continue;
    }
    result.push(
      behaviorReplacementCandidatesForMaladaptiveBehavior(
        b,
        params.behaviorToReplacementsMap,
        params.authorizedProgramNames,
        params.maladaptiveBehaviorFunctionsForHour?.[s],
      ),
    );
  }
  return result;
}

/**
 * Per narrative segment: function-aligned intervention names for the assigned maladaptive behavior.
 */
export function buildInterventionCandidatesForNarrativeSegments(params: {
  narrativeSegmentCount: number;
  maladaptiveBehaviorForHour: string[];
  acquisitionOnlySegmentForHour: boolean[];
  authorizedInterventions: string[];
  maladaptiveBehaviorFunctionsForHour?: (import("@workspace/db/schema").ClinicalFunction[] | null)[] | undefined;
}): string[][] {
  const result: string[][] = [];
  for (let s = 0; s < params.narrativeSegmentCount; s++) {
    if (params.acquisitionOnlySegmentForHour[s]) {
      result.push([]);
      continue;
    }
    const b = params.maladaptiveBehaviorForHour[s]?.trim() ?? "";
    if (!b) {
      result.push([]);
      continue;
    }
    result.push(
      preferredInterventionCandidatesForBehaviorFunction(
        params.authorizedInterventions,
        params.maladaptiveBehaviorFunctionsForHour?.[s],
        b,
      ),
    );
  }
  return result;
}

/**
 * Auto-assignment sometimes pairs a maladaptive behavior with a function-mismatched replacement program
 * (e.g. Verbal Aggression + Wait during Transitions, Elopement + On task Behavior). When the hour's
 * replacement was not explicitly pinned in ABC hints, swap to a BIP-mapped candidate from the pool.
 *
 * Returns human-readable swap summaries for optional warning lines.
 */
export function rebalanceBehaviorMappedReplacementProgramsHourly(params: {
  sessionHours: number;
  maladaptiveBehaviorForHour: string[];
  names: string[];
  rbtActionsOnlyOutcomeForHour: boolean[];
  programIdForHour: (number | null)[];
  explicitProgramIdByHour: (number | null | undefined)[];
  poolIds: number[];
  idToName: Map<number, string>;
  selectedIdSet: Set<number>;
  behaviorToReplacementsMap: Record<string, string[]>;
  authorizedProgramNames: string[];
  maladaptiveBehaviorFunctionsForHour?: (import("@workspace/db/schema").ClinicalFunction[] | null)[] | undefined;
}): string[] {
  const {
    sessionHours: H,
    maladaptiveBehaviorForHour: beh,
    names,
    rbtActionsOnlyOutcomeForHour: rbt,
    programIdForHour: pids,
    explicitProgramIdByHour: explicit,
    poolIds,
    idToName,
    selectedIdSet,
    behaviorToReplacementsMap,
    authorizedProgramNames,
    maladaptiveBehaviorFunctionsForHour: behaviorFunctions,
  } = params;

  const swapped: string[] = [];

  for (let h = 0; h < H; h++) {
    const behavior = beh[h]?.trim() ?? "";
    if (!behavior) continue;
    const currentName = names[h]?.trim() ?? "";
    if (!currentName) continue;
    if (typeof explicit[h] === "number") continue;
    const hourFunctions = behaviorFunctions?.[h];
    if (
      !isMisfitReplacementForMaladaptiveBehavior(
        behavior,
        currentName,
        behaviorToReplacementsMap,
        hourFunctions,
      )
    ) {
      continue;
    }

    const candidates = behaviorReplacementCandidatesForMaladaptiveBehavior(
      behavior,
      behaviorToReplacementsMap,
      authorizedProgramNames,
      hourFunctions,
    );

    const poolCandidates = poolIds.filter((id) => {
      const n = idToName.get(id)?.trim();
      if (!n || n === currentName) return false;
      if (isMisfitReplacementForMaladaptiveBehavior(behavior, n, behaviorToReplacementsMap, hourFunctions)) {
        return false;
      }
      if (candidates.length === 0) return true;
      if (candidates.includes(n)) return true;
      // When the BIP map only lists hard mismatches, allow heuristic-aligned pool programs.
      const mapped = mappedReplacementsForBehaviorKey(behavior, behaviorToReplacementsMap);
      const mappedViable = mapped.filter(
        (p) => !isHardMisfitReplacementForMaladaptiveBehavior(behavior, p, hourFunctions),
      );
      return mappedViable.length === 0;
    });
    if (poolCandidates.length === 0) continue;

    const sortedPool = [...poolCandidates].sort((a, b) => {
      const aSel = selectedIdSet.has(a) ? 0 : 1;
      const bSel = selectedIdSet.has(b) ? 0 : 1;
      return aSel - bSel;
    });

    let pick: number | undefined;
    for (const prefName of candidates) {
      const found = sortedPool.find((id) => idToName.get(id) === prefName);
      if (found !== undefined) {
        pick = found;
        break;
      }
    }
    if (pick === undefined) {
      pick = sortedPool[0];
    }

    const newName = idToName.get(pick)!;
    names[h] = newName;
    pids[h] = pick;
    rbt[h] = !selectedIdSet.has(pick);
    swapped.push(
      `Hour ${h + 1} (${behavior}): replacement program rebalanced from "${currentName}" to "${newName}" for BIP function alignment.`,
    );
  }

  return swapped;
}

/**
 * When the same replacement program is auto-assigned to hours with **different** maladaptive behaviors
 * and **different** documented functions, swap to a distinct BIP-aligned candidate when available.
 */
export function rebalanceDistinctReplacementProgramsByFunction(params: {
  sessionHours: number;
  maladaptiveBehaviorForHour: string[];
  names: string[];
  rbtActionsOnlyOutcomeForHour: boolean[];
  programIdForHour: (number | null)[];
  explicitProgramIdByHour: (number | null | undefined)[];
  poolIds: number[];
  idToName: Map<number, string>;
  selectedIdSet: Set<number>;
  behaviorToReplacementsMap: Record<string, string[]>;
  authorizedProgramNames: string[];
  maladaptiveBehaviorFunctionsForHour?: (import("@workspace/db/schema").ClinicalFunction[] | null)[] | undefined;
}): string[] {
  const {
    sessionHours: H,
    maladaptiveBehaviorForHour: beh,
    names,
    rbtActionsOnlyOutcomeForHour: rbt,
    programIdForHour: pids,
    explicitProgramIdByHour: explicit,
    poolIds,
    idToName,
    selectedIdSet,
    behaviorToReplacementsMap,
    authorizedProgramNames,
    maladaptiveBehaviorFunctionsForHour: behaviorFunctions,
  } = params;

  const swapped: string[] = [];

  for (let h = 0; h < H; h++) {
    if (typeof explicit[h] === "number") continue;
    const behavior = beh[h]?.trim() ?? "";
    const currentName = names[h]?.trim() ?? "";
    if (!behavior || !currentName) continue;
    const hourFunctions = behaviorFunctions?.[h];
    const primary = primaryFunctionForReplacementSelection(hourFunctions);
    if (!primary) continue;

    let conflict = false;
    for (let j = 0; j < H; j++) {
      if (j === h) continue;
      const otherName = names[j]?.trim() ?? "";
      if (otherName !== currentName) continue;
      const otherBehavior = beh[j]?.trim() ?? "";
      if (!otherBehavior || otherBehavior === behavior) continue;
      const otherPrimary = primaryFunctionForReplacementSelection(behaviorFunctions?.[j]);
      if (otherPrimary && otherPrimary !== primary) {
        conflict = true;
        break;
      }
    }
    if (!conflict) continue;

    const candidates = behaviorReplacementCandidatesForMaladaptiveBehavior(
      behavior,
      behaviorToReplacementsMap,
      authorizedProgramNames,
      hourFunctions,
    ).filter((n) => n !== currentName);

    const usedNames = new Set(
      names.map((n, idx) => (idx === h ? "" : n.trim())).filter((n) => n.length > 0),
    );

    const poolCandidates = poolIds.filter((id) => {
      const n = idToName.get(id)?.trim();
      if (!n || n === currentName || usedNames.has(n)) return false;
      if (isMisfitReplacementForMaladaptiveBehavior(behavior, n, behaviorToReplacementsMap, hourFunctions)) {
        return false;
      }
      if (candidates.length === 0) return true;
      return candidates.includes(n);
    });
    if (poolCandidates.length === 0) continue;

    let pick: number | undefined;
    for (const prefName of candidates) {
      if (usedNames.has(prefName)) continue;
      const found = poolCandidates.find((id) => idToName.get(id) === prefName);
      if (found !== undefined) {
        pick = found;
        break;
      }
    }
    if (pick === undefined) {
      pick = poolCandidates[0];
    }

    const newName = idToName.get(pick)!;
    names[h] = newName;
    pids[h] = pick;
    rbt[h] = !selectedIdSet.has(pick);
    swapped.push(
      `Hour ${h + 1} (${behavior}): replacement program rebalanced from "${currentName}" to "${newName}" so unrelated behaviors/functions do not share the same replacement program.`,
    );
  }

  return swapped;
}

/**
 * Auto-assignment sometimes pairs **Task Refusal** with **Indicate … All Done …**, which external
 * reviewers often flag when the episode is noncompliance with a **new instructional demand** (not
 * clearly "end this activity"). When that hour's replacement was **not** explicitly pinned in ABC
 * hints, swap to another linked program from the session pool when available (prefer transitioning,
 * request help, follow demands, time on task, then any other).
 *
 * Mutates `names`, `rbtActionsOnlyOutcomeForHour`, and `programIdForHour` in place for affected hours.
 */
export function rebalanceTaskRefusalReplacementProgramsHourly(params: {
  sessionHours: number;
  maladaptiveBehaviorForHour: string[];
  names: string[];
  rbtActionsOnlyOutcomeForHour: boolean[];
  programIdForHour: (number | null)[];
  explicitProgramIdByHour: (number | null | undefined)[];
  poolIds: number[];
  idToName: Map<number, string>;
  selectedIdSet: Set<number>;
}): void {
  const {
    sessionHours: H,
    maladaptiveBehaviorForHour: beh,
    names,
    rbtActionsOnlyOutcomeForHour: rbt,
    programIdForHour: pids,
    explicitProgramIdByHour: explicit,
    poolIds,
    idToName,
    selectedIdSet,
  } = params;

  const preferencePredicates: ((n: string) => boolean)[] = [
    (n) => {
      const t = n.toLowerCase();
      return t.includes("transitioning") && t.includes("preferred");
    },
    (n) => n.toLowerCase().includes("request help"),
    (n) => n.toLowerCase().includes("follow demands"),
    (n) => n.toLowerCase().includes("time on task"),
  ];

  for (let h = 0; h < H; h++) {
    if (beh[h]?.trim() !== TASK_REFUSAL_CATALOG) continue;
    if (!isIndicateAllDoneReplacementProgramName(names[h] ?? "")) continue;
    const pinned = explicit[h];
    if (typeof pinned === "number") continue;

    const currentName = names[h] ?? "";
    const candidates = poolIds.filter((id) => {
      const n = idToName.get(id)?.trim();
      if (!n || n === currentName) return false;
      if (!isIndicateAllDoneReplacementProgramName(n)) return true;
      return false;
    });
    if (candidates.length === 0) continue;

    let pick: number | undefined;
    for (const pred of preferencePredicates) {
      const found = candidates.find((id) => pred(idToName.get(id)!));
      if (found !== undefined) {
        pick = found;
        break;
      }
    }
    if (pick === undefined) {
      pick = candidates[0];
    }

    const newName = idToName.get(pick)!;
    names[h] = newName;
    pids[h] = pick;
    rbt[h] = !selectedIdSet.has(pick);
  }
}

/** Catalog label denotes physical aggression (person-directed); match is on the catalog string, not free text. */
function isPhysicalAggressionCatalogLabel(behaviorName: string): boolean {
  return /\baggression\b/i.test(behaviorName.trim());
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

  if (!new RegExp(`\\b${pStr}%\\b`, "i").test(paragraph)) return false;

  return new RegExp(
    `\\b${pStr}%\\s+of\\s+the\\s+time|` +
      `\\bsuccessful\\b[^.;]{0,160}?\\b${pStr}%|` +
      `\\b${pStr}%\\b[^.;]{0,160}?\\bsuccessful|` +
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
  const m = /\bthe client manifested\b/i.exec(paragraph);
  if (!m || m.index === undefined) return false;
  const after = paragraph.slice(m.index);
  const dot = after.indexOf(".");
  const sentence = dot >= 0 ? after.slice(0, dot + 1) : after.slice(0, 280);
  if (/\sby\s/i.test(sentence)) return false;
  return !/\b(?:said|turned|pushed|pulled|hit|kicked|grabbed|struck|scratched|ran|left|moved|screamed|cried|threw|leaned|shook|swatted|headbutt|bit|spat|eloped|bolted|wandered)\b/i.test(
    sentence,
  );
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

/** Catalog label with trailing parenthetical acronym, e.g. "... Behavior (DRI)". */
function catalogInterventionBaseWithoutParenthetical(full: string): string | null {
  const m = /^(.*)\s*\(([A-Za-z][A-Za-z0-9/-]*)\)\s*$/.exec(full.trim());
  if (!m) return null;
  const base = m[1]!.replace(/\s+/g, " ").trim();
  return base.length > 0 ? base : null;
}

function phraseMatchesAuthorizedIntervention(phrase: string, interventionCatalog: string[]): boolean {
  const p = phrase.trim().toLowerCase();
  if (!p) return false;
  return interventionCatalog.some((name) => {
    const n = name.trim().toLowerCase();
    return n === p || n.includes(p) || p.includes(n);
  });
}

/** Fix partial intervention labels (e.g. DRI without parenthetical) before validation. */
export function normalizeClinicalBodyInterventionLabels(body: string, interventionCatalog: string[]): string {
  let out = body;
  for (const full of interventionCatalog) {
    const base = catalogInterventionBaseWithoutParenthetical(full);
    if (!base || out.includes(full)) continue;
    const re = new RegExp(`((?:implemented|applied)\\s+)${escapeRegExp(base)}(\\s*\\.)`, "gi");
    out = out.replace(re, `$1${full}$2`);
  }
  return out;
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

/** Phrases in "Following this intervention" detail that reviewers treat as invented intervention names. */
const DEFAULT_UNAUTHORIZED_INTERVENTION_LIKE_PHRASES: RegExp[] = [
  /\bverbal praise contingent on each instance of task engagement\b/i,
  /\breinforced appropriate task engagement with verbal praise\b/i,
  /\breinforced appropriate task engagement\b/i,
  /\bredirected the client(?:'|’)s hands back to the worksheet\b/i,
  /\bredirected hands back to worksheet\b/i,
  /\bguided the client to place one marker at a time into the bin\b/i,
  /\bguided client to place one marker at a time into bin\b/i,
  /\bprovided verbal praise contingent on each completed step\b/i,
  /\bmodeled placing\b/i,
];

/**
 * Rewrite intervention-detail prose that external review misreads as catalog intervention names.
 */
export function normalizeClinicalBodyInterventionDetailPhrases(
  body: string,
  interventionCatalog: string[],
): string {
  const replacements: [RegExp, string][] = [
    [
      /\bverbal praise contingent on each instance of task engagement\b/gi,
      "brief praise after worksheet responses",
    ],
    [
      /\breinforced appropriate task engagement with verbal praise\b/gi,
      "delivered brief praise after worksheet responses",
    ],
    [
      /\breinforced appropriate task engagement\b/gi,
      "delivered reinforcement after worksheet responses",
    ],
    [
      /\bredirected the client(?:'|’)s hands back to the worksheet\b/gi,
      "pointed to the worksheet and re-presented the instruction",
    ],
    [
      /\bredirected hands back to worksheet\b/gi,
      "pointed to the worksheet and re-presented the instruction",
    ],
    [
      /\bguided the client to place one marker at a time into the bin\b/gi,
      "pointed to one marker and the bin while re-presenting the cleanup instruction",
    ],
    [
      /\bguided client to place one marker at a time into bin\b/gi,
      "pointed to one marker and the bin while re-presenting the cleanup instruction",
    ],
    [
      /\bprovided verbal praise contingent on each completed step\b/gi,
      "delivered brief praise after completed cleanup steps",
    ],
    [/\bmodeled placing\b/gi, "demonstrated placing"],
  ];

  let out = body;
  for (const [pat, substitute] of replacements) {
    const m = pat.exec(out);
    if (!m) continue;
    if (phraseMatchesAuthorizedIntervention(m[0], interventionCatalog)) {
      continue;
    }
    out = out.replace(pat, substitute);
  }
  return out;
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
    return `Interventions: do not use detail phrasing that resembles an unauthorized intervention name (found "${matched}"). After the single catalog naming sentence, describe RBT actions in plain prose only (e.g. delivered verbal praise, demonstrated placing an item)—do not title reinforcement or modeling with invented intervention-like labels.`;
  }

  const reinforcedWithPraise =
    /\breinforced\s+((?:[a-z]+\s+){1,6}?)\s+with\s+verbal\s+praise\b/gi;
  let rp: RegExpExecArray | null;
  while ((rp = reinforcedWithPraise.exec(paragraph)) !== null) {
    const label = rp[1]!.trim();
    if (label.length < 6) continue;
    if (phraseMatchesAuthorizedIntervention(label, interventionCatalog)) continue;
    if (phraseMatchesAuthorizedIntervention(`${label} with verbal praise`, interventionCatalog)) {
      continue;
    }
    return `Interventions: do not write "reinforced ${label} with verbal praise" as if it were a catalog intervention; use plain prose (e.g. delivered verbal praise contingent on …) after the one exact naming sentence for the catalog intervention.`;
  }

  return null;
}

/** Teaching phrases reviewers treat as unauthorized replacement program names (case-insensitive). */
const DEFAULT_UNAUTHORIZED_REPLACEMENT_LIKE_PHRASES: RegExp[] = [
  /\brequest a break\b/i,
  /\bfunctional phrase to request\b/i,
  /\btask engagement\b/i,
  /\bkeep both hands on the table\b/i,
  /\bhands[- ]down behavior\b/i,
  /\breinforced hands[- ]down\b/i,
  /\bhand placement maintained\b/i,
];

function phraseMatchesAuthorizedReplacementProgram(phrase: string, authorizedPrograms: string[]): boolean {
  const p = phrase.trim().toLowerCase();
  if (!p) return false;
  return authorizedPrograms.some((name) => {
    const n = name.trim().toLowerCase();
    return n === p || n.includes(p) || p.includes(n);
  });
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

export function normalizeClinicalBodyEscapedQuotes(body: string): string {
  return body.replace(/\\"/g, '"').replace(/\\'/g, "'");
}

/**
 * Rewrite common invented replacement-like teaching labels before validation.
 */
export function normalizeClinicalBodyReplacementLikePhrases(
  body: string,
  authorizedPrograms: string[],
): string {
  const replacements: [RegExp, string][] = [
    [/\btask engagement\b/gi, "worksheet responding"],
    [/\bkeep both hands on the table\b/gi, "place both hands flat on the table surface"],
    [/\bhands[- ]down behavior\b/gi, "appropriate hand placement at the table"],
    [/\breinforced hands[- ]down\b/gi, "reinforced appropriate hand placement"],
    [/\bhand placement maintained\b/gi, "appropriate hand placement was maintained"],
  ];

  let out = body;
  for (const [pat, substitute] of replacements) {
    const m = pat.exec(out);
    if (!m) continue;
    const matched = m[0];
    if (phraseMatchesAuthorizedReplacementProgram(matched, authorizedPrograms)) {
      continue;
    }
    out = out.replace(pat, substitute);
  }
  return out;
}

/** Expand bare "SIB" in manifested-behavior lines when the catalog uses the full label. */
export function normalizeClinicalBodyMaladaptiveBehaviorLabels(
  body: string,
  maladaptiveCatalog: string[],
): string {
  const catalogHasFullSib = maladaptiveCatalog.some((c) =>
    maladaptiveBehaviorLabelsEquivalent(c, MALADAPTIVE_BEHAVIOR_SIB_CANONICAL),
  );
  if (!catalogHasFullSib) return body;

  return body.replace(
    /\b((?:the client )?manifested)\s+SIB\b/gi,
    `$1 ${MALADAPTIVE_BEHAVIOR_SIB_CANONICAL}`,
  );
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

function findUnauthorizedQuotedReplacementProgramIssue(
  paragraph: string,
  assignedProgram: string,
  authorizedPrograms: string[],
): string | null {
  const authorized = new Set(authorizedPrograms.map((s) => s.trim()).filter(Boolean));
  const re = /replacement program\s+["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(paragraph)) !== null) {
    const quoted = m[1]!.trim();
    if (quoted !== assignedProgram.trim() && !authorized.has(quoted)) {
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

/**
 * Caregiver / family roles and anyone listed as present must not appear after the note's first sentence.
 */
export function validateCaregiverMentionRule(fullNote: string, presentPeople: string[]): string[] {
  const issues: string[] = [];
  const { first, rest } = splitFirstSentence(fullNote);
  if (!rest.trim()) {
    return issues;
  }

  if (CAREGIVER_LEXICON.test(rest)) {
    issues.push(
      "Caregiver/family role language appears after the first sentence; it must appear only in the opening sentence.",
    );
  }

  for (const name of presentPeople) {
    const n = name.trim();
    if (n.length < 2) continue;
    const re = new RegExp(`\\b${escapeRegExp(n)}\\b`, "i");
    if (re.test(rest)) {
      issues.push(
        `A listed present person ("${n}") appears after the first sentence; caregivers/present people must only appear in the first sentence.`,
      );
    }
  }

  return issues;
}

export function validateClinicalBodyCompliance(clinicalBody: string, ctx: NoteComplianceContext): string[] {
  const issues: string[] = [];
  const schoolSetting = isSchoolSettingLabel(ctx.therapySetting);

  if (/\\["']/.test(clinicalBody)) {
    issues.push(
      'Quotation marks: do not use backslash characters before quotes in the clinical body. Write plain straight double quotes only (for example Respond to safety instructions "Stop" or "wait", not \\"Stop\\").',
    );
  }

  let mentalHits = 0;
  for (const re of MENTAL_STATE_PATTERNS) {
    if (re.test(clinicalBody)) {
      issues.push(
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
      issues.push(
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
        issues.push(
          `Age-appropriate activities: narrative may describe tasks unsuitable for approximately ${ctx.clientAgeYears} years old; use toddler/early-childhood activities only when age is low.`,
        );
        break;
      }
    }
  }

  const paragraphs = clinicalBody
    .trim()
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (schoolSetting) {
    for (let i = 0; i < paragraphs.length; i++) {
      if (schoolParagraphHasRbtOwnedClassroomActivity(paragraphs[i]!)) {
        issues.push(
          `School setting activity ownership: paragraph ${i + 1} makes the RBT sound like they created, arranged, led, or presented the classroom lesson/activity. In school notes, the teacher should present classroom lessons/activities/materials, while the RBT supports the client and implements ABA programs, prompts, interventions, reinforcement, and data collection.`,
        );
        break;
      }
    }
  }

  const expectedParagraphs = ctx.narrativeSegmentCount ?? ctx.sessionHours;
  if (paragraphs.length !== expectedParagraphs) {
    issues.push(
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
          issues.push(
            `Toddler / limited verbal: for very young clients, minimize complex speech attributed to the client (e.g. avoid "the client said/stated/replied…"); use vocalizations, gestures, and observable actions instead.`,
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
      issues.push(
        `One program per ABC: paragraph ${i + 1} references more than one distinct replacement program name from the catalog; that segment must name only the assigned program and must not describe or cite a second program from the list.`,
      );
    }
    const assignedRp = replacementPerHour[i]?.trim() ?? "";
    if (assignedRp.length > 0 && !p.includes(assignedRp)) {
      issues.push(
        `Replacement program for paragraph ${i + 1}: include the assigned program exactly as given (character-for-character, including every "(" and ")"): "${assignedRp}".`,
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
        issues.push(
          `Replacement program function: paragraph ${i + 1} pairs "${assignedBeh}" with "${assignedRp}".${functionHint} The server rebalances auto-assignment when possible; align antecedent and teaching prose to the assigned program's function.`,
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
        issues.push(
          `Replacement program logic: paragraphs ${i + 1} (${behI}, ${fnI}) and ${j + 1} (${behJ}, ${fnJ}) share the same replacement program "${rpI}" but document different behavior functions. Use function-matched replacements from behaviorReplacementCandidatesForHour for each segment.`,
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
      issues.push(antecedentIssue);
      break;
    }
    const lockedActivity = activityLockedPerHour[i];
    if (typeof lockedActivity === "string" && lockedActivity.length > 0 && !p.includes(lockedActivity)) {
      issues.push(
        `ABC Builder: paragraph ${i + 1} must include the selected activity/antecedent string verbatim (character-for-character): "${lockedActivity.slice(0, 80)}${lockedActivity.length > 80 ? "…" : ""}".`,
      );
      break;
    }
    if (behaviorCatalog.length > 0) {
      const bCount = countCatalogBehaviorsInParagraph(p, behaviorCatalog);
      if (acquisitionOnly) {
        if (bCount > 0) {
          issues.push(
            `Skill-acquisition segment (paragraph ${i + 1}): do not cite any maladaptive behavior catalog label; this segment documents only the assigned skill-acquisition replacement program (no "manifested [maladaptive]" framing).`,
          );
          break;
        }
        const deficit = acquisitionOnlySkillDeficitFraming(p);
        if (deficit) {
          issues.push(
            `Skill-acquisition segment (paragraph ${i + 1}): remove deficit/nonperformance wording (${deficit}). Skill-acquisition programs such as Echoic, Respond to Own Name, and Improve eye contact are teaching targets, not maladaptive behaviors targeted for reduction. Describe RBT teaching opportunities, prompt levels, observed approximations/orienting responses, and the entered trial percentage without framing missed or inconsistent responses as problem behavior.`,
          );
          break;
        }
      } else if (bCount > 1) {
        issues.push(
          `One maladaptive behavior per ABC: paragraph ${i + 1} references more than one behavior name from the client catalog; use exactly one catalog behavior per narrative segment.`,
        );
        break;
      }
    }
    const assigned = assignedPerHour[i]?.trim();
    if (!acquisitionOnly && assigned && !p.includes(assigned)) {
      issues.push(
        `Maladaptive behavior rotation: paragraph ${i + 1} must cite the assigned catalog label "${assigned}" (maladaptiveBehaviorForHour[${i}]) verbatim in the manifested-behavior portion.`,
      );
      break;
    }
    if (!acquisitionOnly && assigned && /\bthe client manifested\b/i.test(p) && manifestedBehaviorLacksObservableTopography(p)) {
      issues.push(
        `Behavior topography: paragraph ${i + 1} must describe observable actions in the manifested-behavior sentence (e.g. "manifested ${assigned} by …" with specific body movements, vocalizations, or contact)—not the catalog label alone. Use maladaptiveBehaviorTopographyForHour[${i}] when provided.`,
      );
      break;
    }
    if (!acquisitionOnly && assigned) {
      const abbrev = findMaladaptiveBehaviorAbbreviationIssue(p, assigned, behaviorCatalog);
      if (abbrev) {
        issues.push(`Maladaptive behavior rotation: paragraph ${i + 1}: ${abbrev}`);
        break;
      }
      if (/physical\s+aggression/i.test(assigned) && physicalAggressionParagraphHasVerbalTopography(p)) {
        issues.push(
          `Physical Aggression topography: paragraph ${i + 1} must not include quoted speech, shouting, raised voice, or other verbal/vocal topography in the Physical Aggression episode. Use only person-directed physical contact/attempts such as hitting, kicking, pushing, scratching, pinching, headbutting, hair pulling, or throwing items at a person. If verbal aggression occurred, it requires a separate assigned verbal/language behavior paragraph; do not bundle it into Physical Aggression.`,
        );
        break;
      }
    }
    if (!acquisitionOnly && tantrumWithoutTopography(p)) {
      issues.push(
        `Tantrum topography: paragraph ${i + 1} mentions tantrum/meltdown without enough observable detail; describe what the client did (sounds, movements, materials) consistent with the assessment behavior definitions.`,
      );
      break;
    }
    if (!acquisitionOnly && assigned) {
      const storedTopography = ctx.maladaptiveBehaviorTopographyForHour?.[i]?.trim() ?? "";
      if (
        isElopementFamilyBehaviorLabel(assigned) &&
        elopementEpisodeLacksObservableTopography(p, assigned)
      ) {
        issues.push(
          `Elopement topography: paragraph ${i + 1} must describe observable leaving/boundary topography in the manifested-behavior sentence (e.g. ran toward exit/hallway, left the activity area without permission, moved beyond arm's reach)—not the catalog label alone. Use the client's stored BIP topography when provided in JSON maladaptiveBehaviorTopographyForHour[${i}].`,
        );
        break;
      }
      if (
        storedTopography.length > 0 &&
        !paragraphReflectsStoredTopography(p, storedTopography)
      ) {
        issues.push(
          `Behavior topography: paragraph ${i + 1} addresses "${assigned}" but does not reflect the client's stored operational definition (${storedTopography.slice(0, 120)}${storedTopography.length > 120 ? "…" : ""}). Include observable actions from that BIP/profile topography in the manifested-behavior sentence so each ABC matches the same definition used in prior notes for this behavior.`,
        );
        break;
      }
    }
  }

  const interventionCatalog = (ctx.interventions ?? []).map((s) => s.trim()).filter((s) => s.length > 0);
  if (interventionCatalog.length >= 2) {
    for (let i = 0; i < paragraphs.length; i++) {
      const joined = findJoinedInterventionPairPhrase(paragraphs[i]!, interventionCatalog);
      if (joined) {
        issues.push(
          `Interventions: paragraph ${i + 1} joins two catalog interventions (${joined.a} and ${joined.b}) in one phrase (comma or "and" between names). Do not combine two catalog names into one noun phrase; use exact JSON labels in separate naming sentences (each ending with a period after the name). For most ABC segments document **one** intervention only—only safety-priority segments with Response Block on the client's list may use multiple **separate** naming sentences (never a compound label).`,
        );
      }
    }
  }
  if (interventionCatalog.length >= 1) {
    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i]!;
      const commaAfter = firstInterventionWithCommaBeforeBy(p, interventionCatalog);
      if (commaAfter) {
        issues.push(
          `Interventions: paragraph ${i + 1}: remove the comma between "${commaAfter}" and "by" (do not use a "…, by …" clause attached to the catalog name). End the naming sentence after the exact catalog name with a period, then describe implementation in a new sentence.`,
        );
      }
      const quoted = firstQuotedCatalogIntervention(p, interventionCatalog);
      if (quoted) {
        issues.push(
          `Interventions: paragraph ${i + 1}: remove double quotes around "${quoted}"; write the catalog intervention as plain text matching JSON exactly, in its own sentence ending with a period after the name.`,
        );
      }
      const attachedBy = firstInterventionNameWithAttachedByClause(p, interventionCatalog);
      if (attachedBy) {
        issues.push(
          `Interventions: paragraph ${i + 1}: do not attach "by …" to "${attachedBy}" in the same sentence as implemented/applied. Use two sentences: (1) "The RBT implemented ${attachedBy}." or "To address this behavior, the RBT implemented ${attachedBy}." with the exact JSON string and a period immediately after the name; (2) a separate sentence describing what was done (for example beginning with "Following this intervention, …").`,
        );
      }
      const partial = findInterventionPartialMatchIssue(p, interventionCatalog);
      if (partial) {
        issues.push(`Interventions: paragraph ${i + 1}: ${partial}`);
      }
      const inventedIntervention = findInventedInterventionLikePhraseIssues(p, interventionCatalog);
      if (inventedIntervention) {
        issues.push(`Interventions: paragraph ${i + 1}: ${inventedIntervention}`);
      }
      const draDroCompound = compoundDraDroInterventionLabelIssue(p, i);
      if (draDroCompound) {
        issues.push(draDroCompound);
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
      issues.push(`Replacement programs: paragraph ${i + 1}: ${invented}`);
    }
    if (assigned) {
      const unauthorized = findUnauthorizedQuotedReplacementProgramIssue(p, assigned, replacementCatalog);
      if (unauthorized) {
        issues.push(`Replacement programs: paragraph ${i + 1}: ${unauthorized}`);
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
        issues.push(
          `Therapist trial counts: paragraph ${i + 1} must state discrete-trial outcomes as a **percentage** tied to that program (rounded from intake: **${pct}%** of trials met criterion / **~${pct}%** of the time / **successful ~${pct}%** of the time — same rounding as the end-of-note performance line). Do **not** use "${successN} out of ${trialEntry.totalTrials} trials were successful" or other N-of-M trial count rollups. Do not use "trials were conducted" plus separate per-trial success lists.`,
        );
      }
    }
    if (ctx.rbtActionsOnlyOutcomeForHour?.[i] !== true && unsupportedProgressComparison(p)) {
      issues.push(
        `Unsupported progress comparison: paragraph ${i + 1} compares current performance to recent/prior sessions, baseline, or treatment goals, but prior-session trajectory data is not part of the session context. Remove the comparison and state only current-session performance supported by the entered data.`,
      );
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
      issues.push(
        `Interventions: paragraph ${i + 1} must document **one** catalog intervention for this ABC segment (one naming sentence: "… implemented [exact JSON label]." or "… applied [exact JSON label]." with a period immediately after the name, then separate sentences for detail). Pick the single best-matching entry from JSON interventions unless the segment is a safety-priority behavior with a response-blocking label on the client's list (Self-Injurious Behavior (SIB), physical aggression, wandering, elopement, baiting, bolting, running away)—then that response-blocking label must be first with additional interventions in separate naming sentences.`,
      );
    }
    if (implCount === 0) {
      issues.push(
        `Interventions: paragraph ${i + 1} must document at least one catalog intervention using the exact JSON label in a naming sentence ending with a period right after the name (for example "The RBT implemented [exact label]." or "To address this behavior, the RBT implemented [exact label]."), then describe what was done in following sentences—do not put "by …" in the same sentence as the catalog name.`,
      );
    }
    if (implCount > 0) {
      const outcomeIssue = postInterventionOutcomeIssue(p, i);
      if (outcomeIssue) {
        issues.push(outcomeIssue);
      }
    }
    if (!acquisitionOnly && /\bthe client manifested\b/i.test(p)) {
      const reinforcementIssue = maladaptiveReinforcementContingencyIssue(p, i);
      if (reinforcementIssue) {
        issues.push(reinforcementIssue);
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
            issues.push(
              `SIB response blocking: paragraph ${i + 1} must use exact catalog spelling "${responseBlockLabel}" in the intervention naming sentence (for example "The RBT implemented ${responseBlockLabel}.").`,
            );
          } else {
            issues.push(
              `SIB response blocking: paragraph ${i + 1} addresses "${MALADAPTIVE_BEHAVIOR_SIB_CANONICAL}" but must name "${responseBlockLabel}" as the **first** catalog intervention after the manifested-behavior line—before DRA, DRI, Premack principle, Redirection, Environmental Manipulation, or any other approved intervention. Use "To address this behavior, the RBT implemented ${responseBlockLabel}." then describe blocking/protection in **Following this intervention,** and only then name any additional approved catalog intervention or replacement program.`,
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
              issues.push(
                `SIB attention function: paragraph ${i + 1} addresses "${MALADAPTIVE_BEHAVIOR_SIB_CANONICAL}" with documented attention function and Response Block first. Name "${draDriCandidates[0]}" (or another listed DRA/DRI label) as the **second** catalog intervention naming sentence after blocking is described—Attention independent response delivery alone does not target the attention-maintained contingency when DRA/DRI are on the approved list.`,
              );
            } else {
              issues.push(
                `Safety chain function match: paragraph ${i + 1} pairs "${assignedBehavior}" with "${responseBlockLabel}" only. Response Block is safety/support only—not primary treatment. Name "${sample}" as the **second** catalog intervention naming sentence after blocking is described.`,
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
              issues.push(
                `SIB attention function: paragraph ${i + 1} names "${secondNamed}" after Response Block, but DRA/DRI are on the approved intervention list for attention-maintained SIB. Use "${draDriCandidates[0]}" as the second catalog intervention naming sentence to reinforce an alternative/incompatible behavior.`,
              );
            }
          }
        }
      } else if (
        primaryFunction === "attention" &&
        attentionInterventions.length > 0 &&
        firstNamed &&
        isFunctionMisfitIntervention(firstNamed, segmentFunctions, interventionList)
      ) {
        issues.push(
          `SIB function match: paragraph ${i + 1} addresses "${MALADAPTIVE_BEHAVIOR_SIB_CANONICAL}" with documented attention function but names "${firstNamed}" as the catalog intervention. ${functionInterventionMismatchHint("attention", attentionInterventions)} Do not use Environmental Manipulation alone for attention-maintained SIB when attention-matched interventions are on the approved list.`,
        );
      } else if (
        sibEnvironmentalManipulationLabel &&
        firstNamed &&
        isNonBlockingFirstInterventionForSib(firstNamed) &&
        firstNamed !== sibEnvironmentalManipulationLabel
      ) {
        issues.push(
          `SIB safety: paragraph ${i + 1} addresses "${MALADAPTIVE_BEHAVIOR_SIB_CANONICAL}" but names "${firstNamed}" before immediate physical protection. Response Block/Response Blocking is not on the client's approved intervention list—add it to the BIP when possible. Until then, use "${sibEnvironmentalManipulationLabel}" as the first catalog intervention naming sentence for SIB (for example padding/removing hard surfaces or blocking access), then describe protective blocking in following plain prose before any DRA/Redirection/Premack naming sentence.`,
        );
      } else if (!sibEnvironmentalManipulationLabel && firstNamed && isNonBlockingFirstInterventionForSib(firstNamed)) {
        issues.push(
          `SIB safety: paragraph ${i + 1} addresses "${MALADAPTIVE_BEHAVIOR_SIB_CANONICAL}" but the client's approved intervention list does not include Response Block, Response Blocking, or Environmental Manipulation. Add Response Block/Response Blocking to the client BIP for SIB episodes; do not use "${firstNamed}" as the first named intervention without a documented response-blocking safety chain.`,
        );
      } else if (
        sibFunctionInterventionLabel &&
        firstNamed &&
        /^redirection$/i.test(firstNamed.trim())
      ) {
        issues.push(
          `SIB intervention coherence: paragraph ${i + 1} addresses "${MALADAPTIVE_BEHAVIOR_SIB_CANONICAL}" with Redirection even though "${sibFunctionInterventionLabel}" is on the client's approved intervention list. Use "${sibFunctionInterventionLabel}" only after response blocking is documented (Response Block/Response Blocking when listed, otherwise Environmental Manipulation when listed). Redirection alone does not address SIB safety.`,
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
        primaryFunction &&
        primaryFunction !== "automatic" &&
        !isSibMaladaptiveBehavior(assignedBehavior) &&
        !responseBlockIsFirst &&
        isFunctionMisfitIntervention(firstNamedIntervention, segmentFunctions, interventionList)
      ) {
        const candidates = preferredInterventionCandidatesForBehaviorFunction(
          interventionList,
          segmentFunctions,
          assignedBehavior,
        );
        issues.push(
          `Intervention function match: paragraph ${i + 1} pairs "${assignedBehavior}" with "${firstNamedIntervention}". ${functionInterventionMismatchHint(primaryFunction, candidates)} Use one exact catalog intervention from JSON \`interventionCandidatesForHour[${i}]\` when that array is non-empty.`,
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
          issues.push(
            `Safety chain function match: paragraph ${i + 1} pairs "${assignedBehavior}" with "${responseBlockLabel}" only. Response Block is safety/support only—not primary treatment. ${functionInterventionAfterSafetyChainHint(primaryFunction, checkCandidates)} Name "${sample}" as the **second** catalog intervention naming sentence after blocking is described.`,
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
            issues.push(
              `Attention function safety chain: paragraph ${i + 1} names "${secondNamed}" after Response Block, but DRA/DRI are on the approved list for attention-maintained "${assignedBehavior}". Use "${draDri[0] ?? "DRA/DRI"}" as the second catalog intervention naming sentence.`,
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
          issues.push(
            `Mandatory DRA: paragraph ${i + 1} documents attention-maintained "${assignedBehavior}" but does not name DRA/DRI from JSON interventions. Include ${draDriLabels[0] ?? "DRA/DRI"} as the catalog intervention naming sentence when listed.`,
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
          issues.push(
            `Safety chain function match: paragraph ${i + 1} documents "${responseBlockLabel}" only for "${assignedBehavior}". Response Block is safety/support only. Name "${sample}" as a **second** catalog intervention naming sentence after blocking is described.`,
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
          issues.push(
            `Physical Aggression intervention coherence: paragraph ${i + 1} must use exact catalog spelling "${responseBlockLabel}" when Response Block is the first intervention.`,
          );
        } else if (
          !hasFunctionMatchedInterventionAfterResponseBlock(p, responseBlockLabel, [
            demandEscapeInterventionLabel,
          ])
        ) {
          issues.push(
            `Physical Aggression intervention coherence: paragraph ${i + 1} describes physical aggression during a demand or guided task with Response Block/Response Blocking first. Also name "${demandEscapeInterventionLabel}" in a **second** catalog intervention naming sentence after blocking is described, then describe DRA/prompting/reinforcement only as plain follow-up detail if clinically appropriate and approved.`,
          );
        }
      } else if (firstNamed && firstNamed !== demandEscapeInterventionLabel) {
        issues.push(
          `Physical Aggression intervention coherence: paragraph ${i + 1} describes physical aggression during a demand or guided task and the approved intervention list includes "${demandEscapeInterventionLabel}". Use "${demandEscapeInterventionLabel}" as the exact catalog intervention naming sentence for this demand-escape episode, then describe DRA/prompting/reinforcement only as plain follow-up detail if clinically appropriate and approved.`,
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
        issues.push(
          `Safety-priority behavior (${assignedBehavior}): paragraph ${i + 1} must name "${responseBlockLabel}" as the first catalog intervention after the manifested-behavior line (before other listed interventions such as environmental manipulation), in its own naming sentence ending with a period after the exact label—for example "To address this behavior, the RBT implemented ${responseBlockLabel}."`,
        );
      }
    }
  }

  if (CAREGIVER_LEXICON.test(clinicalBody)) {
    issues.push(
      "Clinical body must not mention caregivers, parents, or guardians; the fixed opening already covers presence once.",
    );
  }

  if (PEER_OR_GROUP_ACTIVITY_LEXICON.test(clinicalBody)) {
    issues.push(
      "Clinical body must document only the RBT's one-to-one work with the client. Remove small-group, peer, classmate, children, kids, other-student, or group-play language; describe the materials/activity as arranged for the client only.",
    );
  }

  for (const name of ctx.presentPeople) {
    const n = name.trim();
    if (n.length < 2) continue;
    if (schoolSetting && isTeacherRole(n)) continue;
    const re = new RegExp(`\\b${escapeRegExp(n)}\\b`, "i");
    if (re.test(clinicalBody)) {
      issues.push(
        `Clinical body must not name present people (e.g. "${n}"); only the system opening sentence lists who was present.`,
      );
      break;
    }
  }

  return issues;
}

type Ymd = { y: number; mo: number; d: number };

/** Parse leading yyyy-MM-dd or MM/dd/yyyy (or M/d/yyyy). */
export function parseFlexibleYmd(s: string | undefined | null): Ymd | null {
  if (!s?.trim()) return null;
  const t = s.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    return Number.isFinite(y) && Number.isFinite(mo) && Number.isFinite(d) ? { y, mo, d } : null;
  }
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\b/.exec(t);
  if (m) {
    const mo = Number(m[1]);
    const d = Number(m[2]);
    const y = Number(m[3]);
    return Number.isFinite(y) && Number.isFinite(mo) && Number.isFinite(d) ? { y, mo, d } : null;
  }
  return null;
}

/** True when session date falls on a Sunday (US-style or ISO date strings). */
export function isSundaySessionDate(sessionDate: string | undefined | null): boolean {
  const ymd = parseFlexibleYmd(sessionDate);
  if (!ymd) return false;
  const dt = new Date(ymd.y, ymd.mo - 1, ymd.d);
  return dt.getDay() === 0;
}

/** Approximate whole years between DOB and session date (supports yyyy-MM-dd or MM/dd/yyyy). */
export function approximateAgeYearsAtSession(dateOfBirth: string | undefined | null, sessionDate: string): number | null {
  const dob = parseFlexibleYmd(dateOfBirth);
  const ses = parseFlexibleYmd(sessionDate);
  if (!dob || !ses) return null;
  const { y, mo, d } = dob;
  const { y: sy, mo: smo, d: sd } = ses;
  if ([y, mo, d, sy, smo, sd].some((n) => Number.isNaN(n))) return null;
  let age = sy - y;
  if (smo < mo || (smo === mo && sd < d)) {
    age--;
  }
  return age >= 0 && age < 120 ? age : null;
}
