import { z } from "zod";

const nonEmptyText = z.string().trim().min(1);

export const TherapistTrialSummarySchema = z
  .object({
    totalTrials: z.number().int().min(1),
    successfulTrialNumbers: z.array(z.number().int().min(1)),
  })
  .strict();

export const LockedSegmentContextSchema = z
  .object({
    segmentIndex: z.number().int().min(0),
    acquisitionOnly: z.boolean(),
    behaviorLabel: z.string(),
    replacementLabel: nonEmptyText,
    interventionLabels: z.array(nonEmptyText),
    activityAntecedent: z.string().nullable(),
    behaviorTopography: z.string().nullable(),
    behaviorFunctions: z.array(z.enum(["attention", "escape", "tangible", "automatic"])).nullable(),
    trialSummary: TherapistTrialSummarySchema.nullable(),
    rbtActionsOnlyOutcome: z.boolean(),
  })
  .strict();

export const SessionContextSchema = z
  .object({
    narrativeSegmentCount: z.number().int().min(1),
    therapySetting: nonEmptyText,
    gender: z.string().nullable(),
    clientAgeYears: z.number().int().min(0).nullable(),
    ageBand: z.string().nullable(),
    environmentalChanges: z.string(),
    clientAssessmentTextExcerpt: z.string(),
    assessmentReferenceFileName: z.string().nullable(),
    reinforcementPreferences: z.array(z.string()),
    segments: z.array(LockedSegmentContextSchema),
    planCatalogSnapshot: z
      .object({
        behaviors: z.array(nonEmptyText),
        replacements: z.array(nonEmptyText),
        interventions: z.array(nonEmptyText),
      })
      .strict(),
    validationProfile: z.literal("phase-3-strict"),
  })
  .strict();

export const InterventionApplicationSchema = z
  .object({
    label: nonEmptyText,
    application: nonEmptyText,
  })
  .strict();

export const ClinicalSegmentPlanSchema = z
  .object({
    segmentIndex: z.number().int().min(0),
    acquisitionOnly: z.boolean(),
    behaviorLabel: z.string(),
    antecedent: nonEmptyText,
    topography: nonEmptyText,
    interventions: z.array(InterventionApplicationSchema),
    responseToIntervention: nonEmptyText,
    replacementLabel: nonEmptyText,
    teachingOrPromptingSummary: nonEmptyText,
    resultSummary: nonEmptyText,
  })
  .strict();

/** Structured model output. Locked opening/closing prose is intentionally outside this object. */
export const NotePlanSchema = z
  .object({
    segments: z.array(ClinicalSegmentPlanSchema),
  })
  .strict();

export type TherapistTrialSummary = z.infer<typeof TherapistTrialSummarySchema>;
export type LockedSegmentContext = z.infer<typeof LockedSegmentContextSchema>;
export type SessionContext = z.infer<typeof SessionContextSchema>;
export type ClinicalSegmentPlan = z.infer<typeof ClinicalSegmentPlanSchema>;
export type NotePlan = z.infer<typeof NotePlanSchema>;
