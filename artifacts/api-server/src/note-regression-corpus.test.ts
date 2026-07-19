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

  it("force-locks a wrong behavior label without a model repair (legacy fixture)", async () => {
    const fixture = corpus.cases.find(
      (item) => item.id === "legacy-safety-topography-praise-home-1h-zero",
    );
    if (!fixture || !isPipelineFixture(fixture)) throw new Error("fixture missing");
    const valid = fixtureNotePlan(fixture);
    const invalid = structuredClone(valid);
    invalid.segments[0]!.behaviorLabel = "Aggression";
    const modelCall = vi.fn<NotePlanModelCall>(async () => ({
      output: JSON.stringify(invalid),
      completionId: "mock-completion-0",
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    }));

    const result = await generateClinicalBodyOpenAI(fixtureGenerationContext(fixture), {
      modelCall,
    });
    // Server grounding overwrites catalog labels — no repair call needed for label echo errors.
    expect(result.repairAttempts).toBe(0);
    expect(result.attemptHistory.map((attempt) => attempt.passed)).toEqual([true]);
    expect(result.notePlan?.segments[0]?.behaviorLabel).toBe(valid.segments[0]!.behaviorLabel);
    expect(result.body).toContain("Response Block.");
    expect(result.body).not.toContain("verbal praise");
    expect(modelCall).toHaveBeenCalledTimes(1);
  });
});
