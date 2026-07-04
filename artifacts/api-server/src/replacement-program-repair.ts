import { escapeRegExp } from "./note-normalization";

/** Rewrite a paragraph when the server corrected replacementProgramForHour after generation. */
export function rewriteParagraphReplacementProgramName(
  paragraph: string,
  oldProgram: string,
  newProgram: string,
): string {
  if (!oldProgram.trim() || oldProgram === newProgram) return paragraph;
  let out = paragraph;
  const oldEsc = escapeRegExp(oldProgram);
  const replacementSentenceRe = new RegExp(
    `(replacement program\\s+["'])${oldEsc}(["'])`,
    "gi",
  );
  out = out.replace(replacementSentenceRe, `$1${newProgram}$2`);
  if (out.includes(oldProgram)) {
    out = out.split(oldProgram).join(newProgram);
  }
  return out;
}

/**
 * When replacement program assignments are corrected after the AI draft, update each affected
 * clinical paragraph so the verbatim replacement-program sentence matches the new assignment.
 */
export function repairClinicalBodyReplacementProgramAssignments(
  clinicalBody: string,
  previousAssignments: string[],
  newAssignments: string[],
): string {
  const paragraphs = clinicalBody.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const count = Math.min(paragraphs.length, previousAssignments.length, newAssignments.length);
  for (let i = 0; i < count; i++) {
    const oldName = previousAssignments[i]?.trim() ?? "";
    const newName = newAssignments[i]?.trim() ?? "";
    if (!oldName || !newName || oldName === newName) continue;
    paragraphs[i] = rewriteParagraphReplacementProgramName(paragraphs[i]!, oldName, newName);
  }
  return paragraphs.join("\n\n");
}
