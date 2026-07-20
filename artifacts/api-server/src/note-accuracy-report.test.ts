import { describe, expect, it } from "vitest";
import {
  buildNoteAccuracyReport,
  missingSelectedPrograms,
  parseAlteredSelectionsFromSwapMessages,
  reasonKeywordFromSwapTail,
} from "./note-accuracy-report";
import { deterministicRotationSeed } from "./note-scheduling";
import { buildModelAssessmentExcerpt, MAX_MODEL_ASSESSMENT_EXCERPT_CHARS } from "./note-plan-validation";

describe("deterministicRotationSeed", () => {
  it("is stable for identical inputs and independent of program selection order", () => {
    const a = deterministicRotationSeed({
      clientId: 7,
      sessionDate: "2026-07-20",
      sessionHours: 3,
      selectedReplacements: [3, 1, 2],
    });
    const b = deterministicRotationSeed({
      clientId: 7,
      sessionDate: "2026-07-20",
      sessionHours: 3,
      selectedReplacements: [1, 2, 3],
    });
    expect(a).toBe(b);
  });

  it("changes when a stable input changes", () => {
    const base = deterministicRotationSeed({
      clientId: 7,
      sessionDate: "2026-07-20",
      sessionHours: 3,
      selectedReplacements: [1, 2, 3],
    });
    const differentDate = deterministicRotationSeed({
      clientId: 7,
      sessionDate: "2026-07-21",
      sessionHours: 3,
      selectedReplacements: [1, 2, 3],
    });
    expect(differentDate).not.toBe(base);
  });
});

describe("buildModelAssessmentExcerpt", () => {
  it("scrubs learner names and caps length", () => {
    const scrubbed = buildModelAssessmentExcerpt(
      "Johnny engages in task refusal when his mother presents demands.",
      ["Johnny"],
    );
    expect(scrubbed).not.toMatch(/Johnny/i);
    expect(scrubbed).toMatch(/the client/i);
    expect(scrubbed).not.toMatch(/mother/i);
  });

  it("returns empty string for blank input", () => {
    expect(buildModelAssessmentExcerpt("", ["Johnny"])).toBe("");
    expect(buildModelAssessmentExcerpt("   ", ["Johnny"])).toBe("");
  });

  it("caps very long excerpts", () => {
    const long = "The client refuses tasks. ".repeat(1000);
    const scrubbed = buildModelAssessmentExcerpt(long, []);
    expect(scrubbed.length).toBeLessThanOrEqual(MAX_MODEL_ASSESSMENT_EXCERPT_CHARS);
  });
});

describe("parseAlteredSelectionsFromSwapMessages", () => {
  it("parses rebalanced and auto-corrected swap lines", () => {
    const rows = parseAlteredSelectionsFromSwapMessages([
      'Segment 2 (Task Refusal): replacement program rebalanced from "Follow demands after the first prompt" to "Request Help" so each ABC uses a distinct replacement program.',
      'Hour 3 (Wandering Away): replacement program auto-corrected from "Time on task" to "Walk within close distance of adult (Safety Skills)" for BIP function alignment.',
      "some unrelated warning line",
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      hourIndex: 1,
      from: "Follow demands after the first prompt",
      to: "Request Help",
      reason: "distinctness",
    });
    expect(rows[1]).toEqual({
      hourIndex: 2,
      from: "Time on task",
      to: "Walk within close distance of adult (Safety Skills)",
      reason: "bip-function",
    });
  });

  it("maps swap tails to reason keywords", () => {
    expect(reasonKeywordFromSwapTail("to match wandering/elopement with the approved proximity")).toBe(
      "safety-proximity",
    );
    expect(reasonKeywordFromSwapTail("so unrelated behaviors/functions do not share")).toBe(
      "function-distinctness",
    );
    expect(reasonKeywordFromSwapTail("for BIP function alignment.")).toBe("bip-function");
    expect(reasonKeywordFromSwapTail("something else")).toBe("rebalance");
  });
});

describe("missingSelectedPrograms", () => {
  it("flags selected programs that never got assigned (case/space insensitive)", () => {
    const missing = missingSelectedPrograms({
      selectedProgramNames: ["Request Help", "FCT", "Follow demands after the first prompt"],
      assignedProgramNames: ["follow demands after the first prompt", "Request Help"],
    });
    expect(missing).toEqual(["FCT"]);
  });

  it("returns empty when every selection is documented", () => {
    expect(
      missingSelectedPrograms({
        selectedProgramNames: ["A", "B"],
        assignedProgramNames: ["B", "A"],
      }),
    ).toEqual([]);
  });
});

describe("buildNoteAccuracyReport confidence", () => {
  const clean = {
    effectiveIssues: [],
    alteredSelections: [],
    missingSelectedProgramNames: [],
    assessmentGrounded: true,
  };

  it("is high when clean and every selection honored", () => {
    const report = buildNoteAccuracyReport(clean);
    expect(report.confidence).toBe("high");
    expect(report.selectionHonored).toBe(true);
    expect(report.assessmentGrounded).toBe(true);
  });

  it("is medium when only warnings exist", () => {
    const report = buildNoteAccuracyReport({
      ...clean,
      effectiveIssues: [{ code: "SUBJECTIVE_LANGUAGE", severity: "warning", message: "soft" }],
    });
    expect(report.confidence).toBe("medium");
  });

  it("is low when a blocking issue was demoted-and-saved", () => {
    const report = buildNoteAccuracyReport({
      ...clean,
      effectiveIssues: [{ code: "INTERVENTION_COUNT", severity: "blocking", message: "bad" }],
    });
    expect(report.confidence).toBe("low");
  });

  it("is low when a selected program was altered or dropped", () => {
    const altered = buildNoteAccuracyReport({
      ...clean,
      alteredSelections: [{ hourIndex: 0, from: "A", to: "B", reason: "distinctness" }],
    });
    expect(altered.confidence).toBe("low");
    expect(altered.selectionHonored).toBe(false);

    const dropped = buildNoteAccuracyReport({ ...clean, missingSelectedProgramNames: ["FCT"] });
    expect(dropped.confidence).toBe("low");
    expect(dropped.selectionHonored).toBe(false);
    expect(dropped.issues.some((i) => i.code === "PROGRAM_COVERAGE")).toBe(true);
  });
});
