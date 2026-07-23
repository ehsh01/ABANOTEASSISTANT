import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { NotePlan, SessionContext } from "./note-plan-schema";

const assignmentSchema = z.object({
  programId: z.number().int().positive(),
  programName: z.string().min(1),
  criterionPercentage: z.number().int().min(0).max(100),
});

const caseSchema = z.object({
  id: z.string(),
  tags: z.array(z.string()),
  setting: z.string(),
  assessmentExcerpt: z.string(),
  profileBehaviors: z.array(z.string()),
  profileBehaviorTargets: z
    .array(z.object({ name: z.string(), topography: z.string().nullable() }))
    .optional(),
  profileInterventions: z.array(z.string()),
  hourlyAssignments: z.array(assignmentSchema).min(1).max(8),
  paragraphs: z.array(z.string().min(1)).min(1).max(8),
});

const corpusSchema = z.object({
  version: z.string(),
  cases: z.array(caseSchema),
});

export type NoteRegressionPipelineCase = z.infer<typeof caseSchema>;
export type NoteRegressionCase = NoteRegressionPipelineCase;

export function isPipelineFixture(
  _fixture: NoteRegressionCase,
): _fixture is NoteRegressionPipelineCase {
  return true;
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
  return {
    sessionHours: fixture.hourlyAssignments.length,
    sessionDate: "2026-07-20",
    therapySetting: fixture.setting,
    environmentalChanges: "",
    profileBehaviors: fixture.profileBehaviors,
    profileBehaviorTargets: fixture.profileBehaviorTargets ?? [],
    profileInterventions: fixture.profileInterventions,
    reinforcementPreferences: [],
    assessmentExcerpt: fixture.assessmentExcerpt,
    assessmentReferenceFileName: "deidentified-assessment.pdf",
    hourlyAssignments: fixture.hourlyAssignments.map((assignment, segmentIndex) => ({
      ...assignment,
      segmentIndex,
      activityHint: null,
      behaviorHint: null,
    })),
  };
}

export const fixtureGenerationContext = fixtureSessionContext;

export function fixtureNotePlan(fixture: NoteRegressionPipelineCase): NotePlan {
  return {
    segments: fixture.paragraphs.map((paragraph, segmentIndex) => {
      const behaviorLabel =
        fixture.profileBehaviors.find((label) => paragraph.includes(label)) ??
        fixture.profileBehaviors[segmentIndex % fixture.profileBehaviors.length]!;
      const interventionLabels = fixture.profileInterventions
        .filter((label) => paragraph.includes(`The RBT implemented ${label}.`))
        .slice(0, 1);
      return {
        segmentIndex,
        behaviorLabel,
        interventionLabels:
          interventionLabels.length > 0
            ? interventionLabels
            : [fixture.profileInterventions[0]!],
        paragraph,
      };
    }),
  };
}
