/**
 * Suggested replacement-program names to pair with common maladaptive-behavior *groups* when
 * the client's authorized program pool includes them. The server only assigns a preferred
 * name when it exists in the pool (exact string match, case-insensitive) — never invents a program.
 * Order within each list is the preferred try order.
 */
type BehaviorGroup = {
  /** Match hour's catalog maladaptive label. More specific groups should appear first. */
  behaviorMatches: (maladaptiveLabel: string) => boolean;
  preferredProgramNames: readonly string[];
};

const PREFERRED_REPLACEMENT_BY_MALADAPTIVE_GROUP: readonly BehaviorGroup[] = [
  {
    behaviorMatches: (l) => /\bphysical\s+aggression\b/i.test(l),
    preferredProgramNames: [
      "Request help",
      "Accept alternatives when being redirected to more appropriate behavior",
      "Follow demands after the first prompts provided",
      "Respond to own Name",
      "Transition Compatible with ABLLS-R Code N4",
    ] as const,
  },
  {
    behaviorMatches: (l) => /\bproperty\s+destruction\b/i.test(l) || /\bdestruction\s+of\s+property\b/i.test(l),
    preferredProgramNames: [
      "Request help",
      "Follow demands after the first prompts provided",
      "Time on task",
      "Accept alternatives when being redirected to more appropriate behavior",
      "Transition from preferred activities to non-preferred activities",
    ] as const,
  },
  {
    behaviorMatches: (l) => /\btask\s+refusal\b/i.test(l),
    preferredProgramNames: [
      "Follow demands after the first prompts provided",
      "Request help",
      "Time on task",
      "Accept alternatives when being redirected to more appropriate behavior",
      "Transition from preferred activities to non-preferred activities",
    ] as const,
  },
  {
    behaviorMatches: (l) =>
      /\brepetitive\s+behavior\b/i.test(l) ||
      /\b(stereotyp|motor\s+stereotypy|perseverative)\b/i.test(l),
    preferredProgramNames: [
      "Time on task",
      "Respond to own Name",
      "Improve eye contact",
      "Follow demands after the first prompts provided",
      "Transition Compatible with ABLLS-R Code N4",
      "Pre-requisite",
    ] as const,
  },
  {
    behaviorMatches: (l) => /\b(wander|wandering|bolting|bolt|elope)\b/i.test(l),
    preferredProgramNames: [
      "Transition Compatible with ABLLS-R Code N4",
      "Follow demands after the first prompts provided",
      "Time on task",
      "Request help",
      "Accept alternatives when being redirected to more appropriate behavior",
    ] as const,
  },
  {
    behaviorMatches: (l) => /\b(tantrum|meltdown|emotional\s+dysregulation)\b/i.test(l),
    preferredProgramNames: [
      "Accept alternatives when being redirected to more appropriate behavior",
      "Request help",
      "Follow demands after the first prompts provided",
      "Transition Compatible with ABLLS-R Code N4",
      "Time on task",
    ] as const,
  },
] as const;

function namesEqualCaseInsensitive(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Ordered preferred program *names* for this behavior label, or null if no mapping applies.
 */
export function preferredReplacementProgramNamesForMaladaptiveLabel(maladaptiveLabel: string): string[] | null {
  const t = maladaptiveLabel.trim();
  if (t.length === 0) return null;
  for (const g of PREFERRED_REPLACEMENT_BY_MALADAPTIVE_GROUP) {
    if (g.behaviorMatches(t)) {
      return [...g.preferredProgramNames];
    }
  }
  return null;
}

/**
 * If any preferred name exists in the pool, return the program id to use, preferring not to repeat
 * `previousName` when another preferred option exists.
 */
export function pickPreferredPoolProgramId(params: {
  orderedPreferredNames: string[];
  pool: number[];
  idToName: Map<number, string>;
  previousHourName: string | null;
}): number | null {
  const { orderedPreferredNames, pool, idToName, previousHourName } = params;
  if (pool.length === 0 || orderedPreferredNames.length === 0) {
    return null;
  }
  const prev = previousHourName?.trim() ?? null;

  const findIdForName = (programName: string): number | null => {
    for (const id of pool) {
      const n = idToName.get(id);
      if (n && namesEqualCaseInsensitive(n, programName)) {
        return id;
      }
    }
    return null;
  };

  const candidates: number[] = [];
  for (const p of orderedPreferredNames) {
    const id = findIdForName(p);
    if (id != null) {
      candidates.push(id);
    }
  }
  if (candidates.length === 0) {
    return null;
  }
  for (const id of candidates) {
    const n = idToName.get(id)!;
    if (prev == null || !namesEqualCaseInsensitive(n, prev)) {
      return id;
    }
  }
  return candidates[0]!;
}
