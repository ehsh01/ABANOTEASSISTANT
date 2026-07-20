/**
 * Note scheduling & rotation: maladaptive-behavior rotation catalogs, per-hour behavior and
 * replacement-program assignment (one slot per billable hour), narrative-segment preparation, BIP-aligned
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
  /**
   * Standard-order names found in the assessment text but not on the client profile.
   * These are **not** used in the note (the app profile is authoritative); they are surfaced only
   * as a warning so the RBT can add them to the client profile if they want them included.
   */
  labelsAddedFromAssessmentText: string[];
  /**
   * Catalog labels whose exact text does not appear verbatim in the stored assessment snapshot (OCR/wording drift).
   * They remain in rotation when listed on the client profile; the RBT should verify BIP wording if this is non-empty.
   */
  labelsOmittedNotFoundInAssessment: string[];
};

/**
 * Build the maladaptive-behavior rotation list.
 *
 * **The client app profile is authoritative.** The rotation catalog contains ONLY behaviors the RBT
 * added to the client profile:
 * - Order profile entries using STANDARD_MALADAPTIVE_BEHAVIOR_ROTATION_ORDER when names match exactly.
 * - Append other profile labels (custom BIP wording) after that block.
 * - **All profile-listed behaviors stay in the catalog** even when the PDF snapshot does not contain that exact substring
 *   (common with OCR, line breaks, or alternate wording).
 *
 * Behaviors that appear in the assessment PDF text but were **not** added to the profile are reported in
 * `labelsAddedFromAssessmentText` for a caller warning but are **never** added to the catalog — the note
 * uses only what is on the app. (Historically these were auto-added to the rotation; that leaked
 * assessment-only behaviors into notes, so it was removed.)
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

  // Informational only: standard behavior names present in the assessment text but not on the profile.
  // These are surfaced as a warning so the RBT can add them to the app if desired; they are NOT used.
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

  // App-authoritative catalog: profile behaviors only (ordered), never assessment-only labels.
  const catalog = dedupeMaladaptiveBehaviorOrder([...head, ...profileRemainder]);

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

/**
 * Deterministic rotation seed for a session. The SAME inputs must always produce the SAME seed so a
 * re-generate reproduces the same behavior/hour order (no per-request randomness). Program ids are
 * sorted so selection order does not change the seed.
 */
export function deterministicRotationSeed(params: {
  clientId: number;
  sessionDate: string;
  sessionHours: number;
  selectedReplacements: number[];
}): string {
  return [
    `client:${params.clientId}`,
    `date:${params.sessionDate}`,
    `hours:${params.sessionHours}`,
    `programs:${[...params.selectedReplacements].sort((a, b) => a - b).join(",")}`,
  ].join("|");
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
 * Replacement program rotation uses exactly one slot per billable session hour.
 */
export function replacementProgramSlotIdForHour(sessionHours: number, hourIndex: number): number {
  if (sessionHours <= 0 || hourIndex < 0 || hourIndex >= sessionHours) {
    return 0;
  }
  return hourIndex;
}

/** Number of replacement-program slots for `sessionHours` (see `replacementProgramSlotIdForHour`). */
export function replacementProgramSlotCount(sessionHours: number): number {
  if (sessionHours <= 0) {
    return 0;
  }
  return sessionHours;
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
 * Prepare one complete narrative segment per billable session hour. Arrays are copied so later
 * segment-level rebalancing cannot mutate the original hourly intake assignments.
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
  const S = params.sessionHours;
  return {
    narrativeSegmentCount: S,
    maladaptiveBehaviorForHour: params.maladaptiveBehaviorForHour.slice(0, S),
    replacementProgramForHour: params.replacementProgramForHour.slice(0, S),
    rbtActionsOnlyOutcomeForHour: params.rbtActionsOnlyOutcomeForHour.slice(0, S),
    activityAntecedentForHour: params.activityAntecedentForHour.slice(0, S),
    languageMaladaptiveEpisodeForHour: params.languageMaladaptiveEpisodeForHour.slice(0, S),
    therapistTrialSummaryForReplacementHour:
      params.therapistTrialSummaryForReplacementHour.slice(0, S),
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
 * present in `idToName`. Every billable hour has its own assignment slot.
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

/**
 * Normalize a replacement/intervention program name for equivalence comparison only.
 *
 * BIP-extracted `behavior_to_replacements_map` values frequently differ from the assigned/authorized
 * catalog strings by **casing** (e.g. "Request for Break" vs "Request for break") and by **quote glyph**
 * (curly “No” vs straight 'No'). Those are the same clinical program, so misfit/candidate matching must
 * compare on a normalized key. This is used for comparison ONLY — never for the assembled prose, which
 * must still contain the exact assigned program string.
 */
export function normalizeReplacementProgramKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B\u201C\u201D\u201E\u201F'"`]/g, "'")
    .replace(/\s+/g, " ");
}

/** True when `name` matches any entry in `list` under normalized (case/quote-insensitive) comparison. */
export function replacementProgramListIncludes(list: string[], name: string): boolean {
  const key = normalizeReplacementProgramKey(name);
  if (!key) return false;
  return list.some((p) => normalizeReplacementProgramKey(p) === key);
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
      // Prefer proximity/safety skills over generic task-engagement programs for wandering/elopement.
      (n) => /walk within close|close distance|safety skills/i.test(n),
      (n) => /functional communication|\bfct\b/i.test(n),
      (n) => n.toLowerCase().includes("accepting no"),
      (n) => /visual schedule|3-element/i.test(n),
      (n) => /follow.*non-preferred|following non-preferred/i.test(n),
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
  // Resolve each mapped program (BIP spelling: may differ in case/quote glyph) to its authorized
  // catalog spelling so downstream assignment uses a real catalog string that resolves to a program id
  // and matches the assembled prose verbatim.
  const canonicalizeToAuthorized = (p: string): string | null => {
    const key = normalizeReplacementProgramKey(p);
    return authorized.find((a) => normalizeReplacementProgramKey(a) === key) ?? null;
  };
  let mappedViable = mapped
    .map(canonicalizeToAuthorized)
    .filter((p): p is string => p !== null)
    .filter((p) => !isHardMisfitReplacementForMaladaptiveBehavior(behaviorName, p, behaviorFunctions));
  mappedViable = [...new Set(mappedViable)];
  const preferProximityForWandering =
    /\belope/.test(behaviorName.toLowerCase()) ||
    /\bwandering\b/.test(behaviorName.toLowerCase()) ||
    /\bbolting\b/.test(behaviorName.toLowerCase()) ||
    /\brunning\s+away\b/.test(behaviorName.toLowerCase());
  const rankWanderingProgram = (n: string) =>
    /walk within close|close distance|safety skills/i.test(n)
      ? 0
      : /time on task|^on[- ]?task/i.test(n)
        ? 2
        : 1;
  if (mappedViable.length > 0) {
    // For wandering/elopement, prefer proximity/safety skills over time-on-task even when both are mapped.
    if (preferProximityForWandering) {
      mappedViable.sort((a, b) => rankWanderingProgram(a) - rankWanderingProgram(b));
    }
    if (primary) {
      const functionMatched = mappedViable.filter((p) =>
        replacementProgramMatchesFunctionCategory(p, primary),
      );
      if (functionMatched.length > 0) {
        if (preferProximityForWandering) {
          functionMatched.sort((a, b) => rankWanderingProgram(a) - rankWanderingProgram(b));
        }
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
/**
 * Genuine SAFETY-only replacement misfits (independent of function-category alignment). These are the
 * pairings we block even when the BIP maps them, because they create a safety problem (e.g. a
 * "leave the area" program for a non-elopement behavior).
 */
export function isSafetyHardMisfitReplacementForMaladaptiveBehavior(
  behaviorName: string,
  replacementProgramName: string,
): boolean {
  const behavior = behaviorName.trim();
  const program = replacementProgramName.trim();
  if (!behavior || !program) return false;

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

  return isSafetyHardMisfitReplacementForMaladaptiveBehavior(behavior, program);
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

  const primary = primaryFunctionForReplacementSelection(behaviorFunctions);
  const mapped = mappedReplacementsForBehaviorKey(behavior, behaviorToReplacementsMap);

  // BIP authority: when the client's BIP maps replacement programs to this behavior, any mapped program
  // that is not a genuine SAFETY misfit is authorized for it. Function-category alignment guides which
  // mapped program auto-assignment *prefers* (see behaviorReplacementCandidatesForMaladaptiveBehavior),
  // but it must NOT block a program the BIP explicitly maps to this behavior — doing so produced false
  // "Documented function" mismatches for programs (e.g. "Accept 'No' as an answer") that are on the map
  // with different casing/quote glyphs than the assigned catalog string.
  const mappedSafe = mapped.filter(
    (p) => !isSafetyHardMisfitReplacementForMaladaptiveBehavior(behavior, p),
  );
  if (replacementProgramListIncludes(mappedSafe, program)) {
    return false;
  }

  if (isHardMisfitReplacementForMaladaptiveBehavior(behavior, program, behaviorFunctions)) {
    return true;
  }

  if (mappedSafe.length > 0) {
    return !replacementProgramListIncludes(mappedSafe, program);
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
    (/^on[- ]?task(?:\s+behavior)?$/i.test(program) || /time on task/i.test(program))
  ) {
    // Prefer Walk within close distance (Safety Skills) for wandering/elopement. Time-on-task is a
    // misfit unless the BIP map explicitly lists it for this behavior (handled above via mappedSafe).
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
  /**
   * When true (default), soft BIP/function misfits are rebalanced. When false, only hard/safety
   * misfits are swapped — used when the wizard selection already covers every hour so selected
   * programs are not collapsed onto a single BIP-mapped label (e.g. Time on task × N).
   */
  rebalanceSoftMisfits?: boolean;
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
    rebalanceSoftMisfits = true,
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
        (rebalanceSoftMisfits
          ? isHardMisfitReplacementForMaladaptiveBehavior(behavior, currentName, hourFunctions)
          : isSafetyHardMisfitReplacementForMaladaptiveBehavior(behavior, currentName));
      if (!hardMisfit) continue;
    }
    // When the wizard selection already covers every hour, only *safety* hard misfits may remapped
    // (leave-area on non-elopement, etc.). Function-category mismatches (FCT / Request Help / Walk
    // on escape behaviors) must NOT collapse every hour onto "Follow demands…" — that was the
    // production bug where 5 selected programs became Follow demands × 4.
    const isMisfit = rebalanceSoftMisfits
      ? isMisfitReplacementForMaladaptiveBehavior(
          behavior,
          currentName,
          behaviorToReplacementsMap,
          hourFunctions,
        )
      : isSafetyHardMisfitReplacementForMaladaptiveBehavior(behavior, currentName);
    if (!isMisfit) {
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
      if (rebalanceSoftMisfits) {
        if (
          isMisfitReplacementForMaladaptiveBehavior(
            behavior,
            n,
            behaviorToReplacementsMap,
            hourFunctions,
          )
        ) {
          return false;
        }
      } else if (isSafetyHardMisfitReplacementForMaladaptiveBehavior(behavior, n)) {
        return false;
      }
      if (candidates.length === 0) return true;
      if (candidates.includes(n)) return true;
      // When the BIP map only lists hard mismatches, allow heuristic-aligned pool programs.
      const mapped = mappedReplacementsForBehaviorKey(behavior, behaviorToReplacementsMap);
      const mappedViable = mapped.filter((p) =>
        rebalanceSoftMisfits
          ? !isHardMisfitReplacementForMaladaptiveBehavior(behavior, p, hourFunctions)
          : !isSafetyHardMisfitReplacementForMaladaptiveBehavior(behavior, p),
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

/**
 * Enforce **distinct replacement programs across the ABC segments of one note**. Even when two hours
 * share the same documented function (so `rebalanceDistinctReplacementProgramsByFunction` leaves them
 * alone), reviewers do not want the same program repeated across ABCs. This pass keeps the first use of
 * each program and, for every later duplicate, swaps to a still-unused program that is authorized/
 * function-appropriate for that segment's behavior (BIP-mapped candidates first, then any non-misfit
 * pool program). If no unused authorized alternative exists (small catalog), the repeat is left in place
 * rather than introducing an unauthorized or mismatched program.
 *
 * Explicit ABC pins are honored (never swapped) unless `swapExplicitDuplicates` is true.
 */
export function rebalanceRepeatedReplacementProgramsAcrossSegments(params: {
  segmentCount: number;
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
  swapExplicitDuplicates?: boolean;
  /**
   * When no function-preferred distinct alternative remains, allow swapping a duplicate to ANY distinct
   * program already in `poolIds` that is not a genuine SAFETY (hard) misfit. The session-effective pool
   * (not this flag) controls whether unselected assessment programs are eligible: when selection covers
   * hours the pool is selected-only; when hours exceed selection, fill-ins may already be in `poolIds`.
   */
  allowFunctionRelaxedDistinctness?: boolean;
  /**
   * When true (wizard selection covers hours), treat only safety hard misfits as blocking for
   * distinctness — function-category mismatches stay eligible so selected FCT / Request Help / Walk
   * can replace duplicate Follow-demands hours.
   */
  preserveSessionSelectedPrograms?: boolean;
  slotLabel?: string;
}): string[] {
  const {
    segmentCount: S,
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
    swapExplicitDuplicates = false,
    allowFunctionRelaxedDistinctness = false,
    preserveSessionSelectedPrograms = false,
    slotLabel = "Segment",
  } = params;

  const swapped: string[] = [];
  const usedKeys = new Set<string>();

  for (let s = 0; s < S; s++) {
    const behavior = beh[s]?.trim() ?? "";
    const currentName = names[s]?.trim() ?? "";
    if (!currentName) continue;
    const currentKey = normalizeReplacementProgramKey(currentName);

    // First use of this program: keep and record.
    if (!usedKeys.has(currentKey)) {
      usedKeys.add(currentKey);
      continue;
    }

    // Duplicate program name. Try to swap to a distinct authorized alternative for this behavior.
    if (!behavior) continue;
    if (typeof explicit[s] === "number" && !swapExplicitDuplicates) {
      // Honor the RBT's explicit pin even though it repeats.
      continue;
    }
    const hourFunctions = behaviorFunctions?.[s];

    const candidates = behaviorReplacementCandidatesForMaladaptiveBehavior(
      behavior,
      behaviorToReplacementsMap,
      authorizedProgramNames,
      hourFunctions,
    ).filter((n) => normalizeReplacementProgramKey(n) !== currentKey);

    const isUsable = (id: number): boolean => {
      const n = idToName.get(id)?.trim();
      if (!n) return false;
      const key = normalizeReplacementProgramKey(n);
      if (key === currentKey || usedKeys.has(key)) return false;
      if (preserveSessionSelectedPrograms) {
        return !isSafetyHardMisfitReplacementForMaladaptiveBehavior(behavior, n);
      }
      return !isMisfitReplacementForMaladaptiveBehavior(
        behavior,
        n,
        behaviorToReplacementsMap,
        hourFunctions,
      );
    };

    // Prefer BIP/function-aligned candidate order, then any non-misfit pool program (selected first).
    let pick: number | undefined;
    for (const prefName of candidates) {
      const prefKey = normalizeReplacementProgramKey(prefName);
      if (usedKeys.has(prefKey)) continue;
      const found = poolIds.find(
        (id) => isUsable(id) && normalizeReplacementProgramKey(idToName.get(id) ?? "") === prefKey,
      );
      if (found !== undefined) {
        pick = found;
        break;
      }
    }
    if (pick === undefined) {
      const sorted = poolIds
        .filter((id) => isUsable(id))
        .sort((a, b) => (selectedIdSet.has(a) ? 0 : 1) - (selectedIdSet.has(b) ? 0 : 1));
      pick = sorted[0];
    }

    if (pick === undefined && allowFunctionRelaxedDistinctness) {
      // Distinctness fallback within `poolIds` only: when hours exceed selection the pool may already
      // include assessment fill-ins; when selection covers hours the pool is selected-only and this
      // cannot introduce unselected programs. Prefer non-selected pool members when present (fill-ins).
      const relaxed = poolIds
        .filter((id) => {
          const n = idToName.get(id)?.trim();
          if (!n) return false;
          const key = normalizeReplacementProgramKey(n);
          if (key === currentKey || usedKeys.has(key)) return false;
          // Always safety-only here: function-category "hard" misfits must remain eligible when
          // preserving a full wizard selection (otherwise Follow demands repeats forever).
          return !isSafetyHardMisfitReplacementForMaladaptiveBehavior(behavior, n);
        })
        .sort((a, b) => (selectedIdSet.has(a) ? 1 : 0) - (selectedIdSet.has(b) ? 1 : 0));
      pick = relaxed[0];
    }

    if (pick === undefined) {
      // No distinct authorized alternative available; leave the (legitimate) repeat in place.
      continue;
    }

    const newName = idToName.get(pick)!;
    names[s] = newName;
    pids[s] = pick;
    rbt[s] = !selectedIdSet.has(pick);
    usedKeys.add(normalizeReplacementProgramKey(newName));
    swapped.push(
      `${slotLabel} ${s + 1} (${behavior}): replacement program rebalanced from "${currentName}" to "${newName}" so each ABC uses a distinct replacement program.`,
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
  const excludedKeys = new Set(
    [...(excludeNames ?? [])].map((n) => normalizeReplacementProgramKey(n)),
  );
  const isExcluded = (name: string): boolean => excludedKeys.has(normalizeReplacementProgramKey(name));
  const candidates = behaviorReplacementCandidatesForMaladaptiveBehavior(
    behavior,
    behaviorToReplacementsMap,
    authorizedProgramNames,
    behaviorFunctions,
  );
  for (const c of candidates) {
    if (!isExcluded(c)) return c;
  }
  const primary = primaryFunctionForReplacementSelection(behaviorFunctions);
  if (primary) {
    for (const p of authorizedProgramNames) {
      if (isExcluded(p)) continue;
      if (
        replacementProgramMatchesFunctionCategory(p, primary) &&
        !isHardMisfitReplacementForMaladaptiveBehavior(behavior, p, behaviorFunctions)
      ) {
        return p;
      }
    }
  }
  for (const p of authorizedProgramNames) {
    if (isExcluded(p)) continue;
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
 * Rebalance replacement programs per narrative segment using the **session-effective** pool
 * (`rebalancePoolIds` — selected-only when selection covers hours; otherwise selected + fill-ins),
 * override explicit ABC pins when they are hard function mismatches, and apply a final fallback
 * picker so assignments always align before note generation. Callers must not pass the full client
 * catalog when the wizard selection already covers every hour.
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
  /**
   * When false, BIP soft-misfit remaps are skipped so a full wizard selection is not collapsed onto
   * one mapped program. Hard/safety misfits still swap. Default true.
   */
  rebalanceSoftMisfits?: boolean;
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
    rebalanceSoftMisfits = true,
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
      rebalanceSoftMisfits,
      slotLabel,
    }),
  );
  // Soft function-distinctness only when soft remaps are enabled — otherwise it can still
  // collapse selected programs onto the few that match escape/tangible heuristics.
  if (rebalanceSoftMisfits) {
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
  }

  const poolNameAllowList = new Set(
    rebalancePoolIds
      .map((id) => idToName.get(id)?.trim() ?? "")
      .filter((n) => n.length > 0)
      .map((n) => normalizeReplacementProgramKey(n)),
  );
  const authorizedInPool = authorizedProgramNames.filter((n) =>
    poolNameAllowList.has(normalizeReplacementProgramKey(n)),
  );

  for (let s = 0; s < S; s++) {
    const behavior = beh[s]?.trim() ?? "";
    const currentName = names[s]?.trim() ?? "";
    if (!behavior || !currentName) continue;
    const hourFunctions = behaviorFunctions?.[s];
    const stillMisfit = rebalanceSoftMisfits
      ? isMisfitReplacementForMaladaptiveBehavior(
          behavior,
          currentName,
          behaviorToReplacementsMap,
          hourFunctions,
        )
      : isSafetyHardMisfitReplacementForMaladaptiveBehavior(behavior, currentName);
    if (!stillMisfit) {
      continue;
    }
    const usedNames = new Set(
      names.map((n, idx) => (idx === s ? "" : n.trim())).filter((n) => n.length > 0),
    );
    // Never pick outside the session-effective pool — even if authorizedProgramNames is wider.
    const fallback = pickBestReplacementProgramForBehavior(
      behavior,
      behaviorToReplacementsMap,
      authorizedInPool.length > 0 ? authorizedInPool : authorizedProgramNames,
      hourFunctions,
      usedNames,
    );
    if (!fallback || fallback === currentName) continue;
    if (!poolNameAllowList.has(normalizeReplacementProgramKey(fallback))) continue;
    const pid = resolveReplacementProgramIdByName(fallback, idToName);
    if (pid !== null && !rebalancePoolIds.includes(pid)) continue;
    names[s] = fallback;
    if (pid !== null) {
      pids[s] = pid;
      rbt[s] = !selectedIdSet.has(pid);
    }
    swapped.push(
      `${slotLabel} ${s + 1} (${behavior}): replacement program auto-corrected from "${currentName}" to "${fallback}" for BIP function alignment.`,
    );
  }

  // Prefer Walk within close distance (Safety Skills) for wandering/elopement over Time on task when
  // the proximity program is authorized for the client — even if Time on task was BIP-mapped.
  swapped.push(
    ...rebalanceWanderingSafetyProximityPrograms({
      segmentCount: S,
      maladaptiveBehaviorForHour: beh,
      names,
      rbtActionsOnlyOutcomeForHour: rbt,
      programIdForHour: pids,
      explicitProgramIdByHour: explicit,
      poolIds: rebalancePoolIds,
      idToName,
      selectedIdSet,
      authorizedProgramNames: authorizedInPool.length > 0 ? authorizedInPool : authorizedProgramNames,
      slotLabel,
    }),
  );

  // Final pass: ensure no replacement program repeats across the note's ABC segments when a distinct
  // alternative remains in the session-effective pool. `allowFunctionRelaxedDistinctness` may use any
  // non-safety pool member for distinctness — it must not expand beyond `rebalancePoolIds`.
  swapped.push(
    ...rebalanceRepeatedReplacementProgramsAcrossSegments({
      segmentCount: S,
      maladaptiveBehaviorForHour: beh,
      names,
      rbtActionsOnlyOutcomeForHour: rbt,
      programIdForHour: pids,
      explicitProgramIdByHour: explicit,
      poolIds: rebalancePoolIds,
      idToName,
      selectedIdSet,
      behaviorToReplacementsMap,
      authorizedProgramNames: authorizedInPool.length > 0 ? authorizedInPool : authorizedProgramNames,
      maladaptiveBehaviorFunctionsForHour: behaviorFunctions,
      allowFunctionRelaxedDistinctness: true,
      preserveSessionSelectedPrograms: !rebalanceSoftMisfits,
      slotLabel,
    }),
  );

  return swapped;
}

/**
 * When Wandering Away / elopement is paired with Time on task (or On task Behavior) but the client
 * has an authorized "Walk within close distance of adult (Safety Skills)" program, swap to that
 * proximity program so the ABC documents the safety skill that matches the topography.
 */
export function rebalanceWanderingSafetyProximityPrograms(params: {
  segmentCount: number;
  maladaptiveBehaviorForHour: string[];
  names: string[];
  rbtActionsOnlyOutcomeForHour: boolean[];
  programIdForHour: (number | null)[];
  explicitProgramIdByHour: (number | null | undefined)[];
  poolIds: number[];
  idToName: Map<number, string>;
  selectedIdSet: Set<number>;
  authorizedProgramNames: string[];
  slotLabel?: string;
}): string[] {
  const {
    segmentCount: S,
    maladaptiveBehaviorForHour: beh,
    names,
    rbtActionsOnlyOutcomeForHour: rbt,
    programIdForHour: pids,
    explicitProgramIdByHour: explicit,
    poolIds,
    idToName,
    selectedIdSet,
    authorizedProgramNames,
    slotLabel = "Segment",
  } = params;

  const walkCloseName =
    authorizedProgramNames.find((n) => /walk within close|close distance|safety skills/i.test(n)) ??
    [...idToName.values()].find((n) => /walk within close|close distance|safety skills/i.test(n));
  if (!walkCloseName) return [];

  const walkCloseId =
    [...idToName.entries()].find(
      ([, n]) => normalizeReplacementProgramKey(n) === normalizeReplacementProgramKey(walkCloseName),
    )?.[0] ?? null;
  if (walkCloseId === null || !poolIds.includes(walkCloseId)) return [];

  const swapped: string[] = [];
  for (let s = 0; s < S; s++) {
    const behavior = beh[s]?.trim() ?? "";
    if (!behavior) continue;
    if (
      !/\belope/.test(behavior.toLowerCase()) &&
      !/\bwandering\b/.test(behavior.toLowerCase()) &&
      !/\bbolting\b/.test(behavior.toLowerCase()) &&
      !/\brunning\s+away\b/.test(behavior.toLowerCase())
    ) {
      continue;
    }
    if (typeof explicit[s] === "number") continue;
    const current = names[s]?.trim() ?? "";
    if (!current) continue;
    if (/walk within close|close distance|safety skills/i.test(current)) continue;
    if (!/^on[- ]?task(?:\s+behavior)?$/i.test(current) && !/time on task/i.test(current)) {
      continue;
    }

    names[s] = walkCloseName;
    pids[s] = walkCloseId;
    rbt[s] = !selectedIdSet.has(walkCloseId);
    swapped.push(
      `${slotLabel} ${s + 1} (${behavior}): replacement program rebalanced from "${current}" to "${walkCloseName}" to match wandering/elopement with the approved proximity/safety skills program.`,
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
