import { generateClinicalBodyOpenAI } from "../../artifacts/api-server/src/openai-notes";
import { hashAuditArtifact } from "../../artifacts/api-server/src/note-generation-audit";
import {
  fixtureGenerationContext,
  isPipelineFixture,
  loadNoteRegressionCorpus,
} from "../../artifacts/api-server/src/note-regression-fixtures";
import { evaluateNoteRegressionCase } from "../../artifacts/api-server/src/note-regression-evaluator";
import { runOfflineNoteEvaluation } from "./evaluator";

const liveFlag = process.argv.includes("--live");
if (liveFlag && process.env.NOTE_EVAL_LIVE !== "true") {
  console.error("Live evaluation requires both --live and NOTE_EVAL_LIVE=true.");
  process.exit(2);
}

if (!liveFlag) {
  const report = runOfflineNoteEvaluation();
  console.log(JSON.stringify(report));
  console.error(
    `note-eval recorded: ${report.metrics.cases} cases, strict ${(report.metrics.strictPassRate * 100).toFixed(0)}%, critical ${(report.metrics.criticalPassRate * 100).toFixed(0)}%, first-pass ${(report.metrics.firstPassRate * 100).toFixed(0)}%, repairs ${report.metrics.repairAttempts}, hashes ${report.metrics.deterministicOutputHashStable ? "stable" : "unstable"}`,
  );
  process.exit(report.passed ? 0 : 1);
}

if (!process.env.OPENAI_API_KEY?.trim()) {
  console.error("Live evaluation requires OPENAI_API_KEY.");
  process.exit(2);
}

const corpus = loadNoteRegressionCorpus();
const results = [];
for (const fixture of corpus.cases) {
  if (!isPipelineFixture(fixture)) {
    results.push(evaluateNoteRegressionCase(fixture));
    continue;
  }
  const generated = await generateClinicalBodyOpenAI(fixtureGenerationContext(fixture));
  const blocking = generated.finalIssues.filter((issue) => issue.severity === "blocking");
  results.push({
    id: fixture.id,
    tags: fixture.tags,
    gateCase: false,
    strictPass: generated.finalIssues.length === 0,
    criticalPass: blocking.length === 0,
    firstPass: generated.attemptHistory[0]?.passed === true,
    repairAttempts: generated.repairAttempts,
    issueCodes: generated.finalIssues.map((issue) => issue.code),
    outputHash: generated.body ? hashAuditArtifact(generated.body) : null,
  });
}
const criticalPassRate = results.filter((result) => result.criticalPass).length / results.length;
const report = {
  corpusVersion: corpus.version,
  mode: "live",
  generatedAt: new Date().toISOString(),
  thresholds: { criticalPassRate: 1 },
  metrics: {
    cases: results.length,
    criticalPassRate,
    repairAttempts: results.reduce((total, result) => total + result.repairAttempts, 0),
  },
  passed: criticalPassRate === 1,
  cases: results,
};
console.log(JSON.stringify(report));
console.error(
  `note-eval live: ${results.length} cases, critical ${(criticalPassRate * 100).toFixed(0)}%`,
);
process.exit(report.passed ? 0 : 1);
