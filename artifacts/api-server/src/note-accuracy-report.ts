/**
 * Per-note accuracy report (fail-open aid).
 *
 * The note-generation pipeline never blocks save: critical compliance failures and server-side
 * program remaps are surfaced only as free-text warnings today. This module turns those signals into
 * a structured, machine-readable report the UI can render so the RBT sees exactly what drifted from
 * the app selections and the locked rules. It NEVER changes save behavior.
 */

export type NoteAccuracyConfidence = "high" | "medium" | "low";

export type NoteAccuracyIssue = {
  code: string;
  severity: "blocking" | "warning";
  message: string;
  hourIndex?: number | null;
};

export type AlteredProgramSelection = {
  hourIndex: number;
  from?: string | null;
  to: string;
  reason: string;
};

export type NoteAccuracyReport = {
  confidence: NoteAccuracyConfidence;
  assessmentGrounded: boolean;
  selectionHonored: boolean;
  issues: NoteAccuracyIssue[];
  alteredSelections: AlteredProgramSelection[];
};

/**
 * Matches the swap messages emitted by `ensureReplacementProgramAlignmentForSegments` and its
 * helpers, e.g. `Segment 2 (Task Refusal): replacement program rebalanced from "A" to "B" ...`.
 */
const SWAP_MESSAGE_RE =
  /^(?:Segment|Hour)\s+(\d+)\s*\([^)]*\):\s*replacement program (?:rebalanced|auto-corrected)\s+from\s+"([^"]*)"\s+to\s+"([^"]*)"(.*)$/i;

/** Map the trailing explanation of a swap message to a short, stable reason keyword. */
export function reasonKeywordFromSwapTail(tail: string): string {
  const t = tail.toLowerCase();
  if (t.includes("wandering") || t.includes("elopement") || t.includes("proximity")) {
    return "safety-proximity";
  }
  if (t.includes("each abc uses a distinct")) return "distinctness";
  if (t.includes("unrelated behaviors/functions")) return "function-distinctness";
  if (t.includes("bip function alignment")) return "bip-function";
  return "rebalance";
}

/** Parse rebalance swap messages into structured altered-selection rows. Unparseable lines are skipped. */
export function parseAlteredSelectionsFromSwapMessages(
  messages: string[],
): AlteredProgramSelection[] {
  const out: AlteredProgramSelection[] = [];
  for (const raw of messages) {
    const m = SWAP_MESSAGE_RE.exec(raw.trim());
    if (!m) continue;
    const hourIndex = Number(m[1]) - 1;
    if (!Number.isInteger(hourIndex) || hourIndex < 0) continue;
    const from = m[2]?.trim() ?? "";
    const to = m[3]?.trim() ?? "";
    if (!to) continue;
    out.push({
      hourIndex,
      from: from.length > 0 ? from : null,
      to,
      reason: reasonKeywordFromSwapTail(m[4] ?? ""),
    });
  }
  return out;
}

/**
 * Programs the RBT selected for the session that never appear in the final per-hour assignments.
 * Comparison is trimmed + case-insensitive so BIP/catalog spelling differences do not cause false
 * "missing" reports.
 */
export function missingSelectedPrograms(params: {
  selectedProgramNames: string[];
  assignedProgramNames: string[];
}): string[] {
  const norm = (s: string): string => s.trim().toLowerCase();
  const assigned = new Set(params.assignedProgramNames.map(norm).filter((s) => s.length > 0));
  const seen = new Set<string>();
  const missing: string[] = [];
  for (const name of params.selectedProgramNames) {
    const key = norm(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (!assigned.has(key)) missing.push(name.trim());
  }
  return missing;
}

export function buildNoteAccuracyReport(params: {
  effectiveIssues: { code: string; severity: "blocking" | "warning"; message: string; paragraphIndex?: number | undefined }[];
  alteredSelections: AlteredProgramSelection[];
  missingSelectedProgramNames: string[];
  assessmentGrounded: boolean;
}): NoteAccuracyReport {
  const issues: NoteAccuracyIssue[] = params.effectiveIssues.map((issue) => ({
    code: issue.code,
    severity: issue.severity,
    message: issue.message,
    hourIndex: typeof issue.paragraphIndex === "number" ? issue.paragraphIndex : null,
  }));

  for (const name of params.missingSelectedProgramNames) {
    issues.push({
      code: "PROGRAM_COVERAGE",
      severity: "warning",
      message: `Selected program "${name}" was not documented in any hour of the note. Use ABC Builder to pin it to an hour, or review the generated assignments.`,
      hourIndex: null,
    });
  }

  const selectionHonored =
    params.missingSelectedProgramNames.length === 0 && params.alteredSelections.length === 0;

  const hasBlocking = issues.some((i) => i.severity === "blocking");
  const hasWarning = issues.some((i) => i.severity === "warning");

  let confidence: NoteAccuracyConfidence;
  if (hasBlocking || !selectionHonored) {
    confidence = "low";
  } else if (hasWarning) {
    confidence = "medium";
  } else {
    confidence = "high";
  }

  return {
    confidence,
    assessmentGrounded: params.assessmentGrounded,
    selectionHonored,
    issues,
    alteredSelections: params.alteredSelections,
  };
}
