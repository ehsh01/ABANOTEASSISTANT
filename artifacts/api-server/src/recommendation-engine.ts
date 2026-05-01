/**
 * Clinical decision support: replacement programs and interventions strictly from
 * structured assessment allow-lists (no catalog invention).
 */

import type { AssessmentStructuredRow, ClinicalFunction } from "@workspace/db/schema";

export type ClinicalRecommendationInput = {
  /** Exact maladaptive behavior label from `assessmentStructured.behaviors`. */
  behavior: string;
  behavior_topography?: string;
  operational_definition?: string;
  function: ClinicalFunction;
  severity_level: "low" | "moderate" | "high";
  is_dangerous: boolean;
};

export type ClinicalRecommendationData = {
  behavior: string;
  function: string;
  replacement_programs: string[];
  recommended_interventions: string[];
  risk_level: string;
  notes: string;
};

export type ClinicalRecommendationResult =
  | { ok: true; data: ClinicalRecommendationData }
  | { ok: false; error: string };

const RESTRICTIVE_INTERVENTION_RE =
  /\b(response\s*block|blocking|block|protective|crisis|restraint|physical\s*hold|hold)\b/i;

const PRIMARY_INTERVENTION_HINT = /\b(FCT|functional\s+communication|DRA|DRI|DRO|antecedent|reinforcement|NCR|noncontingent)\b/i;

function isRestrictiveInterventionName(name: string): boolean {
  return RESTRICTIVE_INTERVENTION_RE.test(name);
}

function sortInterventionsPrimaryPreference(names: string[]): string[] {
  const primary: string[] = [];
  const rest: string[] = [];
  for (const n of names) {
    if (PRIMARY_INTERVENTION_HINT.test(n)) {
      primary.push(n);
    } else {
      rest.push(n);
    }
  }
  return [...primary, ...rest];
}

/**
 * When `replacement_program_functions` tags exist for a program, it passes only if
 * `fn` is among those tags. Programs with no tags are not excluded by function filter.
 */
function filterProgramsByFunction(
  programs: string[],
  fn: ClinicalFunction,
  assessment: AssessmentStructuredRow,
): string[] {
  const meta = assessment.replacement_program_functions;
  if (!meta || Object.keys(meta).length === 0) {
    return [...programs];
  }
  return programs.filter((p) => {
    const tags = meta[p];
    if (!tags || tags.length === 0) {
      return true;
    }
    return tags.includes(fn);
  });
}

function interventionPoolForBehavior(behavior: string, assessment: AssessmentStructuredRow): string[] {
  const mapped = assessment.behavior_to_interventions_map[behavior];
  if (mapped && mapped.length > 0) {
    return [...new Set(mapped)];
  }
  if (assessment.general_interventions && assessment.general_interventions.length > 0) {
    return [...new Set(assessment.general_interventions)];
  }
  return [...assessment.interventions];
}

function applyDangerPolicy(names: string[], isDangerous: boolean): string[] {
  if (isDangerous) {
    return names;
  }
  return names.filter((n) => !isRestrictiveInterventionName(n));
}

function buildRiskLevel(severity: ClinicalRecommendationInput["severity_level"], isDangerous: boolean): string {
  if (isDangerous && severity === "high") {
    return "high_danger";
  }
  if (isDangerous) {
    return "elevated_safety";
  }
  if (severity === "high") {
    return "high_supervision";
  }
  if (severity === "moderate") {
    return "moderate";
  }
  return "low";
}

function buildNotes(
  input: ClinicalRecommendationInput,
  includedRestrictive: boolean,
  hadDangerWithNoRestrictiveInAssessment: boolean,
): string {
  let n =
    "All selections derived strictly from client assessment. Reinforcement-first and least restrictive applied.";
  if (input.severity_level === "high" || input.is_dangerous) {
    n += " High supervision required.";
    n += " Follow crisis protocol if defined in the assessment.";
  }
  if (input.behavior_topography?.trim()) {
    n += ` Documented topography context: ${input.behavior_topography.trim().slice(0, 200)}`;
  }
  if (hadDangerWithNoRestrictiveInAssessment) {
    n +=
      " No restrictive procedure labels were identified on the assessment intervention list; use agency crisis procedures and on-site supervision per policy.";
  }
  if (includedRestrictive) {
    n +=
      " Restrictive or safety-tier interventions appear only because they are explicitly listed on this client's assessment.";
  }
  return n;
}

export function computeClinicalRecommendation(
  assessment: AssessmentStructuredRow,
  input: ClinicalRecommendationInput,
): ClinicalRecommendationResult {
  if (!assessment.behaviors.length || !assessment.replacement_programs.length || !assessment.interventions.length) {
    return {
      ok: false,
      error: "No matching assessment data found. Cannot generate recommendation.",
    };
  }

  if (!assessment.behaviors.includes(input.behavior)) {
    return {
      ok: false,
      error: "No matching assessment data found. Cannot generate recommendation.",
    };
  }

  const mappedPrograms = assessment.behavior_to_replacements_map[input.behavior];
  const programCandidates =
    mappedPrograms && mappedPrograms.length > 0 ? [...new Set(mappedPrograms)] : [...assessment.replacement_programs];

  const functionFiltered = filterProgramsByFunction(programCandidates, input.function, assessment);
  const replacement_programs = [...new Set(functionFiltered)].filter((p) => assessment.replacement_programs.includes(p));

  let interventionPool = interventionPoolForBehavior(input.behavior, assessment);
  interventionPool = interventionPool.filter((i) => assessment.interventions.includes(i));

  const beforeDanger = applyDangerPolicy(interventionPool, input.is_dangerous);
  const hadDangerWithNoRestrictiveInAssessment =
    input.is_dangerous && !interventionPool.some(isRestrictiveInterventionName);

  const recommended_interventions = sortInterventionsPrimaryPreference([...new Set(beforeDanger)]);
  const includedRestrictive = recommended_interventions.some(isRestrictiveInterventionName);

  const data: ClinicalRecommendationData = {
    behavior: input.behavior,
    function: input.function,
    replacement_programs,
    recommended_interventions,
    risk_level: buildRiskLevel(input.severity_level, input.is_dangerous),
    notes: buildNotes(input, includedRestrictive, hadDangerWithNoRestrictiveInAssessment),
  };

  return { ok: true, data };
}
