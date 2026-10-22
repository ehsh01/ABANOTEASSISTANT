import type { UpdateClientRequest } from "@workspace/api-client-react";
import {
  assessmentSummaryHasContent,
  assessmentSummaryToApiPayload,
  type AssessmentSummaryFormState,
} from "@/components/assessment-summary-fields";

export function assessmentSummaryUpdate(
  form: AssessmentSummaryFormState,
  touchedOrExtracted: boolean,
): Pick<UpdateClientRequest, "assessmentSummary"> | Record<string, never> {
  if (!touchedOrExtracted) return {};
  return {
    assessmentSummary: assessmentSummaryHasContent(form)
      ? assessmentSummaryToApiPayload(form)
      : null,
  };
}
