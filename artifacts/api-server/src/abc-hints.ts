import { isValidAbcActivityAntecedent } from "./abc-activity-antecedent-catalog";

export type AbcHintInput = {
  activityAntecedent?: string | null;
  maladaptiveBehavior?: string | null;
  replacementProgramId?: number | null;
};

/**
 * Validates optional ABC Builder rows and merges maladaptive behavior assignments with rotation defaults.
 * Index h aligns with service hour h (0-based).
 */
export function resolveAbcHintsForNoteGeneration(
  hints: AbcHintInput[] | undefined,
  sessionHours: number,
  behaviorCatalog: string[],
  baseMaladaptiveForHour: string[],
):
  | {
      ok: true;
      activityAntecedentForHour: (string | null)[];
      maladaptiveBehaviorForHour: string[];
    }
  | { ok: false; messages: string[] } {
  const list = hints ?? [];
  if (list.length > sessionHours) {
    return {
      ok: false,
      messages: [
        `abcHints has ${list.length} entries but sessionHours is ${sessionHours}; send at most one row per hour (indices 0..${sessionHours - 1}).`,
      ],
    };
  }

  const behaviorSet = new Set(behaviorCatalog.map((s) => s.trim()).filter((s) => s.length > 0));
  const activityAntecedentForHour: (string | null)[] = Array.from({ length: sessionHours }, () => null);
  const maladaptiveBehaviorForHour = [...baseMaladaptiveForHour];
  const messages: string[] = [];

  for (let h = 0; h < list.length; h++) {
    const row = list[h] ?? {};
    const a = typeof row.activityAntecedent === "string" ? row.activityAntecedent.trim() : "";
    const b = typeof row.maladaptiveBehavior === "string" ? row.maladaptiveBehavior.trim() : "";

    if (!a && !b) {
      continue;
    }
    if ((a && !b) || (!a && b)) {
      messages.push(
        `abcHints[${h}]: provide both activityAntecedent and maladaptiveBehavior, or leave both empty for that hour.`,
      );
      continue;
    }

    if (!isValidAbcActivityAntecedent(a)) {
      messages.push(
        `abcHints[${h}]: activityAntecedent must be an exact catalog string from GET /notes/abc-builder/activity-antecedents.`,
      );
      continue;
    }
    if (!behaviorSet.has(b)) {
      messages.push(
        `abcHints[${h}]: maladaptiveBehavior must be an exact label from this client's authorized maladaptive behavior catalog.`,
      );
      continue;
    }

    activityAntecedentForHour[h] = a;
    maladaptiveBehaviorForHour[h] = b;
  }

  if (messages.length > 0) {
    return { ok: false, messages };
  }

  return { ok: true, activityAntecedentForHour, maladaptiveBehaviorForHour };
}
