/**
 * Replacement programs that are pure skill-acquisition targets: narratives must not
 * frame them with a maladaptive behavior catalog label (no "manifested [behavior]").
 */

const RESPOND_TO_OWN_NAME = /^respond\s+to\s+own\s+name$/i;

/** Echoic / echoic skills / DRA-Echoic style program names (substring match, case-insensitive). */
const ECHOIC_PROGRAM = /\bechoic/i;

/**
 * True when this segment's assigned replacement program is a skill-only target
 * (Respond to Own Name, or any program name containing "echoic").
 */
export function isSkillAcquisitionOnlyReplacementProgram(programName: string): boolean {
  const t = programName.trim();
  if (!t) return false;
  if (RESPOND_TO_OWN_NAME.test(t)) return true;
  if (ECHOIC_PROGRAM.test(t)) return true;
  return false;
}

/** One maladaptive-behavior row for billing/review integrations (excludes skill-acquisition-only segments). */
export type MaladaptiveReplacementPairingRow = {
  segmentIndex: number;
  maladaptiveBehavior: string;
  replacementProgramName: string;
};

/**
 * Builds **maladaptive catalog behavior → replacement program** pairings for the collapsed narrative segments.
 * **Omits** indices where `acquisitionOnlySegmentForHour[i]` is true (Echoic-style / Respond to Own Name programs),
 * so consumers never place a replacement program name in a "Behavior → Response" behavior slot for those segments.
 */
export function maladaptiveReplacementPairingsForSessionNote(params: {
  acquisitionOnlySegmentForHour: boolean[];
  maladaptiveBehaviorForNarrative: string[];
  replacementProgramForHour: string[];
}): MaladaptiveReplacementPairingRow[] {
  const { acquisitionOnlySegmentForHour, maladaptiveBehaviorForNarrative, replacementProgramForHour } = params;
  const n = acquisitionOnlySegmentForHour.length;
  const out: MaladaptiveReplacementPairingRow[] = [];
  for (let i = 0; i < n; i++) {
    if (acquisitionOnlySegmentForHour[i]) continue;
    const b = (maladaptiveBehaviorForNarrative[i] ?? "").trim();
    if (!b) continue;
    out.push({
      segmentIndex: i,
      maladaptiveBehavior: b,
      replacementProgramName: (replacementProgramForHour[i] ?? "").trim(),
    });
  }
  return out;
}
