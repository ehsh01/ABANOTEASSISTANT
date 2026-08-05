export function scrubAssessmentNames(
  text: string,
  profile: { firstName?: string | null; lastName?: string | null } | null,
): string {
  let scrubbed = text;
  for (const candidate of [profile?.firstName, profile?.lastName]) {
    const name = candidate?.trim();
    if (!name || name.length < 2) continue;
    scrubbed = scrubbed.replace(
      new RegExp(`\\b${name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "gi"),
      "the client",
    );
  }
  return scrubbed;
}

export function criterionPercentage(entry: {
  count: number | null;
  effectiveTrials: number[];
}): number | null {
  if (!Number.isInteger(entry.count) || entry.count == null || entry.count < 1) return null;
  const uniqueSuccessful = new Set(
    entry.effectiveTrials.filter(
      (trial) => Number.isInteger(trial) && trial >= 1 && trial <= entry.count!,
    ),
  );
  if (uniqueSuccessful.size !== entry.effectiveTrials.length) return null;
  return Math.round((uniqueSuccessful.size / entry.count) * 100);
}

/** Missing or incomplete trial data means the program did not meet criterion (0%). */
export function criterionPercentageOrZero(
  entry: { count: number | null; effectiveTrials: number[] } | null | undefined,
): number {
  if (!entry) return 0;
  return criterionPercentage(entry) ?? 0;
}

/** Default trial rollup used when the RBT left percentage blank (0 of 10 met criterion). */
export const ZERO_CRITERION_TRIAL_ENTRY = {
  count: 10,
  effectiveTrials: [] as number[],
} as const;

/**
 * One program id per session hour. Keeps valid linked assignments; fills gaps from
 * selected then other linked programs; when hours still reuse the same few programs
 * and unused linked programs exist, replaces later duplicates so each hour can use a
 * distinct program when the client catalog allows it.
 */
export function resolveHourlyProgramIds(params: {
  sessionHours: number;
  hintProgramIds: (number | null | undefined)[];
  selectedIds: number[];
  linkedIds: number[];
}): number[] {
  const linkedSet = new Set(params.linkedIds);
  const selectedLinked = params.selectedIds.filter((id) => linkedSet.has(id));
  const otherLinked = params.linkedIds.filter((id) => !selectedLinked.includes(id));
  const fillPool = [...selectedLinked, ...otherLinked];
  if (fillPool.length === 0) return [];

  const resolved: number[] = [];
  for (let hour = 0; hour < params.sessionHours; hour++) {
    const hinted = params.hintProgramIds[hour] ?? null;
    if (hinted != null && linkedSet.has(hinted)) {
      resolved.push(hinted);
      continue;
    }
    const used = new Set(resolved);
    const unused = fillPool.find((id) => !used.has(id));
    resolved.push(unused ?? fillPool[hour % fillPool.length]!);
  }

  const unused = fillPool.filter((id) => !resolved.includes(id));
  for (let hour = 0; hour < resolved.length && unused.length > 0; hour++) {
    const id = resolved[hour]!;
    const firstIndex = resolved.indexOf(id);
    if (hour !== firstIndex) {
      resolved[hour] = unused.shift()!;
    }
  }
  return resolved;
}
