import type {
  ClientProfileRow,
  MaladaptiveBehaviorProfileEntry,
} from "@workspace/db/schema";

const MAX_TOPOGRAPHY_CHARS = 16_000;

function trimNonEmptyStrings(names: string[]): string[] {
  return names.map((s) => s.trim()).filter((s) => s.length > 0);
}

function dedupePreserveOrder(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function clampTopography(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (t.length === 0) return null;
  return t.length > MAX_TOPOGRAPHY_CHARS ? t.slice(0, MAX_TOPOGRAPHY_CHARS) : t;
}

/** Sanitize an array of targets from API input. */
export function sanitizeMaladaptiveBehaviorTargetsInput(
  raw: unknown,
): MaladaptiveBehaviorProfileEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: MaladaptiveBehaviorProfileEntry[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== "object") continue;
    const name = String((item as { name?: unknown }).name ?? "").trim();
    if (!name) continue;
    const topoRaw = (item as { topography?: unknown }).topography;
    const topography =
      topoRaw === null || topoRaw === undefined ? null : clampTopography(String(topoRaw));
    out.push({ name, topography });
  }
  return out;
}

/** Targets aligned to `behaviors` order; topography from `patchTargets` by name match (exact, then case-insensitive). */
export function orderTargetsToBehaviors(
  behaviors: string[],
  patchTargets: MaladaptiveBehaviorProfileEntry[],
): MaladaptiveBehaviorProfileEntry[] {
  const map = new Map<string, string | null>();
  const mapByLower = new Map<string, string | null>();
  for (const t of patchTargets) {
    const k = t.name.trim();
    if (!k) continue;
    const v = t.topography ?? null;
    if (!map.has(k)) map.set(k, v);
    const kl = k.toLowerCase();
    if (!mapByLower.has(kl)) mapByLower.set(kl, v);
  }
  return behaviors.map((name) => {
    const t = name.trim();
    return {
      name,
      topography: map.get(t) ?? mapByLower.get(t.toLowerCase()) ?? null,
    };
  });
}

/**
 * Normalize stored `maladaptiveBehaviorTargets` from DB: array of `{ name, topography }`, or legacy
 * record of behavior name → topography string.
 */
export function coerceStoredMaladaptiveTargetsFromUnknown(stored: unknown): MaladaptiveBehaviorProfileEntry[] {
  if (Array.isArray(stored)) {
    return sanitizeMaladaptiveBehaviorTargetsInput(stored);
  }
  if (stored !== null && typeof stored === "object" && !Array.isArray(stored)) {
    const out: MaladaptiveBehaviorProfileEntry[] = [];
    for (const [k, v] of Object.entries(stored as Record<string, unknown>)) {
      const name = k.trim();
      if (!name) continue;
      const topography =
        v === null || v === undefined ? null : clampTopography(String(v));
      out.push({ name, topography });
    }
    return out;
  }
  return [];
}

/** Expand stored profile into one target row per `maladaptiveBehaviors` entry (null topography when missing). */
export function expandMaladaptiveTargetsFromProfile(
  profile: ClientProfileRow,
): MaladaptiveBehaviorProfileEntry[] {
  const behaviors = dedupePreserveOrder(trimNonEmptyStrings(profile.maladaptiveBehaviors ?? []));
  const coerced = coerceStoredMaladaptiveTargetsFromUnknown(profile.maladaptiveBehaviorTargets);
  if (coerced.length > 0) {
    return orderTargetsToBehaviors(behaviors, coerced);
  }
  return behaviors.map((name) => ({ name, topography: null }));
}

/**
 * Merge maladaptive fields for create/update.
 * - When `targetsInput` is provided (including `[]`): replace topographies from that list; names follow `behaviorsInput`.
 * - When only `behaviorsInput` is provided: keep prior topography for unchanged names; null for new names.
 */
export function mergeMaladaptiveProfileFields(params: {
  base: ClientProfileRow;
  behaviorsInput?: string[] | undefined;
  targetsInput?: unknown;
}): { maladaptiveBehaviors: string[]; maladaptiveBehaviorTargets: MaladaptiveBehaviorProfileEntry[] } {
  const { base, behaviorsInput, targetsInput } = params;
  const prev = expandMaladaptiveTargetsFromProfile(base);

  if (targetsInput !== undefined) {
    const patchTargets = sanitizeMaladaptiveBehaviorTargetsInput(targetsInput);
    const names =
      behaviorsInput !== undefined
        ? dedupePreserveOrder(trimNonEmptyStrings(behaviorsInput))
        : dedupePreserveOrder(patchTargets.map((t) => t.name));
    return {
      maladaptiveBehaviors: names,
      maladaptiveBehaviorTargets: orderTargetsToBehaviors(names, patchTargets),
    };
  }

  if (behaviorsInput !== undefined) {
    const names = dedupePreserveOrder(trimNonEmptyStrings(behaviorsInput));
    return {
      maladaptiveBehaviors: names,
      maladaptiveBehaviorTargets: orderTargetsToBehaviors(names, prev),
    };
  }

  return {
    maladaptiveBehaviors: dedupePreserveOrder(trimNonEmptyStrings(base.maladaptiveBehaviors ?? [])),
    maladaptiveBehaviorTargets: prev,
  };
}

/** Targets for note JSON: one row per rotation catalog label (topography when profile has it). */
export function maladaptiveBehaviorTargetsForNoteCatalog(
  behaviorCatalog: string[],
  profile: ClientProfileRow | null | undefined,
): MaladaptiveBehaviorProfileEntry[] {
  const byName = new Map(
    profile
      ? expandMaladaptiveTargetsFromProfile(profile).map((t) => [t.name, t] as const)
      : [],
  );
  return behaviorCatalog.map((name) => {
    const hit = byName.get(name);
    return { name, topography: hit?.topography ?? null };
  });
}
