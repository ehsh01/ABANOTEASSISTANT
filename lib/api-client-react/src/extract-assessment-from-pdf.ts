import { customFetch } from "./custom-fetch";

/** Fields inferred from assessment PDF text (server + OpenAI). */
import type { ClientAssessmentSummary, ClinicalFunction } from "./generated/api.schemas";

export type AssessmentExtractedFields = {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  maladaptiveBehaviors: string[];
  /**
   * Per-behavior operational definition / topography copied from the assessment when present. `name` matches
   * an entry in `maladaptiveBehaviors` (server aligns case-insensitively); `topography` is the short description.
   */
  maladaptiveBehaviorTopographies?: {
    name: string;
    topography: string;
    /** FBA functions when stated in the assessment; omit when not documented. */
    functions?: ClinicalFunction[];
  }[];
  replacementPrograms: string[];
  skillAcquisitionPrograms: string[];
  interventions: string[];
  /** ISO `yyyy-MM-dd` authorization / treatment plan expiration date when stated on the assessment. */
  assessmentAuthorizationExpiresOn?: string;
  assessmentSummary?: ClientAssessmentSummary;
  confidenceNotes?: string;
};

export type AssessmentExtractResultPayload = {
  extracted: AssessmentExtractedFields;
  warnings: string[];
  pdfPageCount: number;
  pdfCharCount: number;
};

export type AssessmentExtractSuccessResponse = {
  success: true;
  data: AssessmentExtractResultPayload;
  error: null;
};

/**
 * POST multipart/form-data with field name `file` (single PDF).
 * Requires Bearer auth (same as other tenant routes).
 */
export async function extractAssessmentFromPdf(
  file: File,
): Promise<AssessmentExtractSuccessResponse> {
  const form = new FormData();
  form.append("file", file);
  return customFetch<AssessmentExtractSuccessResponse>("/api/clients/assessment/extract", {
    method: "POST",
    body: form,
    responseType: "json",
  });
}
