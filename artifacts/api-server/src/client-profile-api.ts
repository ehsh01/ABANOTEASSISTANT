import type {
  AssessmentStructuredRow,
  Client,
  ClientProfileRow,
  MaladaptiveBehaviorProfileEntry,
} from "@workspace/db/schema";
import { expandMaladaptiveTargetsFromProfile } from "./client-profile-maladaptive";

type AssessmentStatus = "uploaded" | "processing" | "ready" | "missing";

/** Profile shape returned in API JSON (excludes internal `assessmentTextSnapshot`). */
export type ClientProfilePublic = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  maladaptiveBehaviors: string[];
  /** Per-behavior topography aligned to `maladaptiveBehaviors` names (null when not set). */
  maladaptiveBehaviorTargets: MaladaptiveBehaviorProfileEntry[];
  replacementPrograms: string[];
  interventions: string[];
  assessmentFileName?: string | null;
  /** Curated assessment allow-lists when present on the stored profile. */
  assessmentStructured?: AssessmentStructuredRow | null;
};

export function sanitizeClientProfileForApi(profile: ClientProfileRow): ClientProfilePublic {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    dateOfBirth: profile.dateOfBirth,
    gender: profile.gender,
    maladaptiveBehaviors: profile.maladaptiveBehaviors,
    maladaptiveBehaviorTargets: expandMaladaptiveTargetsFromProfile(profile),
    replacementPrograms: profile.replacementPrograms,
    interventions: profile.interventions,
    assessmentFileName: profile.assessmentFileName ?? null,
    assessmentStructured: profile.assessmentStructured ?? null,
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
