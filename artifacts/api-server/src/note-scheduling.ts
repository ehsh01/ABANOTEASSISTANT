/**
 * Note scheduling & rotation: maladaptive-behavior rotation catalogs, per-hour behavior and
 * replacement-program assignment (90-minute slots), narrative-segment collapsing, BIP-aligned
 * candidate building, rebalancing passes, and session-date helpers.
 *
 * Extracted from note-validation.ts (which re-exports everything here for import stability).
 */
import { preferredInterventionCandidatesForBehaviorFunction } from "./behavior-function-intervention-mapping";
import {
  functionBasedReplacementPredicates,
  isElopementSafetyNavigationBehavior,
  isFunctionMisfitReplacement,
  isSafetyLeaveAreaReplacementProgram,
  primaryFunctionForReplacementSelection,
  replacementProgramMatchesFunctionCategory,
} from "./behavior-function-replacement-mapping";

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
export function isHardMisfitReplacementForMaladaptiveBehavior(
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
  /** When true, swap even explicit ABC pins if the current program is a hard function mismatch. */
  overrideExplicitOnHardMisfit?: boolean;
  slotLabel?: string;
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
    overrideExplicitOnHardMisfit = false,
    slotLabel = "Hour",
  } = params;

  const swapped: string[] = [];

  for (let h = 0; h < H; h++) {
    const behavior = beh[h]?.trim() ?? "";
    if (!behavior) continue;
    const currentName = names[h]?.trim() ?? "";
    if (!currentName) continue;
    const hourFunctions = behaviorFunctions?.[h];
    if (typeof explicit[h] === "number") {
      const hardMisfit =
        overrideExplicitOnHardMisfit &&
        isHardMisfitReplacementForMaladaptiveBehavior(behavior, currentName, hourFunctions);
      if (!hardMisfit) continue;
    }
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
      `${slotLabel} ${h + 1} (${behavior}): replacement program rebalanced from "${currentName}" to "${newName}" for BIP function alignment.`,
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
  overrideExplicitOnHardMisfit?: boolean;
  slotLabel?: string;
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
    overrideExplicitOnHardMisfit = false,
    slotLabel = "Hour",
  } = params;

  const swapped: string[] = [];

  for (let h = 0; h < H; h++) {
    const behavior = beh[h]?.trim() ?? "";
    const currentName = names[h]?.trim() ?? "";
    if (!behavior || !currentName) continue;
    const hourFunctions = behaviorFunctions?.[h];
    if (typeof explicit[h] === "number") {
      const hardMisfit =
        overrideExplicitOnHardMisfit &&
        isHardMisfitReplacementForMaladaptiveBehavior(behavior, currentName, hourFunctions);
      if (!hardMisfit) continue;
    }
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
      `${slotLabel} ${h + 1} (${behavior}): replacement program rebalanced from "${currentName}" to "${newName}" so unrelated behaviors/functions do not share the same replacement program.`,
    );
  }

  return swapped;
}

/** Best BIP/function-aligned replacement program name for a behavior when auto-assignment misfires. */
export function pickBestReplacementProgramForBehavior(
  behavior: string,
  behaviorToReplacementsMap: Record<string, string[]>,
  authorizedProgramNames: string[],
  behaviorFunctions?: import("@workspace/db/schema").ClinicalFunction[] | null,
  excludeNames?: ReadonlySet<string>,
): string | null {
  const candidates = behaviorReplacementCandidatesForMaladaptiveBehavior(
    behavior,
    behaviorToReplacementsMap,
    authorizedProgramNames,
    behaviorFunctions,
  );
  for (const c of candidates) {
    if (!excludeNames?.has(c)) return c;
  }
  const primary = primaryFunctionForReplacementSelection(behaviorFunctions);
  if (primary) {
    for (const p of authorizedProgramNames) {
      if (excludeNames?.has(p)) continue;
      if (
        replacementProgramMatchesFunctionCategory(p, primary) &&
        !isHardMisfitReplacementForMaladaptiveBehavior(behavior, p, behaviorFunctions)
      ) {
        return p;
      }
    }
  }
  for (const p of authorizedProgramNames) {
    if (excludeNames?.has(p)) continue;
    if (!isHardMisfitReplacementForMaladaptiveBehavior(behavior, p, behaviorFunctions)) {
      return p;
    }
  }
  return null;
}

function resolveReplacementProgramIdByName(
  name: string,
  idToName: Map<number, string>,
): number | null {
  const trimmed = name.trim();
  for (const [id, n] of idToName) {
    if (n.trim() === trimmed) return id;
  }
  return null;
}

/**
 * Rebalance replacement programs per narrative segment using the **full client catalog** pool,
 * override explicit ABC pins when they are hard function mismatches, and apply a final fallback
 * picker so assignments always align before note generation.
 */
export function ensureReplacementProgramAlignmentForSegments(params: {
  segmentCount: number;
  maladaptiveBehaviorForHour: string[];
  names: string[];
  rbtActionsOnlyOutcomeForHour: boolean[];
  programIdForHour: (number | null)[];
  explicitProgramIdByHour: (number | null | undefined)[];
  rebalancePoolIds: number[];
  idToName: Map<number, string>;
  selectedIdSet: Set<number>;
  behaviorToReplacementsMap: Record<string, string[]>;
  authorizedProgramNames: string[];
  maladaptiveBehaviorFunctionsForHour?: (import("@workspace/db/schema").ClinicalFunction[] | null)[] | undefined;
  overrideExplicitOnHardMisfit?: boolean;
  slotLabel?: string;
}): string[] {
  const {
    segmentCount: S,
    maladaptiveBehaviorForHour: beh,
    names,
    rbtActionsOnlyOutcomeForHour: rbt,
    programIdForHour: pids,
    explicitProgramIdByHour: explicit,
    rebalancePoolIds,
    idToName,
    selectedIdSet,
    behaviorToReplacementsMap,
    authorizedProgramNames,
    maladaptiveBehaviorFunctionsForHour: behaviorFunctions,
    overrideExplicitOnHardMisfit = true,
    slotLabel = "Segment",
  } = params;

  const swapped: string[] = [];
  swapped.push(
    ...rebalanceBehaviorMappedReplacementProgramsHourly({
      sessionHours: S,
      maladaptiveBehaviorForHour: beh,
      names,
      rbtActionsOnlyOutcomeForHour: rbt,
      programIdForHour: pids,
      explicitProgramIdByHour: explicit,
      poolIds: rebalancePoolIds,
      idToName,
      selectedIdSet,
      behaviorToReplacementsMap,
      authorizedProgramNames,
      maladaptiveBehaviorFunctionsForHour: behaviorFunctions,
      overrideExplicitOnHardMisfit,
      slotLabel,
    }),
  );
  swapped.push(
    ...rebalanceDistinctReplacementProgramsByFunction({
      sessionHours: S,
      maladaptiveBehaviorForHour: beh,
      names,
      rbtActionsOnlyOutcomeForHour: rbt,
      programIdForHour: pids,
      explicitProgramIdByHour: explicit,
      poolIds: rebalancePoolIds,
      idToName,
      selectedIdSet,
      behaviorToReplacementsMap,
      authorizedProgramNames,
      maladaptiveBehaviorFunctionsForHour: behaviorFunctions,
      overrideExplicitOnHardMisfit,
      slotLabel,
    }),
  );

  for (let s = 0; s < S; s++) {
    const behavior = beh[s]?.trim() ?? "";
    const currentName = names[s]?.trim() ?? "";
    if (!behavior || !currentName) continue;
    const hourFunctions = behaviorFunctions?.[s];
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
    const usedNames = new Set(
      names.map((n, idx) => (idx === s ? "" : n.trim())).filter((n) => n.length > 0),
    );
    const fallback = pickBestReplacementProgramForBehavior(
      behavior,
      behaviorToReplacementsMap,
      authorizedProgramNames,
      hourFunctions,
      usedNames,
    );
    if (!fallback || fallback === currentName) continue;
    const pid = resolveReplacementProgramIdByName(fallback, idToName);
    names[s] = fallback;
    if (pid !== null) {
      pids[s] = pid;
      rbt[s] = !selectedIdSet.has(pid);
    }
    swapped.push(
      `${slotLabel} ${s + 1} (${behavior}): replacement program auto-corrected from "${currentName}" to "${fallback}" for BIP function alignment.`,
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
