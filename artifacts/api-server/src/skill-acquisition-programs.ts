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
