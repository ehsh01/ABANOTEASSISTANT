import type { ClinicalFunction } from "@workspace/api-client-react";

const FUNCTION_LABEL: Record<ClinicalFunction, string> = {
  attention: "Attention",
  escape: "Escape",
  tangible: "Tangible",
  automatic: "Sensory/Automatic",
};

const FUNCTION_DISPLAY_ORDER: ClinicalFunction[] = [
  "attention",
  "escape",
  "tangible",
  "automatic",
];

export function formatClinicalFunctionsDisplay(
  functions: ClinicalFunction[] | null | undefined,
): string {
  if (!functions || functions.length === 0) {
    return "Not specified in assessment";
  }
  return FUNCTION_DISPLAY_ORDER.filter((f) => functions.includes(f))
    .map((f) => FUNCTION_LABEL[f])
    .join(", ");
}
