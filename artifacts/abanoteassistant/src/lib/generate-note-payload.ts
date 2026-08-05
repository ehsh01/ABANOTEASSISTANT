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

/** Blank criterion percentage → 0 of 10 trials met criterion. */
export const ZERO_CRITERION_TRIAL_ENTRY: ProgramTrialDataEntry = {
  count: 10,
  effectiveTrials: [],
};

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

/**
 * Prefer one distinct program per hour: selected programs first, then other linked
 * client programs. Later duplicate hours are replaced with unused linked programs
 * when the catalog has extras.
 */
export function resolveHourlyProgramIds(params: {
  sessionHours: number;
  hintProgramIds: (number | null | undefined)[];
  selectedIds: number[];
  linkedIds: number[];
}): number[] {
  const linkedSet = new Set(params.linkedIds);
  const selectedLinked = params.selectedIds.filter((id) => linkedSet.has(id));
  const otherLinked = params.linkedIds.filter((id) => !selectedLinked.includes(id));
  const fillPool = [...selectedLinked, ...otherLinked];
  if (fillPool.length === 0) return [];

  const resolved: number[] = [];
  for (let hour = 0; hour < params.sessionHours; hour++) {
    const hinted = params.hintProgramIds[hour] ?? null;
    if (hinted != null && linkedSet.has(hinted)) {
      resolved.push(hinted);
      continue;
    }
    const used = new Set(resolved);
    const unused = fillPool.find((id) => !used.has(id));
    resolved.push(unused ?? fillPool[hour % fillPool.length]!);
  }

  const unused = fillPool.filter((id) => !resolved.includes(id));
  for (let hour = 0; hour < resolved.length && unused.length > 0; hour++) {
    const id = resolved[hour]!;
    const firstIndex = resolved.indexOf(id);
    if (hour !== firstIndex) {
      resolved[hour] = unused.shift()!;
    }
  }
  return resolved;
}

export type GenerateNoteBlocker = {
  /** Wizard step the RBT must return to in order to clear this blocker. */
  step: number;
  message: string;
};

/**
 * Human-readable reasons the generate request cannot be built yet, in wizard order.
 * Missing percentages are not blockers — they default to "did not meet criterion" (0%).
 */
export function describeGenerateNoteBlockers(
  data: WizardData,
  _programLabel: (id: number) => string = (id) => `Program ${id}`,
  linkedProgramIds: number[] = [],
): GenerateNoteBlocker[] {
  const blockers: GenerateNoteBlocker[] = [];
  const hours = data.sessionHours ?? 0;
  const selected = data.selectedReplacements ?? [];
  const hints = data.abcHints ?? [];

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

  const linkedSet = new Set(
    linkedProgramIds.length > 0 ? linkedProgramIds : selected,
  );
  for (let hour = 0; hour < Math.min(hours, hints.length); hour++) {
    const id = hints[hour]?.replacementProgramId ?? null;
    // Null is fine — generation auto-fills from the client program list.
    if (id != null && !linkedSet.has(id) && !selected.includes(id)) {
      blockers.push({
        step: 8,
        message: `Hour ${hour + 1} has a program that is not linked to this client.`,
      });
    }
  }
  return blockers;
}

/** Build the POST /notes/generate body from wizard store data (shared by wizard + result regenerate). */
export function toGenerateNoteRequest(
  data: WizardData,
  linkedProgramIds: number[] = [],
): GenerateNoteRequest | null {
  if (
    data.clientId == null ||
    data.sessionHours == null ||
    typeof data.sessionDate !== "string" ||
    !data.sessionDate.trim() ||
    typeof data.hasEnvironmentalChanges !== "boolean" ||
    !Array.isArray(data.presentPeople) ||
    !Array.isArray(data.selectedReplacements) ||
    data.selectedReplacements.length === 0 ||
    !Array.isArray(data.abcHints) ||
    data.abcHints.length !== data.sessionHours ||
    data.therapySetting == null ||
    !isTherapySetting(data.therapySetting)
  ) {
    return null;
  }

  const linkedIds =
    linkedProgramIds.length > 0 ? linkedProgramIds : data.selectedReplacements;
  const resolvedIds = resolveHourlyProgramIds({
    sessionHours: data.sessionHours,
    hintProgramIds: data.abcHints.map((row) => row.replacementProgramId),
    selectedIds: data.selectedReplacements,
    linkedIds,
  });
  if (resolvedIds.length !== data.sessionHours) return null;

  const abcHints: AbcHintEntry[] = data.abcHints.map((row, i) => ({
    activityAntecedent: row.activityAntecedent?.trim() || null,
    maladaptiveBehavior: row.maladaptiveBehavior?.trim() || null,
    replacementProgramId: resolvedIds[i]!,
  }));

  const selectedReplacements = [
    ...new Set([...data.selectedReplacements, ...resolvedIds]),
  ];

  const programTrialData: NonNullable<GenerateNoteRequest["programTrialData"]> = {};
  for (const id of resolvedIds) {
    const raw = data.programTrialData?.[String(id)];
    programTrialData[String(id)] = raw
      ? normalizeProgramTrialEntry(raw)
      : { ...ZERO_CRITERION_TRIAL_ENTRY };
    // Blank count → treat as did not meet criterion.
    if (programTrialData[String(id)]!.count == null) {
      programTrialData[String(id)] = { ...ZERO_CRITERION_TRIAL_ENTRY };
    }
  }

  const body: GenerateNoteRequest = {
    clientId: data.clientId,
    sessionHours: data.sessionHours,
    sessionDate: data.sessionDate.trim(),
    therapySetting: data.therapySetting,
    presentPeople: data.presentPeople,
    hasEnvironmentalChanges: data.hasEnvironmentalChanges,
    selectedReplacements,
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
