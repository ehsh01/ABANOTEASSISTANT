import {
  serial,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { abanote } from "./abanote";
import { companiesTable } from "./companies";

/** FBA-style function for replacement-program filtering (optional per-program tags). */
export type ClinicalFunction = "escape" | "attention" | "tangible" | "automatic";

/**
 * Curated allow-lists derived from the client assessment (exact strings as authorized on the BIP).
 * When stored on the client profile, note generation intersects profile/rotation catalogs with these lists only.
 */
export type AssessmentStructuredRow = {
  behaviors: string[];
  replacement_programs: string[];
  interventions: string[];
  /** Maladaptive behavior label → replacement program names (each must appear in `replacement_programs`). */
  behavior_to_replacements_map: Record<string, string[]>;
  /** Maladaptive behavior label → intervention names (each must appear in `interventions`). */
  behavior_to_interventions_map: Record<string, string[]>;
  /**
   * Optional: exact replacement program name → functions that program supports.
   * When omitted for a program, function-based filtering does not exclude that program (still assessment-only).
   */
  replacement_program_functions?: Record<string, ClinicalFunction[]>;
  /** Interventions allowed when a behavior has no `behavior_to_interventions_map` entry. */
  general_interventions?: string[];
};

/** One maladaptive target from the client profile (BIP label + optional RBT-authored operational text). */
export type MaladaptiveBehaviorProfileEntry = {
  name: string;
  /** Operational definition / topography for this exact catalog name; may be null when unset. */
  topography: string | null;
  /**
   * FBA functions for this behavior imported from the client's assessment (Preference Assessment / Hypothesized function).
   * `null` or empty array means not specified in the assessment — do not infer.
   */
  functions?: ClinicalFunction[] | null;
};

/**
 * Clinical overview imported from the assessment PDF (summary page / intake sections).
 * Stored on the client profile JSON; surfaced in the client detail UI.
 */
export type ClientAssessmentSummaryRow = {
  assessor?: string | null;
  /** ISO `yyyy-MM-dd` when known. */
  assessmentDate?: string | null;
  /** Free-text authorized service hours block from the assessment. */
  authorizedHours?: string | null;
  /** Narrative clinical summary paragraph. */
  summary?: string | null;
  diagnoses: string[];
  recommendations: string[];
  medicalHistory?: string | null;
  behaviorProfiles: string[];
  reinforcementPreferences: string[];
  precursorBehaviors: string[];
  crisisProtocol?: string | null;
  parentTrainingGoals: string[];
  supervisorRequirements?: string | null;
};

/**
 * Internal provenance for values populated from the latest assessment upload.
 *
 * Upload refresh policy is conservative: fields not named here are treated as therapist-curated
 * and win over extraction. Fields named here may be replaced or cleared by a later successful
 * upload, which prevents stale extracted clinical details from surviving a document replacement.
 */
export type AssessmentExtractionProvenanceRow = {
  topographyBehaviors: string[];
  functionBehaviors: string[];
  replacementMapBehaviors: string[];
  interventionMapBehaviors: string[];
  assessmentSummaryExtracted: boolean;
};

/** Extended client fields stored in Postgres (UI wizard + edit). */
export type ClientProfileRow = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  maladaptiveBehaviors: string[];
  /**
   * Optional per-behavior topography; when stored, should align to `maladaptiveBehaviors` order (same names).
   * Older rows may omit this field (treat as no saved topographies).
   */
  maladaptiveBehaviorTargets?: MaladaptiveBehaviorProfileEntry[];
  replacementPrograms: string[];
  /**
   * Skill-acquisition program names from the client BIP (distinct from replacement/behavior-reduction programs).
   * Populated from the assessment "Skill Acquisition Programs" section on import when present.
   */
  skillAcquisitionPrograms: string[];
  interventions: string[];
  assessmentFileName?: string;
  /**
   * Optional structured allow-lists from the assessment (exact BIP strings).
   * When set, clinical recommendation and note generation use only these names (intersected with profile/DB).
   */
  assessmentStructured?: AssessmentStructuredRow | null;
  /**
   * Truncated plain text from the uploaded assessment PDF (server-side only).
   * Used for AI note grounding; omitted from API responses.
   */
  assessmentTextSnapshot?: string;
  /**
   * ISO `yyyy-MM-dd` date the client's authorization (assessment / treatment plan) expires.
   * Surfaced in red on the client card / detail header so the RBT knows when the assessment lapses.
   * Optional; null/missing means "no expiration on file" (UI hides the badge).
   */
  assessmentAuthorizationExpiresOn?: string | null;
  /**
   * Structured assessment overview (diagnosis, recommendations, medical history, crisis plan, etc.)
   * imported from the PDF on client onboarding.
   */
  assessmentSummary?: ClientAssessmentSummaryRow | null;
  /** Server-only provenance for assessment-derived fields; omitted from public API responses. */
  assessmentExtractionProvenance?: AssessmentExtractionProvenanceRow;
};

export const clientsTable = abanote.table("clients", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .notNull()
    .references(() => companiesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  ageBand: text("age_band"),
  hasAssessment: boolean("has_assessment").notNull().default(false),
  assessmentStatus: text("assessment_status").notNull().default("missing"),
  profile: jsonb("profile").$type<ClientProfileRow | null>(),
  /**
   * AI-generated cartoon avatar bytes, base64-encoded (no `data:` prefix). PNG, ~50–150 KB at low quality.
   * Stored on the `clients` row (not in the JSON profile) so list responses can omit it; binary is served
   * by `GET /clients/:id/avatar` and embedded via signed URLs.
   */
  avatarPngBase64: text("avatar_png_base64"),
  /** Timestamp of the most recent avatar generation; doubles as a cache-busting key for signed URLs. */
  avatarUpdatedAt: timestamp("avatar_updated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertClientSchema = createInsertSchema(clientsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;
