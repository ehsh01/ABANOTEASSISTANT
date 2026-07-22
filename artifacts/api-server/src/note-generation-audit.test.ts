import { describe, expect, it } from "vitest";
import {
  buildNoteGenerationAuditEntry,
  hashAuditArtifact,
  hashNoteGenerationContext,
  type BuildNoteGenerationAuditEntryInput,
} from "./note-generation-audit";

const SENSITIVE_TEXT = "Alexandra pushed the red tablet";

function input(
  overrides: Partial<BuildNoteGenerationAuditEntryInput> = {},
): BuildNoteGenerationAuditEntryInput {
  return {
    companyId: 1,
    clientId: 2,
    noteId: null,
    model: "mock-model",
    promptVersion: "phase4-test",
    promptHash: "prompt-hash",
    contextHash: "context-hash",
    sessionDate: "2026-07-14",
    sessionHours: 1,
    repairAttempts: 1,
    validatorIssues: [`Validator detail: ${SENSITIVE_TEXT}`],
    criticalIssues: [`Critical detail: ${SENSITIVE_TEXT}`],
    finalStatus: "saved",
    assessmentFilename: "Alexandra-treatment-plan.pdf",
    assessmentText: `Assessment detail: ${SENSITIVE_TEXT}`,
    assessmentExcerptLength: 32,
    assessmentExcerptTruncated: false,
    rawModelOutputs: [JSON.stringify({ clinical: SENSITIVE_TEXT })],
    clinicalBody: `Clinical body: ${SENSITIVE_TEXT}`,
    finalNoteText: `Final note: ${SENSITIVE_TEXT}`,
    finalValidatorIssues: [
      { code: "BEHAVIOR_ASSIGNMENT", severity: "blocking", paragraphIndex: 0 },
      { code: "LANGUAGE_OBJECTIVITY", severity: "warning", paragraphIndex: 1 },
    ],
    finalCriticalIssues: [
      { code: "BEHAVIOR_ASSIGNMENT", severity: "blocking", paragraphIndex: 0 },
    ],
    attemptHistory: [
      {
        attempt: 0,
        latencyMs: 40,
        completionId: "completion-1",
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        planIssues: [
          {
            code: "BEHAVIOR_ASSIGNMENT",
            message: SENSITIVE_TEXT,
            severity: "advisory",
            segmentIndex: 0,
          },
        ],
        proseIssues: [
          {
            code: "LANGUAGE_OBJECTIVITY",
            severity: "warning",
            message: SENSITIVE_TEXT,
            paragraphIndex: 1,
          },
        ],
        passed: false,
      },
      {
        attempt: 1,
        latencyMs: 60,
        completionId: "completion-2",
        usage: { promptTokens: 12, completionTokens: 18, totalTokens: 30 },
        planIssues: [],
        proseIssues: [],
        passed: true,
      },
    ],
    repairActions: [`repair detail: ${SENSITIVE_TEXT}`],
    warnings: [`warning detail: ${SENSITIVE_TEXT}`],
    ...overrides,
  };
}

describe("note-generation audit payloads", () => {
  it("uses stable canonical hashes", () => {
    expect(hashNoteGenerationContext({ b: 2, a: 1 })).toBe(
      hashNoteGenerationContext({ a: 1, b: 2 }),
    );
    expect(hashAuditArtifact("same")).toBe(hashAuditArtifact("same"));
    expect(hashAuditArtifact("same")).not.toBe(hashAuditArtifact("different"));
  });

  it("removes all known free text by default while retaining codes, hashes, and counts", () => {
    const entry = buildNoteGenerationAuditEntry(input({ env: {} }));
    const serialized = JSON.stringify(entry);
    expect(serialized).not.toContain("Alexandra");
    expect(serialized).not.toContain("red tablet");
    expect(serialized).not.toContain("treatment-plan.pdf");
    expect(entry.rawModelJson).toBeNull();
    expect(entry.finalNoteText).toBeNull();
    expect(entry.assessmentFilename).toBeNull();
    expect(entry.validatorIssues).toEqual([]);
    expect(entry.criticalIssues).toEqual([]);
    expect(entry.warnings).toEqual([]);
    expect(entry.repairActions).toEqual([]);
    expect(entry.finalValidatorIssueCodes).toEqual([
      "BEHAVIOR_ASSIGNMENT",
      "LANGUAGE_OBJECTIVITY",
    ]);
    expect(entry.finalCriticalIssueCodes).toEqual(["BEHAVIOR_ASSIGNMENT"]);
    expect(entry.validatorIssueCount).toBe(2);
    expect(entry.criticalIssueCount).toBe(1);
    expect(entry.warningCount).toBe(1);
    expect(entry.structuredPlanHistory).toEqual([
      {
        attempt: 0,
        passed: false,
        issues: [{ code: "BEHAVIOR_ASSIGNMENT", segmentIndex: 0 }],
      },
      { attempt: 1, passed: true, issues: [] },
    ]);
    expect(entry.proseIssueHistory).toEqual([
      {
        attempt: 0,
        passed: false,
        issues: [
          { code: "LANGUAGE_OBJECTIVITY", severity: "warning", paragraphIndex: 1 },
        ],
      },
      { attempt: 1, passed: true, issues: [] },
    ]);
    expect(entry.clinicalBodyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(entry.finalNoteHash).toMatch(/^[a-f0-9]{64}$/);
    expect(entry.assessmentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("stores content only with an explicit true opt-in", () => {
    const entry = buildNoteGenerationAuditEntry(
      input({ env: { NOTE_AUDIT_STORE_CONTENT: "true" } }),
    );
    expect(entry.assessmentFilename).toBe("Alexandra-treatment-plan.pdf");
    expect(entry.rawModelJson).toEqual([{ clinical: SENSITIVE_TEXT }]);
    expect(entry.finalNoteText).toBe(`Final note: ${SENSITIVE_TEXT}`);
    expect(entry.validatorIssues).toEqual([`Validator detail: ${SENSITIVE_TEXT}`]);
    expect(entry.criticalIssues).toEqual([`Critical detail: ${SENSITIVE_TEXT}`]);
    expect(entry.warnings).toEqual([`warning detail: ${SENSITIVE_TEXT}`]);
    expect(entry.repairActions).toEqual([`repair detail: ${SENSITIVE_TEXT}`]);
    expect(JSON.stringify(entry.structuredPlanHistory)).toContain(SENSITIVE_TEXT);
    expect(JSON.stringify(entry.proseIssueHistory)).toContain(SENSITIVE_TEXT);
  });

  it("aggregates per-attempt latency, token usage, ids, and histories", () => {
    const entry = buildNoteGenerationAuditEntry(input({ env: {} }));
    expect(entry.latencyMs).toBe(100);
    expect(entry.promptTokens).toBe(22);
    expect(entry.completionTokens).toBe(38);
    expect(entry.totalTokens).toBe(60);
    expect(entry.completionIds).toEqual(["completion-1", "completion-2"]);
    expect(entry.structuredPlanHistory).toHaveLength(2);
    expect(entry.proseIssueHistory).toHaveLength(2);
  });

  it.each(["saved", "blocked_critical", "model_failed"])(
    "constructs a complete %s payload",
    (finalStatus) => {
      const entry = buildNoteGenerationAuditEntry(input({ finalStatus }));
      expect(entry.finalStatus).toBe(finalStatus);
      expect(entry.promptHash).toBe("prompt-hash");
      expect(entry.assessmentFilename).toBeNull();
      expect(entry.finalValidatorIssueCodes).toContain("BEHAVIOR_ASSIGNMENT");
    },
  );
});
