/**
 * Optional structured assessment snapshot on the client profile.
 * When present, note generation intersects catalogs with these allow-lists only.
 */

import type { AssessmentStructuredRow, ClientProfileRow } from "@workspace/db/schema";

export function parseAssessmentStructured(raw: unknown): AssessmentStructuredRow | null {
  if (raw === null || raw === undefined || typeof raw !== "object") {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const behaviors = toTrimmedStringArray(o.behaviors);
  const replacement_programs = toTrimmedStringArray(o.replacement_programs);
  const interventions = toTrimmedStringArray(o.interventions);
  const behavior_to_replacements_map = toStringArrayMap(o.behavior_to_replacements_map);
  const behavior_to_interventions_map = toStringArrayMap(o.behavior_to_interventions_map);
  const replacement_program_functions = toFunctionMap(o.replacement_program_functions);
  const general_interventions = toTrimmedStringArray(o.general_interventions);

  if (
    behaviors.length === 0 &&
    replacement_programs.length === 0 &&
    interventions.length === 0 &&
    Object.keys(behavior_to_replacements_map).length === 0 &&
    Object.keys(behavior_to_interventions_map).length === 0
  ) {
    return null;
  }

  return {
    behaviors,
    replacement_programs,
    interventions,
    behavior_to_replacements_map,
    behavior_to_interventions_map,
    ...(replacement_program_functions ? { replacement_program_functions: replacement_program_functions } : {}),
    ...(general_interventions.length > 0 ? { general_interventions: general_interventions } : {}),
  };
}

function toTrimmedStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map((x) => String(x).trim()).filter((s) => s.length > 0))];
}

function toStringArrayMap(v: unknown): Record<string, string[]> {
  if (v === null || v === undefined || typeof v !== "object" || Array.isArray(v)) {
    return {};
  }
  const out: Record<string, string[]> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const key = k.trim();
    if (!key) continue;
    out[key] = toTrimmedStringArray(val);
  }
  return out;
}

const FUNCTIONS = new Set(["escape", "attention", "tangible", "automatic"]);

function toFunctionMap(v: unknown): Record<string, ("escape" | "attention" | "tangible" | "automatic")[]> | undefined {
  if (v === null || v === undefined || typeof v !== "object" || Array.isArray(v)) {
    return undefined;
  }
  const out: Record<string, ("escape" | "attention" | "tangible" | "automatic")[]> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const key = k.trim();
    if (!key) continue;
    if (!Array.isArray(val)) continue;
    const arr: ("escape" | "attention" | "tangible" | "automatic")[] = [];
    for (const x of val) {
      const s = String(x).trim().toLowerCase();
      if (FUNCTIONS.has(s)) {
        arr.push(s as "escape" | "attention" | "tangible" | "automatic");
      }
    }
    if (arr.length > 0) {
      out[key] = [...new Set(arr)];
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Returns human-readable issues, or empty when valid. */
export function validateAssessmentStructured(a: AssessmentStructuredRow): string[] {
  const issues: string[] = [];
  const behaviorSet = new Set(a.behaviors);
  const programSet = new Set(a.replacement_programs);
  const interventionSet = new Set(a.interventions);

  for (const b of Object.keys(a.behavior_to_replacements_map)) {
    if (!behaviorSet.has(b)) {
      issues.push(`behavior_to_replacements_map key "${b}" is not listed in behaviors.`);
    }
    for (const p of a.behavior_to_replacements_map[b] ?? []) {
      if (!programSet.has(p)) {
        issues.push(`behavior_to_replacements_map["${b}"] contains "${p}" which is not in replacement_programs.`);
      }
    }
  }
  for (const b of Object.keys(a.behavior_to_interventions_map)) {
    if (!behaviorSet.has(b)) {
      issues.push(`behavior_to_interventions_map key "${b}" is not listed in behaviors.`);
    }
    for (const i of a.behavior_to_interventions_map[b] ?? []) {
      if (!interventionSet.has(i)) {
        issues.push(`behavior_to_interventions_map["${b}"] contains "${i}" which is not in interventions.`);
      }
    }
  }
  if (a.general_interventions) {
    for (const i of a.general_interventions) {
      if (!interventionSet.has(i)) {
        issues.push(`general_interventions contains "${i}" which is not in interventions.`);
      }
    }
  }
  if (a.replacement_program_functions) {
    for (const prog of Object.keys(a.replacement_program_functions)) {
      if (!programSet.has(prog)) {
        issues.push(`replacement_program_functions key "${prog}" is not in replacement_programs.`);
      }
    }
  }
  return issues;
}

export function getAssessmentStructuredFromProfile(profile: ClientProfileRow | null | undefined): AssessmentStructuredRow | null {
  if (!profile?.assessmentStructured) return null;
  return parseAssessmentStructured(profile.assessmentStructured);
}

/**
 * Return a copy of `structured` whose allow-lists (behaviors, replacement_programs, interventions)
 * are unioned with the client profile's own lists.
 *
 * The client **app profile is authoritative** for note generation: items the RBT added to the app
 * must never be dropped by intersecting with a stale/PDF-extracted allow-list. Unioning the profile
 * lists in makes every downstream `intersectCatalog(profileCatalog, structured.*)` a no-op for
 * profile items (profile ⊆ allow-list), so app items are always usable — without ever ADDING
 * assessment-only items (those simply never appear in the profile-derived catalogs).
 *
 * Only adds to allow-lists; behavior/intervention maps are untouched, so the result still passes
 * `validateAssessmentStructured` (map values already referenced existing allow-list entries).
 * Returns `null` when `structured` is `null`.
 */
export function withProfileListsUnioned(
  structured: AssessmentStructuredRow | null,
  profile: ClientProfileRow | null | undefined,
): AssessmentStructuredRow | null {
  if (!structured) return null;
  const unionInto = (allow: string[], additions: string[]): string[] => {
    const seen = new Set(allow);
    const out = [...allow];
    for (const raw of additions) {
      const v = String(raw).trim();
      if (v && !seen.has(v)) {
        seen.add(v);
        out.push(v);
      }
    }
    return out;
  };
  return {
    ...structured,
    behaviors: unionInto(structured.behaviors, profile?.maladaptiveBehaviors ?? []),
    replacement_programs: unionInto(structured.replacement_programs, [
      ...(profile?.replacementPrograms ?? []),
      ...(profile?.skillAcquisitionPrograms ?? []),
    ]),
    interventions: unionInto(structured.interventions, profile?.interventions ?? []),
  };
}

/** Intersect catalog labels with assessment allow-list (exact string match). */
export function intersectCatalog(catalog: string[], allowed: string[]): string[] {
  if (allowed.length === 0) return [];
  const allow = new Set(allowed);
  return catalog.filter((x) => allow.has(x));
}

function alignMapToCatalogs(
  map: Record<string, string[]>,
  keyCatalog: string[],
  valueCatalog: string[],
): Record<string, string[]> {
  const keyByLower = new Map(keyCatalog.map((k) => [k.trim().toLowerCase(), k.trim()] as const));
  const valueByLower = new Map(valueCatalog.map((v) => [v.trim().toLowerCase(), v.trim()] as const));
  const out: Record<string, string[]> = {};
  for (const [rawKey, rawVals] of Object.entries(map)) {
    const key = keyByLower.get(rawKey.trim().toLowerCase());
    if (!key) continue;
    const vals = [
      ...new Set(
        (rawVals ?? [])
          .map((v) => valueByLower.get(String(v).trim().toLowerCase()) ?? "")
          .filter(Boolean),
      ),
    ];
    if (vals.length > 0) out[key] = vals;
  }
  return out;
}

/**
 * Merge auto-extracted behavior→replacement and behavior→intervention maps into a client's
 * structured assessment.
 *
 * - When `existing` is present (hand-curated or previously auto-built): allow-lists are kept as-is
 *   and only **missing** map keys are added, with values aligned to the existing allow-lists.
 *   Curated entries are never overwritten.
 * - When `existing` is null: a new row is built with allow-lists mirroring the profile lists
 *   (so note-generation intersections are identity) — but only when at least one map entry was
 *   extracted; otherwise null is returned and the profile stays in non-structured mode.
 *
 * The result always passes `validateAssessmentStructured`.
 */
export function mergeAutoExtractedBehaviorMapsIntoStructured(params: {
  existing: AssessmentStructuredRow | null;
  profileBehaviors: string[];
  profileReplacementPrograms: string[];
  profileInterventions: string[];
  behaviorToReplacements: Record<string, string[]>;
  behaviorToInterventions: Record<string, string[]>;
}): AssessmentStructuredRow | null {
  const {
    existing,
    profileBehaviors,
    profileReplacementPrograms,
    profileInterventions,
    behaviorToReplacements,
    behaviorToInterventions,
  } = params;

  if (existing) {
    const alignedRepl = alignMapToCatalogs(
      behaviorToReplacements,
      existing.behaviors,
      existing.replacement_programs,
    );
    const alignedIntv = alignMapToCatalogs(
      behaviorToInterventions,
      existing.behaviors,
      existing.interventions,
    );
    let changed = false;
    const nextReplMap = { ...existing.behavior_to_replacements_map };
    for (const [k, vals] of Object.entries(alignedRepl)) {
      if (nextReplMap[k] && nextReplMap[k].length > 0) continue;
      nextReplMap[k] = vals;
      changed = true;
    }
    const nextIntvMap = { ...existing.behavior_to_interventions_map };
    for (const [k, vals] of Object.entries(alignedIntv)) {
      if (nextIntvMap[k] && nextIntvMap[k].length > 0) continue;
      nextIntvMap[k] = vals;
      changed = true;
    }
    if (!changed) return existing;
    return {
      ...existing,
      behavior_to_replacements_map: nextReplMap,
      behavior_to_interventions_map: nextIntvMap,
    };
  }

  const behaviors = [...new Set(profileBehaviors.map((s) => s.trim()).filter(Boolean))];
  const programs = [...new Set(profileReplacementPrograms.map((s) => s.trim()).filter(Boolean))];
  const interventions = [...new Set(profileInterventions.map((s) => s.trim()).filter(Boolean))];

  const replMap = alignMapToCatalogs(behaviorToReplacements, behaviors, programs);
  const intvMap = alignMapToCatalogs(behaviorToInterventions, behaviors, interventions);
  if (Object.keys(replMap).length === 0 && Object.keys(intvMap).length === 0) {
    return null;
  }
  return {
    behaviors,
    replacement_programs: programs,
    interventions,
    behavior_to_replacements_map: replMap,
    behavior_to_interventions_map: intvMap,
  };
}
