import type {
  AssessmentStructuredRow,
  Client,
  ClientAssessmentSummaryRow,
  ClientProfileRow,
  MaladaptiveBehaviorProfileEntry,
} from "@workspace/db/schema";
import { expandMaladaptiveTargetsFromProfile } from "./client-profile-maladaptive";
import { buildAvatarUrl } from "./avatar-generation";
import { sanitizeClientAssessmentSummary } from "./client-assessment-summary";
import { buildNoteReadinessReport } from "./note-readiness";

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
  skillAcquisitionPrograms: string[];
  interventions: string[];
  assessmentFileName?: string | null;
  /** Curated assessment allow-lists when present on the stored profile. */
  assessmentStructured?: AssessmentStructuredRow | null;
  /** ISO `yyyy-MM-dd` date the client's authorization expires (null when not on file). */
  assessmentAuthorizationExpiresOn?: string | null;
  /** Structured assessment overview from the PDF when present. */
  assessmentSummary?: ClientAssessmentSummaryRow | null;
};

export function sanitizeClientProfileForApi(profile: ClientProfileRow): ClientProfilePublic {
  const mal = expandMaladaptiveTargetsFromProfile(profile);
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    dateOfBirth: profile.dateOfBirth,
    gender: profile.gender,
    maladaptiveBehaviors: mal.map((t) => t.name),
    maladaptiveBehaviorTargets: mal,
    replacementPrograms: profile.replacementPrograms ?? [],
    skillAcquisitionPrograms: profile.skillAcquisitionPrograms ?? [],
    interventions: profile.interventions,
    assessmentFileName: profile.assessmentFileName ?? null,
    assessmentStructured: profile.assessmentStructured ?? null,
    assessmentAuthorizationExpiresOn: profile.assessmentAuthorizationExpiresOn ?? null,
    assessmentSummary: profile.assessmentSummary ?? null,
  };
}

export function clientRowToApiData(c: Client) {
  const profile = (c.profile as ClientProfileRow | null | undefined) ?? null;
  // Surfaces a signed, version-pinned URL the browser can drop into `<img src=…>`. The signature is
  // bound to `avatarUpdatedAt`, so any regeneration mints a new URL and the browser cache invalidates
  // automatically. Returns `null` when the client has no avatar on file yet.
  const avatarUrl = buildAvatarUrl(c.id, c.avatarUpdatedAt ?? null);
  const avatarUpdatedAt = c.avatarUpdatedAt ? c.avatarUpdatedAt.toISOString() : null;
  return {
    id: c.id,
    companyId: c.companyId,
    name: c.name,
    ageBand: c.ageBand ?? undefined,
    hasAssessment: c.hasAssessment,
    assessmentStatus: c.assessmentStatus as AssessmentStatus,
    avatarUrl,
    avatarUpdatedAt,
    profile: profile ? sanitizeClientProfileForApi(profile) : null,
    noteReadiness: profile ? buildNoteReadinessReport(profile) : null,
  };
}
