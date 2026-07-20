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
    !Array.isArray(data.abcHints) ||
    data.abcHints.length !== data.sessionHours ||
    data.programTrialData == null ||
    data.therapySetting == null ||
    !isTherapySetting(data.therapySetting)
  ) {
    return null;
  }

  const abcHints: AbcHintEntry[] = data.abcHints.map((row) => ({
    activityAntecedent: row.activityAntecedent?.trim() || null,
    maladaptiveBehavior: row.maladaptiveBehavior?.trim() || null,
    replacementProgramId: row.replacementProgramId,
  }));
  const validAssignments = abcHints.every(
    (row) =>
      row.replacementProgramId != null &&
      data.selectedReplacements!.includes(row.replacementProgramId) &&
      data.programTrialData?.[String(row.replacementProgramId)]?.count != null,
  );
  if (!validAssignments) return null;

  const programTrialData: NonNullable<GenerateNoteRequest["programTrialData"]> = {};
  for (const row of abcHints) {
    const id = row.replacementProgramId!;
    programTrialData[String(id)] = normalizeProgramTrialEntry(data.programTrialData[String(id)]!);
  }

  const body: GenerateNoteRequest = {
    clientId: data.clientId,
    sessionHours: data.sessionHours,
    sessionDate: data.sessionDate.trim(),
    therapySetting: data.therapySetting,
    presentPeople: data.presentPeople,
    hasEnvironmentalChanges: data.hasEnvironmentalChanges,
    selectedReplacements: data.selectedReplacements,
    abcHints,
    programTrialData,
  };
  const env = data.environmentalChanges?.trim();
  if (env) {
    body.environmentalChanges = env;
  }
  const next = data.nextSessionDate?.trim();
  if (next) {
    body.nextSessionDate = next;
  }
  return body;
}
