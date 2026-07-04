import type {
  AbcHintEntry,
  GenerateNoteRequest,
  ProgramTrialDataEntry,
} from "@workspace/api-client-react";
import { ApiError } from "@workspace/api-client-react";
import { isTherapySetting } from "@workspace/therapy-settings";
import type { WizardData } from "@/store/wizard-store";

/** Wizard + generate request: total trials and per-trial indices are capped at 10. */
export const MAX_PROGRAM_TRIALS = 10;

export function formatGenerateNoteFailure(err: unknown): string {
  if (err instanceof ApiError && err.data && typeof err.data === "object") {
    const d = err.data as { error?: string; messages?: string[] };
    const chunks = [
      d.error,
      ...(Array.isArray(d.messages) ? d.messages.filter((m) => typeof m === "string" && m.trim()) : []),
    ].filter(Boolean) as string[];
    if (chunks.length > 0) {
      return chunks.join(" ");
    }
  }
  return err instanceof Error ? err.message : String(err);
}

/** True when POST /notes/generate returned 429 unsaved-draft cap. */
export function isDraftQuotaError(err: unknown): boolean {
  if (err instanceof ApiError && err.status === 429) return true;
  return isDraftQuotaMessage(formatGenerateNoteFailure(err));
}

export function isDraftQuotaMessage(message: string): boolean {
  return /maximum of \d+ generated drafts/i.test(message);
}

export function normalizeProgramTrialEntry(
  entry: Partial<ProgramTrialDataEntry> & { effectiveTrials?: number[] },
): ProgramTrialDataEntry {
  let count = entry.count ?? null;
  if (count != null) {
    if (!Number.isFinite(count) || !Number.isInteger(count)) {
      count = null;
    } else {
      count = Math.min(MAX_PROGRAM_TRIALS, Math.max(1, count));
    }
  }
  const cap = count ?? MAX_PROGRAM_TRIALS;
  const effectiveTrials = [...(entry.effectiveTrials ?? [])]
    .filter((t) => typeof t === "number" && Number.isInteger(t) && t >= 1 && t <= cap)
    .sort((a, b) => a - b);
  return { count, effectiveTrials };
}

/** Build the POST /notes/generate body from wizard store data (shared by wizard + result regenerate). */
export function toGenerateNoteRequest(data: WizardData): GenerateNoteRequest | null {
  if (
    data.clientId == null ||
    data.sessionHours == null ||
    typeof data.sessionDate !== "string" ||
    !data.sessionDate.trim() ||
    typeof data.hasEnvironmentalChanges !== "boolean" ||
    !Array.isArray(data.presentPeople) ||
    !Array.isArray(data.selectedReplacements) ||
    data.therapySetting == null ||
    !isTherapySetting(data.therapySetting)
  ) {
    return null;
  }
  const body: GenerateNoteRequest = {
    clientId: data.clientId,
    sessionHours: data.sessionHours,
    sessionDate: data.sessionDate.trim(),
    therapySetting: data.therapySetting,
    presentPeople: data.presentPeople,
    hasEnvironmentalChanges: data.hasEnvironmentalChanges,
    selectedReplacements: data.selectedReplacements,
  };
  const env = data.environmentalChanges?.trim();
  if (env) {
    body.environmentalChanges = env;
  }
  const next = data.nextSessionDate?.trim();
  if (next) {
    body.nextSessionDate = next;
  }
  if (Array.isArray(data.abcHints)) {
    const capped = data.abcHints.slice(0, data.sessionHours);
    const cleaned: AbcHintEntry[] = capped.map((row) => {
      const hasActivity = !!row.activityAntecedent;
      const hasBehavior = !!row.maladaptiveBehavior;
      const pid = row.replacementProgramId ?? null;
      if (hasActivity && hasBehavior) {
        return {
          activityAntecedent: row.activityAntecedent,
          maladaptiveBehavior: row.maladaptiveBehavior,
          replacementProgramId: pid,
        };
      }
      if (hasActivity !== hasBehavior) {
        return { activityAntecedent: null, maladaptiveBehavior: null, replacementProgramId: pid };
      }
      return { activityAntecedent: null, maladaptiveBehavior: null, replacementProgramId: pid };
    });
    const hasAny = cleaned.some((r) => !!r.activityAntecedent || r.replacementProgramId != null);
    if (hasAny) {
      body.abcHints = cleaned;
    }
  }
  if (data.programTrialData != null && Object.keys(data.programTrialData).length > 0) {
    const clamped: NonNullable<GenerateNoteRequest["programTrialData"]> = {};
    for (const [k, v] of Object.entries(data.programTrialData)) {
      clamped[k] = normalizeProgramTrialEntry(v);
    }
    body.programTrialData = clamped;
  }
  return body;
}
