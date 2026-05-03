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

/** Intersect catalog labels with assessment allow-list (exact string match). */
export function intersectCatalog(catalog: string[], allowed: string[]): string[] {
  if (allowed.length === 0) return [];
  const allow = new Set(allowed);
  return catalog.filter((x) => allow.has(x));
}
