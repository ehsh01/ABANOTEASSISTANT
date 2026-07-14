import {
  evaluateNoteRegressionCase,
  type NoteRegressionEvaluation,
} from "../../artifacts/api-server/src/note-regression-evaluator";
import {
  isPipelineFixture,
  loadNoteRegressionCorpus,
  type NoteRegressionCase,
} from "../../artifacts/api-server/src/note-regression-fixtures";

export const OFFLINE_NOTE_EVAL_THRESHOLDS = {
  strictPassRate: 1,
  criticalPassRate: 1,
  firstPassRate: 1,
  maxRepairAttempts: 0,
  requireStableHashes: true,
} as const;

export type NoteEvalReport = {
  corpusVersion: string;
  mode: "recorded";
  generatedAt: string;
  thresholds: typeof OFFLINE_NOTE_EVAL_THRESHOLDS;
  metrics: {
    cases: number;
    strictPassRate: number;
    criticalPassRate: number;
    firstPassRate: number;
    repairAttempts: number;
    issueCodeCounts: Record<string, number>;
    deterministicOutputHashStable: boolean;
  };
  passed: boolean;
  cases: NoteRegressionEvaluation[];
};

function rate(rows: NoteRegressionEvaluation[], key: "strictPass" | "criticalPass" | "firstPass"): number {
  return rows.length === 0 ? 0 : rows.filter((row) => row[key]).length / rows.length;
}

export function runOfflineNoteEvaluation(
  fixtures: NoteRegressionCase[] = loadNoteRegressionCorpus().cases,
): NoteEvalReport {
  const corpus = loadNoteRegressionCorpus();
  const rows = fixtures.map(evaluateNoteRegressionCase);
  const replay = fixtures.map(evaluateNoteRegressionCase);
  const deterministicOutputHashStable = rows.every(
    (row, index) =>
      !isPipelineFixture(fixtures[index]!) || row.outputHash === replay[index]?.outputHash,
  );
  const issueCodeCounts: Record<string, number> = {};
  for (const code of rows.flatMap((row) => row.issueCodes)) {
    issueCodeCounts[code] = (issueCodeCounts[code] ?? 0) + 1;
  }
  const strictPassRate = rate(rows, "strictPass");
  const criticalPassRate = rate(rows, "criticalPass");
  const firstPassRate = rate(rows, "firstPass");
  const repairAttempts = rows.reduce((total, row) => total + row.repairAttempts, 0);
  const passed =
    strictPassRate >= OFFLINE_NOTE_EVAL_THRESHOLDS.strictPassRate &&
    criticalPassRate >= OFFLINE_NOTE_EVAL_THRESHOLDS.criticalPassRate &&
    firstPassRate >= OFFLINE_NOTE_EVAL_THRESHOLDS.firstPassRate &&
    repairAttempts <= OFFLINE_NOTE_EVAL_THRESHOLDS.maxRepairAttempts &&
    deterministicOutputHashStable;

  return {
    corpusVersion: corpus.version,
    mode: "recorded",
    generatedAt: new Date().toISOString(),
    thresholds: OFFLINE_NOTE_EVAL_THRESHOLDS,
    metrics: {
      cases: rows.length,
      strictPassRate,
      criticalPassRate,
      firstPassRate,
      repairAttempts,
      issueCodeCounts,
      deterministicOutputHashStable,
    },
    passed,
    cases: rows,
  };
}
