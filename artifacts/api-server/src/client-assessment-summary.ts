import type { ClientAssessmentSummaryRow } from "@workspace/db/schema";
import { isCaregiverOrPersonRolePreference } from "./note-assembly";
import { sanitizeTextForJsonStorage } from "./sanitize-text-for-json";

/** Partial summary from API requests, PDF extract, or legacy profile rows. */
export type ClientAssessmentSummaryInput = {
  assessor?: string | null;
  assessmentDate?: string | null;
  authorizedHours?: string | null;
  summary?: string | null;
  diagnoses?: string[] | null;
  recommendations?: string[] | null;
  medicalHistory?: string | null;
  behaviorProfiles?: string[] | null;
  reinforcementPreferences?: string[] | null;
  precursorBehaviors?: string[] | null;
  crisisProtocol?: string | null;
  parentTrainingGoals?: string[] | null;
  supervisorRequirements?: string | null;
};

function trimOrNull(s: string | null | undefined): string | null {
  const t = sanitizeTextForJsonStorage(s ?? "").trim();
  return t.length > 0 ? t : null;
}

function dedupeTrimmedStrings(arr: string[] | null | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of arr ?? []) {
    const t = sanitizeTextForJsonStorage(raw).trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** Accept ISO `yyyy-MM-dd` or US `MM/dd/yyyy` for assessment summary date fields. */
export function normalizeAssessmentSummaryDateOrNull(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (iso) {
    const y = Number(iso[1]);
    const mo = Number(iso[2]);
    const d = Number(iso[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (us) {
    const mo = Number(us[1]);
    const d = Number(us[2]);
    const y = Number(us[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  return null;
}

export function sanitizeClientAssessmentSummary(
  raw: ClientAssessmentSummaryInput | null | undefined,
): ClientAssessmentSummaryRow | null {
  if (!raw) return null;

  const out: ClientAssessmentSummaryRow = {
    assessor: trimOrNull(raw.assessor),
    assessmentDate: normalizeAssessmentSummaryDateOrNull(raw.assessmentDate),
    authorizedHours: trimOrNull(raw.authorizedHours),
    summary: trimOrNull(raw.summary),
    diagnoses: dedupeTrimmedStrings(raw.diagnoses),
    recommendations: dedupeTrimmedStrings(raw.recommendations),
    medicalHistory: trimOrNull(raw.medicalHistory),
    behaviorProfiles: dedupeTrimmedStrings(raw.behaviorProfiles),
    reinforcementPreferences: dedupeTrimmedStrings(raw.reinforcementPreferences).filter(
      (p) => !isCaregiverOrPersonRolePreference(p),
    ),
    precursorBehaviors: dedupeTrimmedStrings(raw.precursorBehaviors),
    crisisProtocol: trimOrNull(raw.crisisProtocol),
    parentTrainingGoals: dedupeTrimmedStrings(raw.parentTrainingGoals),
    supervisorRequirements: trimOrNull(raw.supervisorRequirements),
  };

  const hasContent =
    out.assessor != null ||
    out.assessmentDate != null ||
    out.authorizedHours != null ||
    out.summary != null ||
    out.medicalHistory != null ||
    out.crisisProtocol != null ||
    out.supervisorRequirements != null ||
    (out.diagnoses?.length ?? 0) > 0 ||
    (out.recommendations?.length ?? 0) > 0 ||
    (out.behaviorProfiles?.length ?? 0) > 0 ||
    (out.reinforcementPreferences?.length ?? 0) > 0 ||
    (out.precursorBehaviors?.length ?? 0) > 0 ||
    (out.parentTrainingGoals?.length ?? 0) > 0;

  return hasContent ? out : null;
}

export function emptyClientAssessmentSummaryRow(): ClientAssessmentSummaryRow {
  return {
    assessor: null,
    assessmentDate: null,
    authorizedHours: null,
    summary: null,
    diagnoses: [],
    recommendations: [],
    medicalHistory: null,
    behaviorProfiles: [],
    reinforcementPreferences: [],
    precursorBehaviors: [],
    crisisProtocol: null,
    parentTrainingGoals: [],
    supervisorRequirements: null,
  };
}

/** Map sanitized DB row to PDF-extract payload shape (`null` → omitted, arrays required). */
export function assessmentSummaryForExtractPayload<
  T extends {
    assessor?: string;
    assessmentDate?: string;
    authorizedHours?: string;
    summary?: string;
    diagnoses: string[];
    recommendations: string[];
    medicalHistory?: string;
    behaviorProfiles: string[];
    reinforcementPreferences: string[];
    precursorBehaviors: string[];
    crisisProtocol?: string;
    parentTrainingGoals: string[];
    supervisorRequirements?: string;
  },
>(row: ClientAssessmentSummaryRow): T {
  return {
    assessor: row.assessor ?? undefined,
    assessmentDate: row.assessmentDate ?? undefined,
    authorizedHours: row.authorizedHours ?? undefined,
    summary: row.summary ?? undefined,
    diagnoses: row.diagnoses,
    recommendations: row.recommendations,
    medicalHistory: row.medicalHistory ?? undefined,
    behaviorProfiles: row.behaviorProfiles,
    reinforcementPreferences: row.reinforcementPreferences,
    precursorBehaviors: row.precursorBehaviors,
    crisisProtocol: row.crisisProtocol ?? undefined,
    parentTrainingGoals: row.parentTrainingGoals,
    supervisorRequirements: row.supervisorRequirements ?? undefined,
  } as T;
}
