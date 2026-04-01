import type { Client, ClientProfileRow } from "@workspace/db/schema";

type AssessmentStatus = "uploaded" | "processing" | "ready" | "missing";

/** Profile shape returned in API JSON (excludes internal `assessmentTextSnapshot`). */
export type ClientProfilePublic = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  maladaptiveBehaviors: string[];
  replacementPrograms: string[];
  interventions: string[];
  assessmentFileName?: string | null;
};

export function sanitizeClientProfileForApi(profile: ClientProfileRow): ClientProfilePublic {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    dateOfBirth: profile.dateOfBirth,
    gender: profile.gender,
    maladaptiveBehaviors: profile.maladaptiveBehaviors,
    replacementPrograms: profile.replacementPrograms,
    interventions: profile.interventions,
    assessmentFileName: profile.assessmentFileName ?? null,
  };
}

export function clientRowToApiData(c: Client) {
  const profile = (c.profile as ClientProfileRow | null | undefined) ?? null;
  return {
    id: c.id,
    companyId: c.companyId,
    name: c.name,
    ageBand: c.ageBand ?? undefined,
    hasAssessment: c.hasAssessment,
    assessmentStatus: c.assessmentStatus as AssessmentStatus,
    profile: profile ? sanitizeClientProfileForApi(profile) : null,
  };
}
