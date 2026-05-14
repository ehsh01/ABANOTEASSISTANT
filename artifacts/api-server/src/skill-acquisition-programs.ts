/**
 * Replacement programs that are pure skill-acquisition targets: narratives must not
 * frame them with a maladaptive behavior catalog label (no "manifested [behavior]").
 *
 * Patterns are case-insensitive and tolerate the small spacing/casing variations seen
 * in BIPs and intake (e.g. "ABLLS-R" vs "ABLLS -R", "Echoic" vs "Echoic Skills",
 * "Respond to own name" vs "Response to her name", PECS request line variants).
 */

const SKILL_ACQUISITION_PATTERNS: RegExp[] = [
  /\brespond(?:ing)?\s+to\s+(?:own|his|her|their)\s+name\b/i,
  /\bresponse\s+to\s+(?:own|his|her|their)\s+name\b/i,
  /\bechoic\b/i,
  /\bmanding\b/i,
  /\bpre-?requisite\s+skills?\b/i,
  /\bimprove\s+eye\s+contact\b/i,
  /\battract\s+others?\s+attention\b/i,
  /\bimitate\s+other\s+actions?\b/i,
  /\b(?:request|requesting)\s+access\s+to\s+item\s+activity\s+pecs?\b/i,
  /\bpecs?\s+or\s+pointing\b/i,
  /\btransition\s+compatible\s+with\s+ablls\s*-?\s*r\s+code\s+n\s*4\b/i,
];

/**
 * True when this segment's assigned replacement program is a skill-only target
 * (Echoic, Manding, Pre-requisite Skills, Respond to Own Name, Improve eye contact,
 * Attract others' attention, Imitate other actions, PECS request after one prompt,
 * Transition Compatible with ABLLS-R Code N4, etc.). Names from intake / BIP are
 * matched against well-known catalog wording; case-insensitive substring patterns.
 */
export function isSkillAcquisitionOnlyReplacementProgram(programName: string): boolean {
  const t = programName.trim();
  if (!t) return false;
  for (const re of SKILL_ACQUISITION_PATTERNS) {
    if (re.test(t)) return true;
  }
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
