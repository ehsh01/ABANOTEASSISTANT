import type { ClientProfileRow } from "@workspace/db/schema";
import { buildLockedClosingParagraph, buildLockedOpening, buildNextSessionSentence, buildPerformanceSentence } from "./note-assembly";
import { assembleClinicalBodyFromNotePlan } from "./note-plan-assembly";
import { assessmentGenerationGate } from "./note-readiness";
import {
  fixtureNotePlan,
  fixtureSessionContext,
  isPipelineFixture,
  type NoteRegressionCase,
  type NoteRegressionPipelineCase,
} from "./note-regression-fixtures";
import { validateNotePlan } from "./note-plan-validation";
import {
  validateAssembledSessionNote,
  validateClinicalBodyComplianceDetailed,
  type NoteComplianceContext,
} from "./note-validation";
import { hashAuditArtifact } from "./note-generation-audit";

export type NoteRegressionEvaluation = {
  id: string;
  tags: string[];
  gateCase: boolean;
  strictPass: boolean;
  criticalPass: boolean;
  firstPass: boolean;
  repairAttempts: number;
  issueCodes: string[];
  outputHash: string | null;
};

export function complianceContextForFixture(
  fixture: NoteRegressionPipelineCase,
): NoteComplianceContext {
  const behaviorToReplacementsMap = Object.fromEntries(
    fixture.segments
      .filter((segment) => segment.behavior)
      .map((segment) => [segment.behavior, [segment.replacement]]),
  );
  return {
    sessionHours: fixture.segments.length,
    therapySetting: fixture.setting,
    narrativeSegmentCount: fixture.segments.length,
    replacementProgramsInOrder: [...new Set(fixture.segments.map((segment) => segment.replacement))],
    replacementProgramForHour: fixture.segments.map((segment) => segment.replacement),
    rbtActionsOnlyOutcomeForHour: fixture.segments.map(() => false),
    maladaptiveBehaviors: [...new Set(fixture.segments.map((segment) => segment.behavior).filter(Boolean))],
    maladaptiveBehaviorForHour: fixture.segments.map((segment) => segment.behavior),
    activityAntecedentForHour: fixture.segments.map(() => null),
    languageMaladaptiveEpisodeForHour: fixture.segments.map(() => false),
    interventions: [
      ...new Set(
        fixture.catalogInterventions ??
          fixture.segments.flatMap((segment) => segment.interventions),
      ),
    ],
    therapistTrialSummaryForReplacementHour: fixture.segments.map((segment) => segment.trial),
    clientAgeYears: 8,
    presentPeople: [],
    acquisitionOnlySegmentForHour: fixture.segments.map((segment) => segment.acquisitionOnly === true),
    maladaptiveBehaviorFunctionsForHour: fixture.segments.map((segment) => segment.functions),
    maladaptiveBehaviorTopographyForHour: fixture.segments.map((segment) => segment.topography),
    behaviorToReplacementsMap,
  };
}

export function assembleFullFixtureNote(
  fixture: NoteRegressionPipelineCase,
  clinicalBody: string,
): string {
  const trials = fixture.segments.map((segment) => segment.trial);
  return [
    buildLockedOpening([], false, fixture.setting, null),
    "",
    clinicalBody,
    "",
    buildLockedClosingParagraph(fixture.reinforcementPreferences),
    "",
    buildPerformanceSentence(fixture.segments.length, trials, null),
    "",
    buildNextSessionSentence(undefined),
  ].join("\n");
}

export function evaluateNoteRegressionCase(
  fixture: NoteRegressionCase,
): NoteRegressionEvaluation {
  if (!isPipelineFixture(fixture)) {
    const snapshot =
      fixture.gate.assessmentStatus === "processing" ||
      fixture.gate.assessmentStatus === "ready"
        ? "Readable de-identified assessment text ".repeat(4)
        : "";
    const gate = assessmentGenerationGate({
      ...fixture.gate,
      profile: { assessmentTextSnapshot: snapshot } as ClientProfileRow,
    });
    const pass = !gate.ok;
    return {
      id: fixture.id,
      tags: fixture.tags,
      gateCase: true,
      strictPass: pass,
      criticalPass: pass,
      firstPass: pass,
      repairAttempts: 0,
      issueCodes: pass ? [] : ["ASSESSMENT_GATE_REGRESSION"],
      outputHash: null,
    };
  }

  const context = fixtureSessionContext(fixture);
  const planValidation = validateNotePlan(fixtureNotePlan(fixture), context);
  if (!planValidation.plan || planValidation.issues.length > 0) {
    return {
      id: fixture.id,
      tags: fixture.tags,
      gateCase: false,
      strictPass: false,
      criticalPass: false,
      firstPass: false,
      repairAttempts: 0,
      issueCodes: planValidation.issues.map((issue) => issue.code),
      outputHash: null,
    };
  }

  const clinicalBody = assembleClinicalBodyFromNotePlan(planValidation.plan, context);
  const compliance = validateClinicalBodyComplianceDetailed(
    clinicalBody,
    complianceContextForFixture(fixture),
  );
  const fullNote = assembleFullFixtureNote(fixture, clinicalBody);
  const assembled = validateAssembledSessionNote(fullNote, {
    presentPeople: [],
    hasEnvironmentalChanges: false,
    therapySetting: fixture.setting,
    nextSessionDate: undefined,
    clientFirstName: null,
    blockedClientNames: [],
    narrativeProgramSegmentCount: fixture.segments.length,
    therapistTrialSummaryForReplacementHour: fixture.segments.map((segment) => segment.trial),
    reinforcementPreferences: fixture.reinforcementPreferences,
  });
  const issues = [...compliance.issues, ...assembled.issues];
  return {
    id: fixture.id,
    tags: fixture.tags,
    gateCase: false,
    strictPass: issues.length === 0,
    criticalPass: issues.every((issue) => issue.severity !== "blocking"),
    firstPass: issues.every((issue) => issue.severity !== "blocking"),
    repairAttempts: 0,
    issueCodes: issues.map((issue) => issue.code),
    outputHash: hashAuditArtifact(fullNote),
  };
}
