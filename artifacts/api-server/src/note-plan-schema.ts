import { z } from "zod";

export const HourlyNoteAssignmentSchema = z.object({
  segmentIndex: z.number().int().nonnegative(),
  programId: z.number().int().positive(),
  programName: z.string().trim().min(1),
  criterionPercentage: z.number().int().min(0).max(100),
  activityHint: z.string().trim().min(1).nullable(),
  behaviorHint: z.string().trim().min(1).nullable(),
});

export const ProfileBehaviorTargetSchema = z.object({
  name: z.string().trim().min(1),
  topography: z.string().trim().min(1).nullable(),
});

export const SessionContextSchema = z.object({
  sessionHours: z.number().int().min(1).max(8),
  sessionDate: z.string().min(1),
  therapySetting: z.string().min(1),
  environmentalChanges: z.string(),
  profileBehaviors: z.array(z.string()),
  profileBehaviorTargets: z.array(ProfileBehaviorTargetSchema),
  profileInterventions: z.array(z.string()),
  reinforcementPreferences: z.array(z.string()),
  assessmentExcerpt: z.string(),
  assessmentReferenceFileName: z.string().nullable(),
  hourlyAssignments: z.array(HourlyNoteAssignmentSchema).min(1).max(8),
});

export const NotePlanSegmentSchema = z.object({
  segmentIndex: z.number().int().nonnegative(),
  behaviorLabel: z.string().trim().min(1),
  interventionLabels: z.array(z.string().trim().min(1)).min(1).max(1),
  paragraph: z.string().trim().min(1),
});

export const NotePlanSchema = z.object({
  segments: z.array(NotePlanSegmentSchema).min(1).max(8),
});

export type HourlyNoteAssignment = z.infer<typeof HourlyNoteAssignmentSchema>;
export type ProfileBehaviorTarget = z.infer<typeof ProfileBehaviorTargetSchema>;
export type SessionContext = z.infer<typeof SessionContextSchema>;
export type NotePlanSegment = z.infer<typeof NotePlanSegmentSchema>;
export type NotePlan = z.infer<typeof NotePlanSchema>;
