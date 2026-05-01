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
