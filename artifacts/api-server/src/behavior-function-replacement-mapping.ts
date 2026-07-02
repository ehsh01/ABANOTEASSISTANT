import type { ClinicalFunction } from "@workspace/db/schema";

/** When multiple functions are documented, prefer escape → tangible → attention for replacement selection. */
const FUNCTION_PRIORITY: ClinicalFunction[] = ["escape", "tangible", "attention", "automatic"];

export function primaryFunctionForReplacementSelection(
  functions: ClinicalFunction[] | null | undefined,
): ClinicalFunction | null {
  if (!functions || functions.length === 0) return null;
  for (const fn of FUNCTION_PRIORITY) {
    if (functions.includes(fn)) return fn;
  }
  return null;
}

/** Elopement / wandering / safety-navigation behaviors — only category that may use leave-area safety programs. */
export function isElopementSafetyNavigationBehavior(behaviorName: string): boolean {
  const b = behaviorName.trim().toLowerCase();
  return (
    /\belope/.test(b) ||
    /\bwandering\b/.test(b) ||
    /\bbolting\b/.test(b) ||
    /\brunning\s+away\b/.test(b) ||
    /\bclimbing\b/.test(b)
  );
}

/** "Request permission to leave the unsupervised area" and close variants — safety navigation only. */
export function isSafetyLeaveAreaReplacementProgram(programName: string): boolean {
  const p = programName.trim().toLowerCase();
  return (
    /request\s+permission\s+to\s+leave/.test(p) ||
    (/unsupervised/.test(p) && /area/.test(p)) ||
    /leave\s+the\s+unsupervised/.test(p)
  );
}

export function replacementProgramMatchesFunctionCategory(
  programName: string,
  fn: ClinicalFunction,
): boolean {
  const p = programName.trim().toLowerCase();
  if (!p) return false;

  switch (fn) {
    case "escape":
      return (
        /request\s+for\s+break/.test(p) ||
        /follow\s+instructions?/.test(p) ||
        /compliance\s+training/.test(p) ||
        /remaining\s+seated/.test(p) ||
        /completing\s+task/.test(p) ||
        /time\s+on\s+task/.test(p) ||
        /schedule\s+of\s+activit/.test(p) ||
        /follow.*non-preferred|following non-preferred|follow.*demand/.test(p) ||
        /^on task behavior$/.test(p)
      );
    case "tangible":
      return (
        /request\s+for\s+tangible/.test(p) ||
        /accept.*\bno\b/.test(p) ||
        /sharing.*take turns|take turns.*shar/.test(p) ||
        /accepting\s+alternatives/.test(p) ||
        /making\s+choices/.test(p) ||
        /accept.*alternative/.test(p)
      );
    case "attention":
      return (
        /express.*opinion|agreement.*disagreement|accept.*opinion/.test(p) ||
        /appropriate social skills/.test(p) ||
        /functional communication.*attention|request attention|communication to request attention/.test(p) ||
        /sharing.*take turns|take turns.*shar/.test(p) ||
        /accepting\s+alternatives/.test(p) ||
        /making\s+choices/.test(p) ||
        /functional communication|\bfct\b/.test(p)
      );
    case "automatic":
      return false;
    default:
      return false;
  }
}

/**
 * Definitive mismatches: safety leave-area programs on non-elopement behaviors;
 * function-documented episodes paired with programs outside that function category.
 */
export function isFunctionMisfitReplacement(
  behaviorName: string,
  programName: string,
  behaviorFunctions: ClinicalFunction[] | null | undefined,
): boolean {
  const behavior = behaviorName.trim();
  const program = programName.trim();
  if (!behavior || !program) return false;

  if (isSafetyLeaveAreaReplacementProgram(program) && !isElopementSafetyNavigationBehavior(behavior)) {
    return true;
  }

  const primary = primaryFunctionForReplacementSelection(behaviorFunctions);
  if (!primary || primary === "automatic") return false;

  if (isSafetyLeaveAreaReplacementProgram(program)) {
    return !isElopementSafetyNavigationBehavior(behavior);
  }

  return !replacementProgramMatchesFunctionCategory(program, primary);
}

/** Ordered predicates for authorized programs that match the documented primary function. */
export function functionBasedReplacementPredicates(
  primaryFunction: ClinicalFunction,
): ((programName: string) => boolean)[] {
  return [(n) => replacementProgramMatchesFunctionCategory(n, primaryFunction)];
}
