import {
  readAiCache,
  type AiCacheStore,
} from "./ai-cache";
import type { GenerateClinicalBodyResult } from "./openai-notes";

function parseCachedNoteGeneration(
  value: unknown,
): GenerateClinicalBodyResult | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<GenerateClinicalBodyResult>;
  if (
    typeof candidate.body !== "string" ||
    candidate.body.trim().length === 0 ||
    !candidate.notePlan ||
    !Array.isArray(candidate.notePlan.segments) ||
    candidate.notePlan.segments.length === 0 ||
    typeof candidate.modelUsed !== "string"
  ) {
    return null;
  }
  return {
    ...candidate,
    warnings: Array.isArray(candidate.warnings) ? candidate.warnings : [],
    repairAttempts: candidate.repairAttempts ?? 0,
    finalIssues: Array.isArray(candidate.finalIssues)
      ? candidate.finalIssues
      : [],
    finalPlanIssues: Array.isArray(candidate.finalPlanIssues)
      ? candidate.finalPlanIssues
      : [],
    attemptHistory: [],
    rawModelOutputs: [],
    repairActions: ["Loaded an identical request from the AI response cache."],
  } as GenerateClinicalBodyResult;
}

export async function readCachedNoteGeneration(params: {
  forceRegenerate: boolean;
  companyId: number;
  cacheKey: string;
  model: string;
  store?: AiCacheStore;
}): Promise<GenerateClinicalBodyResult | null> {
  if (params.forceRegenerate) return null;
  return readAiCache({
    feature: "note",
    companyId: params.companyId,
    cacheKey: params.cacheKey,
    model: params.model,
    parse: parseCachedNoteGeneration,
    store: params.store,
  });
}
