import { GenerateNoteBody } from "@workspace/api-zod";
import { normalizeLegacyTherapySetting } from "@workspace/therapy-settings";
import { ZodError } from "zod";

/**
 * Stale SPAs (Cloudflare-cached service workers) may omit `abcHints` while still sending
 * selectedReplacements + programTrialData. Synthesize one hourly assignment per session hour
 * so generation can proceed; newer clients always send abcHints explicitly.
 */
export function hydrateLegacyGenerateNoteBody(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...raw };
  const hours = typeof next.sessionHours === "number" ? next.sessionHours : Number(next.sessionHours);
  const selected = Array.isArray(next.selectedReplacements)
    ? next.selectedReplacements.filter((id): id is number => typeof id === "number")
    : [];
  const hintsMissing = !Array.isArray(next.abcHints) || next.abcHints.length === 0;
  if (
    hintsMissing &&
    Number.isFinite(hours) &&
    hours >= 1 &&
    hours <= 8 &&
    selected.length > 0
  ) {
    next.abcHints = Array.from({ length: Math.floor(hours) }, (_, index) => ({
      activityAntecedent: null,
      maladaptiveBehavior: null,
      replacementProgramId: selected[index % selected.length]!,
    }));
  }
  return next;
}

export function parseGenerateNoteBody(
  raw: unknown,
): ReturnType<typeof GenerateNoteBody.parse> {
  const bodyIn =
    raw != null && typeof raw === "object"
      ? hydrateLegacyGenerateNoteBody({
          ...(raw as Record<string, unknown>),
          therapySetting:
            typeof (raw as { therapySetting?: unknown }).therapySetting === "string"
              ? normalizeLegacyTherapySetting(
                  (raw as { therapySetting: string }).therapySetting,
                )
              : (raw as { therapySetting?: unknown }).therapySetting,
        })
      : raw;
  return GenerateNoteBody.parse(bodyIn);
}

export function generateNoteBodyErrorMessages(error: unknown): string[] {
  if (!(error instanceof ZodError)) return [];
  return error.issues.slice(0, 10).map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "request";
    return `${path}: ${issue.message}`;
  });
}
