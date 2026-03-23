import { customFetch } from "./custom-fetch";

/** Fields inferred from assessment PDF text (server + OpenAI). */
export type AssessmentExtractedFields = {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  maladaptiveBehaviors: string[];
  replacementPrograms: string[];
  interventions: string[];
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
