import type {
  AssessmentExtractionProvenanceRow,
  AssessmentStructuredRow,
  ClientAssessmentSummaryRow,
  ClientProfileRow,
  ClinicalFunction,
  MaladaptiveBehaviorProfileEntry,
} from "@workspace/db/schema";
import type { AssessmentExtracted } from "./assessment-extract";
import { expandMaladaptiveTargetsFromProfile } from "./client-profile-maladaptive";
import { sanitizeClientAssessmentSummary } from "./client-assessment-summary";

type ExtractedForPersistence = Pick<
  AssessmentExtracted,
  | "maladaptiveBehaviorTopographies"
  | "behaviorReplacementMap"
  | "behaviorInterventionMap"
  | "assessmentSummary"
>;

function lowerSet(values: string[] | undefined): Set<string> {
  return new Set((values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function alignedName(raw: string, catalog: string[]): string | null {
  const key = raw.trim().toLowerCase();
  return catalog.find((item) => item.trim().toLowerCase() === key)?.trim() ?? null;
}

function sameFunctions(
  left: ClinicalFunction[] | null | undefined,
  right: ClinicalFunction[] | null | undefined,
): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function alignMap(
  raw: Record<string, string[]> | undefined,
  behaviorCatalog: string[],
  valueCatalog: string[],
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [rawBehavior, rawValues] of Object.entries(raw ?? {})) {
    const behavior = alignedName(rawBehavior, behaviorCatalog);
    if (!behavior) continue;
    const values = [
      ...new Set(
        rawValues
          .map((value) => alignedName(String(value), valueCatalog))
          .filter((value): value is string => value !== null),
      ),
    ];
    if (values.length > 0) result[behavior] = values;
  }
  return result;
}

function refreshMap(params: {
  existing: Record<string, string[]>;
  extracted: Record<string, string[]>;
  extractedPreviously: Set<string>;
  behaviorCatalog: string[];
  valueCatalog: string[];
}): { map: Record<string, string[]>; extractedBehaviors: string[] } {
  const existing = alignMap(params.existing, params.behaviorCatalog, params.valueCatalog);
  const extracted = alignMap(params.extracted, params.behaviorCatalog, params.valueCatalog);
  const map: Record<string, string[]> = {};
  const extractedBehaviors: string[] = [];

  for (const behavior of params.behaviorCatalog) {
    const key = behavior.toLowerCase();
    const oldValues = existing[behavior] ?? [];
    const newValues = extracted[behavior] ?? [];
    const wasExtracted = params.extractedPreviously.has(key);

    if (wasExtracted) {
      if (newValues.length > 0) {
        map[behavior] = newValues;
        extractedBehaviors.push(behavior);
      }
      continue;
    }
    if (oldValues.length > 0) {
      map[behavior] = oldValues;
      if (newValues.length > 0 && sameJson(oldValues, newValues)) {
        extractedBehaviors.push(behavior);
      }
      continue;
    }
    if (newValues.length > 0) {
      map[behavior] = newValues;
      extractedBehaviors.push(behavior);
    }
  }
  return { map, extractedBehaviors };
}

/**
 * Build the authoritative profile snapshot after a successful, usable PDF upload.
 *
 * Policy: therapist-curated/profile values win. Only values recorded in
 * `assessmentExtractionProvenance` are replaceable by a later upload. Legacy/unmarked values are
 * conservatively treated as curated, except when they exactly equal the new extraction (the
 * onboarding preview path), in which case they are marked extracted for future refreshes.
 * Structured allow-lists and all map keys/values are always pruned to app-profile catalogs.
 */
export function refreshProfileFromAssessmentUpload(params: {
  profile: ClientProfileRow;
  fileName: string;
  assessmentTextSnapshot: string;
  extracted?: Partial<ExtractedForPersistence> | null;
}): ClientProfileRow {
  const { profile, extracted } = params;
  const behaviorCatalog = [...new Set((profile.maladaptiveBehaviors ?? []).map((s) => s.trim()).filter(Boolean))];
  const programCatalog = [
    ...new Set(
      [...(profile.replacementPrograms ?? []), ...(profile.skillAcquisitionPrograms ?? [])]
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  const interventionCatalog = [
    ...new Set((profile.interventions ?? []).map((s) => s.trim()).filter(Boolean)),
  ];
  const previousProvenance = profile.assessmentExtractionProvenance;
  const previousTopography = lowerSet(previousProvenance?.topographyBehaviors);
  const previousFunctions = lowerSet(previousProvenance?.functionBehaviors);

  const extractedTargets = new Map<string, MaladaptiveBehaviorProfileEntry>();
  for (const target of extracted?.maladaptiveBehaviorTopographies ?? []) {
    const name = alignedName(target.name, behaviorCatalog);
    if (!name) continue;
    extractedTargets.set(name.toLowerCase(), {
      name,
      topography: target.topography?.trim() || null,
      ...(target.functions !== undefined ? { functions: target.functions } : {}),
    });
  }

  const topographyBehaviors: string[] = [];
  const functionBehaviors: string[] = [];
  const targets = expandMaladaptiveTargetsFromProfile(profile).map((current) => {
    const key = current.name.toLowerCase();
    const next = extractedTargets.get(key);
    let topography = current.topography ?? null;
    let functions = current.functions ?? null;

    if (previousTopography.has(key)) {
      topography = next?.topography ?? null;
      if (topography) topographyBehaviors.push(current.name);
    } else if (!topography && next?.topography) {
      topography = next.topography;
      topographyBehaviors.push(current.name);
    } else if (topography && next?.topography === topography) {
      topographyBehaviors.push(current.name);
    }

    if (previousFunctions.has(key)) {
      functions = next?.functions ?? null;
      if (next?.functions !== undefined) functionBehaviors.push(current.name);
    } else if ((!functions || functions.length === 0) && next?.functions !== undefined) {
      functions = next.functions;
      functionBehaviors.push(current.name);
    } else if (next?.functions !== undefined && sameFunctions(functions, next.functions)) {
      functionBehaviors.push(current.name);
    }
    return { name: current.name, topography, functions };
  });

  const existingStructured = profile.assessmentStructured;
  const replacementMap = refreshMap({
    existing: existingStructured?.behavior_to_replacements_map ?? {},
    extracted: extracted?.behaviorReplacementMap ?? {},
    extractedPreviously: lowerSet(previousProvenance?.replacementMapBehaviors),
    behaviorCatalog,
    valueCatalog: programCatalog,
  });
  const interventionMap = refreshMap({
    existing: existingStructured?.behavior_to_interventions_map ?? {},
    extracted: extracted?.behaviorInterventionMap ?? {},
    extractedPreviously: lowerSet(previousProvenance?.interventionMapBehaviors),
    behaviorCatalog,
    valueCatalog: interventionCatalog,
  });

  const structured: AssessmentStructuredRow = {
    behaviors: behaviorCatalog,
    replacement_programs: programCatalog,
    interventions: interventionCatalog,
    behavior_to_replacements_map: replacementMap.map,
    behavior_to_interventions_map: interventionMap.map,
    ...(existingStructured?.replacement_program_functions
      ? {
          replacement_program_functions: Object.fromEntries(
            Object.entries(existingStructured.replacement_program_functions).filter(([name]) =>
              programCatalog.includes(name),
            ),
          ),
        }
      : {}),
    ...(existingStructured?.general_interventions
      ? {
          general_interventions: existingStructured.general_interventions.filter((name) =>
            interventionCatalog.includes(name),
          ),
        }
      : {}),
  };

  const extractedSummary = sanitizeClientAssessmentSummary(extracted?.assessmentSummary ?? null);
  let assessmentSummary = profile.assessmentSummary ?? null;
  let assessmentSummaryExtracted = false;
  if (previousProvenance?.assessmentSummaryExtracted) {
    assessmentSummary = extractedSummary;
    assessmentSummaryExtracted = extractedSummary !== null;
  } else if (!assessmentSummary && extractedSummary) {
    assessmentSummary = extractedSummary;
    assessmentSummaryExtracted = true;
  } else if (assessmentSummary && extractedSummary && sameJson(assessmentSummary, extractedSummary)) {
    assessmentSummaryExtracted = true;
  }

  const provenance: AssessmentExtractionProvenanceRow = {
    topographyBehaviors,
    functionBehaviors,
    replacementMapBehaviors: replacementMap.extractedBehaviors,
    interventionMapBehaviors: interventionMap.extractedBehaviors,
    assessmentSummaryExtracted,
  };

  return {
    ...profile,
    assessmentFileName: params.fileName,
    assessmentTextSnapshot: params.assessmentTextSnapshot,
    maladaptiveBehaviorTargets: targets,
    assessmentStructured: structured,
    assessmentSummary,
    assessmentExtractionProvenance: provenance,
  };
}
