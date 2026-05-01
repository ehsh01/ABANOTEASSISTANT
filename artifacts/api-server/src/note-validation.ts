/**
 * Post-generation compliance checks for session note clinical bodies and full notes.
 * Complements prompt rules in openai-notes.ts; does not replace clinical judgment by the RBT.
 */

export type NoteComplianceContext = {
  /** Billable session duration from the wizard (integer hours). */
  sessionHours: number;
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
  /** BIP intervention names (exact strings) — used for physical-aggression / Response Block ordering */
  interventions: string[];
  /**
   * Per narrative segment: therapist-entered discrete-trial rollup for `replacementProgramForHour[s]`.
   * When set, the clinical paragraph must state success counts as **N out of M trials were/was successful** (see validators).
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
  /\bappeared (upset|angry|frustrated|sad|anxious)\b/i,
  /\bseemed (upset|angry|frustrated|sad|anxious)\b/i,
  /\bwas upset because\b/i,
  /\binternal(ly)?\s+(upset|distressed|frustrated)\b/i,
  /\bmust have been\b/i,
  /\bprobably felt\b/i,
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

const CAREGIVER_LEXICON =
  /\b(caregiver|caregivers|parent|parents|guardian|guardians|mother|father|mom|dad|mommy|daddy|stepmother|stepfather)\b/i;

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

/** Canonical rotation order for common BIP maladaptive behavior names (exact spelling for substring match in assessment text). */
export const STANDARD_MALADAPTIVE_BEHAVIOR_ROTATION_ORDER: readonly string[] = [
  "Physical Aggression",
  "Task Refusal",
  "Property Destruction",
  "SIB",
  "Inappropriate Social Behavior",
  "Bolting",
  "Disruption",
] as const;

function dedupeMaladaptiveBehaviorOrder(catalog: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const raw of catalog) {
    const s = raw.trim();
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

  const head = STANDARD_MALADAPTIVE_BEHAVIOR_ROTATION_ORDER.filter((s) => profile.some((p) => p === s));
  const profileRemainder = profile.filter((p) => !head.includes(p));

  const labelsAddedFromAssessmentText: string[] = [];
  if (assessment.length > 0) {
    for (const s of STANDARD_MALADAPTIVE_BEHAVIOR_ROTATION_ORDER) {
      if (assessment.includes(s) && !profile.some((p) => p === s)) {
        labelsAddedFromAssessmentText.push(s);
      }
    }
  }

  const standardBlock = dedupeMaladaptiveBehaviorOrder([...head, ...labelsAddedFromAssessmentText]);

  const catalog = dedupeMaladaptiveBehaviorOrder([...standardBlock, ...profileRemainder]);

  const labelsOmittedNotFoundInAssessment =
    assessment.length > 0 && catalog.length > 0
      ? catalog.filter((c) => !assessment.includes(c))
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

/** Catalog label denotes physical aggression (person-directed); match is on the catalog string, not free text. */
function isPhysicalAggressionCatalogLabel(behaviorName: string): boolean {
  return /\bphysical\s+aggression\b/i.test(behaviorName.trim());
}

/**
 * Assigned maladaptive labels where, if **Response Block** is on the client's intervention list, the narrative may
 * document Response Block first and then **additional** separate intervention sentences (safety chain).
 */
function assignedBehaviorAllowsResponseBlockSafetyChain(behaviorName: string): boolean {
  const t = behaviorName.trim();
  if (isPhysicalAggressionCatalogLabel(t)) return true;
  const u = t.toLowerCase();
  return (
    /\bwandering\b/.test(u) ||
    /\belope/.test(u) ||
    /\bbaiting\b/.test(u) ||
    /\bbolting\b/.test(u) ||
    /\brunning\s+away\b/.test(u)
  );
}

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

function therapistTrialRollupPhrasePresent(
  paragraph: string,
  successfulTrialCount: number,
  totalTrials: number,
): boolean {
  const n = successfulTrialCount;
  const m = totalTrials;
  if (!Number.isFinite(n) || !Number.isFinite(m) || m < 1 || n < 0) return false;
  const wasWere = n === 1 ? "(?:was|were)" : "were";
  const outOf = new RegExp(`\\b${n}\\s+out\\s+of\\s+${m}\\s+trials?\\s+${wasWere}\\s+successful\\b`, "i");
  const ofOnly = new RegExp(`\\b${n}\\s+of\\s+${m}\\s+trials?\\s+${wasWere}\\s+successful\\b`, "i");
  return outOf.test(paragraph) || ofOnly.test(paragraph);
}

/** Exact intervention string from the client's list when it is the canonical Response Block label. */
function findResponseBlockInterventionLabel(interventions: string[]): string | null {
  for (const raw of interventions) {
    const s = raw.trim();
    if (s.length > 0 && /^response block$/i.test(s)) {
      return s;
    }
  }
  return null;
}

/** Smallest index in `text` among catalog intervention names that appear; longest names first to reduce substring ambiguity. */
function firstInterventionMentionInText(text: string, interventionNames: string[]): string | null {
  const names = [...new Set(interventionNames.map((s) => s.trim()).filter((s) => s.length > 0))].sort(
    (a, b) => b.length - a.length,
  );
  let bestIdx = Infinity;
  let bestName: string | null = null;
  for (const n of names) {
    const idx = text.indexOf(n);
    if (idx !== -1 && idx < bestIdx) {
      bestIdx = idx;
      bestName = n;
    }
  }
  return bestName;
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
  }

  const assignedPerHour = ctx.maladaptiveBehaviorForHour ?? [];
  const activityLockedPerHour = ctx.activityAntecedentForHour ?? [];

  const acquisitionFlags = ctx.acquisitionOnlySegmentForHour ?? [];

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i]!;
    const acquisitionOnly = acquisitionFlags[i] === true;
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
    if (!acquisitionOnly && tantrumWithoutTopography(p)) {
      issues.push(
        `Tantrum topography: paragraph ${i + 1} mentions tantrum/meltdown without enough observable detail; describe what the client did (sounds, movements, materials) consistent with the assessment behavior definitions.`,
      );
      break;
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
    }
  }

  const trialSummaries = ctx.therapistTrialSummaryForReplacementHour;
  const responseBlockLabel = findResponseBlockInterventionLabel(ctx.interventions ?? []);
  const interventionList = ctx.interventions ?? [];

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i]!;
    const acquisitionOnly = acquisitionFlags[i] === true;
    const assignedBehavior = acquisitionOnly ? "" : (assignedPerHour[i]?.trim() ?? "");
    const trialEntry = trialSummaries?.[i];
    if (trialEntry && trialEntry.totalTrials >= 1) {
      const successN = trialEntry.successfulTrialNumbers.length;
      if (!therapistTrialRollupPhrasePresent(p, successN, trialEntry.totalTrials)) {
        issues.push(
          `Therapist trial counts: paragraph ${i + 1} must state discrete-trial outcomes as "${successN} out of ${trialEntry.totalTrials} trials were successful" (use "was" instead of "were" when ${successN} is 1 if you prefer standard agreement). Do not use "trials were conducted" plus separate "trial … was successful" / "trials … and … were successful" wording.`,
        );
      }
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
        `Interventions: paragraph ${i + 1} must document **one** catalog intervention for this ABC segment (one naming sentence: "… implemented [exact JSON label]." or "… applied [exact JSON label]." with a period immediately after the name, then separate sentences for detail). Pick the single best-matching entry from JSON interventions unless the segment is a safety-priority behavior with Response Block on the client's list (physical aggression, wandering, elopement, baiting, bolting, running away)—then Response Block may be first with additional interventions in separate naming sentences.`,
      );
    }
    if (implCount === 0) {
      issues.push(
        `Interventions: paragraph ${i + 1} must document at least one catalog intervention using the exact JSON label in a naming sentence ending with a period right after the name (for example "The RBT implemented [exact label]." or "To address this behavior, the RBT implemented [exact label]."), then describe what was done in following sentences—do not put "by …" in the same sentence as the catalog name.`,
      );
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
      const m = /\bto address this behavior\b|\bto address these behaviors\b/i.exec(p);
      if (!m || m.index === undefined) {
        issues.push(
          `Safety-priority behavior (${assignedBehavior}): paragraph ${i + 1} must use "To address this behavior" or "To address these behaviors" before the first consequence intervention when Response Block is on the client's intervention list.`,
        );
        continue;
      }
      const tail = p.slice(m.index);
      const firstNamed = firstInterventionMentionInText(tail, interventionList);
      if (firstNamed !== responseBlockLabel) {
        issues.push(
          `Safety-priority behavior (${assignedBehavior}): paragraph ${i + 1} must name "${responseBlockLabel}" as the first catalog intervention after "To address this behavior" (before other listed interventions such as environmental manipulation), in its own naming sentence ending with a period after the exact label.`,
        );
      }
    }
  }

  if (CAREGIVER_LEXICON.test(clinicalBody)) {
    issues.push(
      "Clinical body must not mention caregivers, parents, or guardians; the fixed opening already covers presence once.",
    );
  }

  for (const name of ctx.presentPeople) {
    const n = name.trim();
    if (n.length < 2) continue;
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
function parseFlexibleYmd(s: string | undefined | null): Ymd | null {
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
