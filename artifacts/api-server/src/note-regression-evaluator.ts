import { hashAuditArtifact } from "./note-generation-audit";
import { assembleClinicalBodyFromNotePlan } from "./note-plan-assembly";
import { validateNotePlan } from "./note-plan-validation";
import {
  fixtureNotePlan,
  fixtureSessionContext,
  type NoteRegressionCase,
} from "./note-regression-fixtures";

export type NoteRegressionEvaluation = {
  id: string;
  tags: string[];
  gateCase: false;
  strictPass: boolean;
  criticalPass: boolean;
  firstPass: boolean;
  repairAttempts: number;
  issueCodes: string[];
  outputHash: string | null;
};

export function evaluateNoteRegressionCase(
  fixture: NoteRegressionCase,
): NoteRegressionEvaluation {
  const context = fixtureSessionContext(fixture);
  const plan = fixtureNotePlan(fixture);
  const issues = validateNotePlan(plan, context);
  let body: string | null = null;
  if (issues.length === 0) {
    body = assembleClinicalBodyFromNotePlan(plan, context);
  }
  return {
    id: fixture.id,
    tags: fixture.tags,
    gateCase: false,
    strictPass: issues.length === 0,
    criticalPass: issues.length === 0,
    firstPass: issues.length === 0,
    repairAttempts: 0,
    issueCodes: issues.map((issue) => issue.code),
    outputHash: body ? hashAuditArtifact(body) : null,
  };
}
