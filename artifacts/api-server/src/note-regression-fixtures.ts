import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { NotePlan, SessionContext } from "./note-plan-schema";
import type { NoteGenerationContext } from "./openai-notes";

const trialSchema = z.object({
  totalTrials: z.number().int().positive(),
  successfulTrialNumbers: z.array(z.number().int().positive()),
});
const segmentSchema = z.object({
  behavior: z.string(),
  topography: z.string().nullable(),
  functions: z.array(z.enum(["attention", "escape", "tangible", "automatic"])).nullable(),
  replacement: z.string(),
  interventions: z.array(z.string()),
  trial: trialSchema.nullable(),
  acquisitionOnly: z.boolean().optional(),
});
const planSegmentSchema = z.object({
  antecedent: z.string(),
  topography: z.string(),
  applications: z.array(z.string()),
  response: z.string(),
  teaching: z.string(),
  result: z.string(),
});
const pipelineCaseSchema = z.object({
  id: z.string(),
  tags: z.array(z.string()),
  setting: z.enum(["Home", "School"]),
  assessment: z.object({
    fileName: z.string(),
    excerpt: z.string(),
    truncated: z.boolean(),
  }),
  reinforcementPreferences: z.array(z.string()),
  catalogInterventions: z.array(z.string()).optional(),
  segments: z.array(segmentSchema).min(1),
  plan: z.array(planSegmentSchema).min(1),
});
const gateCaseSchema = z.object({
  id: z.string(),
  tags: z.array(z.string()),
  gate: z.object({ hasAssessment: z.boolean(), assessmentStatus: z.string() }),
  expectedGateError: z.literal(true),
});
const corpusSchema = z.object({
  version: z.string(),
  cases: z.array(z.union([pipelineCaseSchema, gateCaseSchema])),
});

export type NoteRegressionPipelineCase = z.infer<typeof pipelineCaseSchema>;
export type NoteRegressionGateCase = z.infer<typeof gateCaseSchema>;
export type NoteRegressionCase = NoteRegressionPipelineCase | NoteRegressionGateCase;

export function isPipelineFixture(
  fixture: NoteRegressionCase,
): fixture is NoteRegressionPipelineCase {
  return "segments" in fixture;
}

export function loadNoteRegressionCorpus(): {
  version: string;
  cases: NoteRegressionCase[];
} {
  const fixturePath = fileURLToPath(
    new URL("../fixtures/note-generation/corpus.json", import.meta.url),
  );
  return corpusSchema.parse(JSON.parse(readFileSync(fixturePath, "utf8")));
}

export function fixtureSessionContext(fixture: NoteRegressionPipelineCase): SessionContext {
  const behaviors = fixture.segments.map((segment) => segment.behavior).filter(Boolean);
  const replacements = fixture.segments.map((segment) => segment.replacement);
  const interventions =
    fixture.catalogInterventions ?? fixture.segments.flatMap((segment) => segment.interventions);
  return {
    narrativeSegmentCount: fixture.segments.length,
    therapySetting: fixture.setting,
    gender: null,
    clientAgeYears: 8,
    ageBand: null,
    environmentalChanges: "",
    clientAssessmentTextExcerpt: fixture.assessment.excerpt,
    assessmentReferenceFileName: fixture.assessment.fileName,
    reinforcementPreferences: fixture.reinforcementPreferences,
    segments: fixture.segments.map((segment, segmentIndex) => ({
      segmentIndex,
      acquisitionOnly: segment.acquisitionOnly === true,
      behaviorLabel: segment.behavior,
      replacementLabel: segment.replacement,
      interventionLabels: segment.interventions,
      activityAntecedent: null,
      behaviorTopography: segment.topography,
      behaviorFunctions: segment.functions,
      trialSummary: segment.trial,
      rbtActionsOnlyOutcome: false,
    })),
    planCatalogSnapshot: {
      behaviors: [...new Set(behaviors)],
      replacements: [...new Set(replacements)],
      interventions: [...new Set(interventions)],
    },
    validationProfile: "phase-3-strict",
  };
}

export function fixtureNotePlan(fixture: NoteRegressionPipelineCase): NotePlan {
  return {
    segments: fixture.segments.map((segment, segmentIndex) => {
      const prose = fixture.plan[segmentIndex];
      if (!prose) throw new Error(`${fixture.id}: missing plan segment ${segmentIndex}`);
      if (prose.applications.length !== segment.interventions.length) {
        throw new Error(`${fixture.id}: intervention/application count mismatch at ${segmentIndex}`);
      }
      return {
        segmentIndex,
        acquisitionOnly: segment.acquisitionOnly === true,
        behaviorLabel: segment.behavior,
        antecedent: prose.antecedent,
        topography: prose.topography,
        interventions: segment.interventions.map((label, index) => ({
          label,
          application: prose.applications[index]!,
        })),
        responseToIntervention: prose.response,
        replacementLabel: segment.replacement,
        teachingOrPromptingSummary: prose.teaching,
        resultSummary: prose.result,
      };
    }),
  };
}

export function fixtureGenerationContext(
  fixture: NoteRegressionPipelineCase,
): NoteGenerationContext {
  const frozen = fixtureSessionContext(fixture);
  return {
    clientName: "the client",
    firstName: "the client",
    gender: null,
    sessionHours: fixture.segments.length,
    narrativeSegmentCount: fixture.segments.length,
    sessionDate: "2026-07-14",
    therapySetting: fixture.setting,
    presentPeople: [],
    hasEnvironmentalChanges: false,
    environmentalChanges: "",
    maladaptiveBehaviors: frozen.planCatalogSnapshot.behaviors,
    maladaptiveBehaviorTargets: [],
    maladaptiveBehaviorForHour: fixture.segments.map((segment) => segment.behavior),
    interventions: frozen.planCatalogSnapshot.interventions,
    replacementProgramsInOrder: frozen.planCatalogSnapshot.replacements,
    replacementProgramForHour: fixture.segments.map((segment) => segment.replacement),
    rbtActionsOnlyOutcomeForHour: fixture.segments.map(() => false),
    requestNonce: `fixture:${fixture.id}`,
    clientAgeYears: 8,
    ageBand: null,
    clientAssessmentTextExcerpt: fixture.assessment.excerpt,
    assessmentReferenceFileName: fixture.assessment.fileName,
    reinforcementPreferences: fixture.reinforcementPreferences,
    activityAntecedentForHour: fixture.segments.map(() => null),
    languageMaladaptiveEpisodeForHour: fixture.segments.map(() => false),
    therapistTrialSummaryForReplacementHour: fixture.segments.map((segment) => segment.trial),
    acquisitionOnlySegmentForHour: fixture.segments.map((segment) => segment.acquisitionOnly === true),
    maladaptiveBehaviorFunctionsForHour: fixture.segments.map((segment) => segment.functions),
    maladaptiveBehaviorTopographyForHour: fixture.segments.map((segment) => segment.topography),
    behaviorReplacementCandidatesForHour: fixture.segments.map((segment) => [segment.replacement]),
    interventionCandidatesForHour: fixture.segments.map((segment) => segment.interventions),
    behaviorToReplacementsMap: Object.fromEntries(
      fixture.segments
        .filter((segment) => segment.behavior)
        .map((segment) => [segment.behavior, [segment.replacement]]),
    ),
  };
}
