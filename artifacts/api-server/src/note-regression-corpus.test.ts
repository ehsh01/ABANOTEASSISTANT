import { describe, expect, it, vi } from "vitest";
import { generateClinicalBodyOpenAI, type NotePlanModelCall } from "./openai-notes";
import {
  fixtureGenerationContext,
  fixtureNotePlan,
  isPipelineFixture,
  loadNoteRegressionCorpus,
} from "./note-regression-fixtures";
import { evaluateNoteRegressionCase } from "./note-regression-evaluator";

const corpus = loadNoteRegressionCorpus();

describe("frozen note-generation regression corpus", () => {
  it("covers named production warning regressions and required scenarios", () => {
    const tags = new Set(corpus.cases.flatMap((fixture) => fixture.tags));
    for (const required of [
      "production-warning-regression",
      "home",
      "school",
      "acquisition-only",
      "1h",
      "multi-hour",
      "0-percent",
      "partial",
      "100-percent",
      "assessment-truncated",
      "missing",
      "unreadable",
      "gadget-access",
      "visual-supports",
      "sib",
      "elopement",
      "disruptive-behavior",
    ]) {
      expect(tags.has(required), `missing fixture tag: ${required}`).toBe(true);
    }
  });

  it.each(corpus.cases.map((fixture) => [fixture.id, fixture] as const))(
    "%s runs through its frozen gate or complete deterministic pipeline",
    (_id, fixture) => {
      const result = evaluateNoteRegressionCase(fixture);
      expect(result.criticalPass, result.issueCodes.join(", ")).toBe(true);
      expect(result.strictPass, result.issueCodes.join(", ")).toBe(true);
      if (isPipelineFixture(fixture)) {
        expect(result.outputHash).toMatch(/^[a-f0-9]{64}$/);
        expect(evaluateNoteRegressionCase(fixture).outputHash).toBe(result.outputHash);
      }
    },
  );

  it("repairs the legacy safety/topography/praise production warning as JSON only", async () => {
    const fixture = corpus.cases.find(
      (item) => item.id === "legacy-safety-topography-praise-home-1h-zero",
    );
    if (!fixture || !isPipelineFixture(fixture)) throw new Error("fixture missing");
    const valid = fixtureNotePlan(fixture);
    const invalid = structuredClone(valid);
    invalid.segments[0]!.behaviorLabel = "Aggression";
    const modelCall = vi.fn<NotePlanModelCall>(async ({ attempt }) => ({
      output: JSON.stringify(attempt === 0 ? invalid : valid),
      completionId: `mock-completion-${attempt}`,
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    }));

    const result = await generateClinicalBodyOpenAI(fixtureGenerationContext(fixture), {
      modelCall,
    });
    expect(result.repairAttempts).toBe(1);
    expect(result.attemptHistory.map((attempt) => attempt.passed)).toEqual([false, true]);
    expect(result.attemptHistory[0]?.planIssues.map((issue) => issue.code)).toContain(
      "BEHAVIOR_ASSIGNMENT",
    );
    expect(result.body).toContain("Response Block.");
    expect(result.body).not.toContain("verbal praise");
    expect(modelCall).toHaveBeenCalledTimes(2);
  });
});
