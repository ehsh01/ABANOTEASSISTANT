import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  OFFLINE_NOTE_EVAL_THRESHOLDS,
  runOfflineNoteEvaluation,
} from "./evaluator";

describe("offline note evaluation release gate", () => {
  it("passes the frozen corpus at strict thresholds with stable hashes", () => {
    const report = runOfflineNoteEvaluation();
    assert.equal(OFFLINE_NOTE_EVAL_THRESHOLDS.strictPassRate, 1);
    assert.equal(report.metrics.strictPassRate, 1);
    assert.equal(report.metrics.criticalPassRate, 1);
    assert.equal(report.metrics.firstPassRate, 1);
    assert.equal(report.metrics.repairAttempts, 0);
    assert.deepEqual(report.metrics.issueCodeCounts, {});
    assert.equal(report.metrics.deterministicOutputHashStable, true);
    assert.equal(report.passed, true);
  });

  it("fails when a fixture drops its exact hourly program", () => {
    const report = runOfflineNoteEvaluation([
      {
        id: "broken-hourly-program",
        tags: ["exact-program"],
        setting: "Home",
        assessmentExcerpt: "Task refusal is documented.",
        profileBehaviors: ["Task refusal"],
        profileInterventions: ["Premack Principle"],
        hourlyAssignments: [
          {
            programId: 1,
            programName: "Compliance Training",
            criterionPercentage: 20,
          },
        ],
        paragraphs: ["The RBT implemented Time on Task; 20% of trials met criterion."],
      },
    ]);
    assert.equal(report.passed, false);
    assert.equal(report.metrics.issueCodeCounts.PROGRAM_MISSING, 1);
  });
});
