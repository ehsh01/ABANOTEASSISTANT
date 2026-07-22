import { GenerateNoteBody } from "@workspace/api-zod";
import { normalizeLegacyTherapySetting } from "@workspace/therapy-settings";
import { ZodError } from "zod";

export function parseGenerateNoteBody(
  raw: unknown,
): ReturnType<typeof GenerateNoteBody.parse> {
  const bodyIn =
    raw != null && typeof raw === "object"
      ? {
          ...(raw as Record<string, unknown>),
          therapySetting:
            typeof (raw as { therapySetting?: unknown }).therapySetting === "string"
              ? normalizeLegacyTherapySetting(
                  (raw as { therapySetting: string }).therapySetting,
                )
              : (raw as { therapySetting?: unknown }).therapySetting,
        }
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
