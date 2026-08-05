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

export type GenerateNoteBlocker = {
  /** Wizard step the RBT must return to in order to clear this blocker. */
  step: number;
  message: string;
};

/**
 * Human-readable reasons the generate request cannot be built yet, in wizard order.
 * Mirrors the server contract in `notes-service.ts` so Continue/Generate is never
 * disabled without telling the RBT which selection to fix.
 */
export function describeGenerateNoteBlockers(
  data: WizardData,
  programLabel: (id: number) => string = (id) => `Program ${id}`,
): GenerateNoteBlocker[] {
  const blockers: GenerateNoteBlocker[] = [];
  const hours = data.sessionHours ?? 0;
  const selected = data.selectedReplacements ?? [];
  const hints = data.abcHints ?? [];
  const trials = data.programTrialData ?? {};

  if (data.clientId == null) {
    blockers.push({ step: 1, message: "Select a client." });
  }
  if (selected.length === 0) {
    blockers.push({ step: 2, message: "Select at least one replacement program." });
  }
  if (hours < 1) {
    blockers.push({ step: 3, message: "Choose the session length." });
  }
  if (typeof data.sessionDate !== "string" || !data.sessionDate.trim()) {
    blockers.push({ step: 4, message: "Choose the session date." });
  }
  if (typeof data.therapySetting !== "string" || !isTherapySetting(data.therapySetting)) {
    blockers.push({ step: 6, message: "Choose where the session took place." });
  }
  if (typeof data.hasEnvironmentalChanges !== "boolean") {
    blockers.push({ step: 7, message: "Answer the environmental changes question." });
  }
  if (hours < 1 || selected.length === 0) {
    return blockers;
  }

  if (hints.length !== hours) {
    blockers.push({
      step: 8,
      message: `ABC Builder needs one row per service hour (${hours} required, ${hints.length} present). Open ABC Builder to rebuild the rows.`,
    });
  }

  const assigned = new Set<number>();
  for (let hour = 0; hour < Math.min(hours, hints.length); hour++) {
    const id = hints[hour]?.replacementProgramId ?? null;
    if (id == null || !selected.includes(id)) {
      blockers.push({ step: 8, message: `Hour ${hour + 1} needs one of the selected programs.` });
      continue;
    }
    assigned.add(id);
  }
  // Extra selected programs beyond the hours are ignored — only assigned hours matter.
  for (const id of assigned) {
    const count = trials[String(id)]?.count;
    if (count == null || count < 1) {
      blockers.push({
        step: 2,
        message: `"${programLabel(id)}" has no criterion percentage. Set "How many trials met criterion?" on the Replacement Programs step.`,
      });
    }
  }
  return blockers;
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
  // Extra selected programs with no hourly row are fine — generation uses abcHints only.

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
