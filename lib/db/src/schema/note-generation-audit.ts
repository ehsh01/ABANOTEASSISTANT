import { serial, text, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { abanote } from "./abanote";
import { companiesTable } from "./companies";
import { clientsTable } from "./clients";
import { notesTable } from "./notes";

/**
 * Append-only audit trail for `POST /notes/generate`. One row per generation attempt (saved,
 * blocked by critical validators, or failed at the model call) so "why did this note come out
 * wrong" is answerable from the database: which model/prompt ran, how many repair passes were
 * needed, what the validators flagged, and whether the note shipped.
 */
export const noteGenerationAuditTable = abanote.table("note_generation_audit", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id")
    .notNull()
    .references(() => companiesTable.id, { onDelete: "cascade" }),
  clientId: integer("client_id")
    .notNull()
    .references(() => clientsTable.id, { onDelete: "cascade" }),
  /** Null when generation was blocked/failed and no draft row was created. */
  noteId: integer("note_id").references(() => notesTable.id, { onDelete: "set null" }),
  /** OpenAI model id used for the clinical body. */
  model: text("model").notNull(),
  /** Version tag of the system prompt / pipeline (bump when prompts change). */
  promptVersion: text("prompt_version").notNull(),
  /** SHA-256 of the generation context (session facts + catalogs) for reproducibility. */
  contextHash: text("context_hash").notNull(),
  assessmentFilename: text("assessment_filename"),
  assessmentHash: text("assessment_hash"),
  assessmentExcerptLength: integer("assessment_excerpt_length"),
  assessmentExcerptTruncated: boolean("assessment_excerpt_truncated").notNull().default(false),
  promptHash: text("prompt_hash"),
  sessionDate: text("session_date").notNull(),
  sessionHours: integer("session_hours").notNull(),
  /** Repair passes consumed inside the OpenAI loop (0 = first draft passed). */
  repairAttempts: integer("repair_attempts").notNull().default(0),
  /** Legacy full messages; empty by default, populated only with content opt-in. */
  validatorIssues: jsonb("validator_issues").$type<string[]>().notNull().default([]),
  /** Legacy blocking messages; empty by default, populated only with content opt-in. */
  criticalIssues: jsonb("critical_issues").$type<string[]>().notNull().default([]),
  /** Code-only final validator telemetry, safe for default-redacted rows. */
  finalValidatorIssueCodes: jsonb("final_validator_issue_codes")
    .$type<string[]>()
    .notNull()
    .default([]),
  /** Code-only blocking subset of finalValidatorIssueCodes. */
  finalCriticalIssueCodes: jsonb("final_critical_issue_codes")
    .$type<string[]>()
    .notNull()
    .default([]),
  validatorIssueCount: integer("validator_issue_count").notNull().default(0),
  criticalIssueCount: integer("critical_issue_count").notNull().default(0),
  warningCount: integer("warning_count").notNull().default(0),
  structuredPlanHistory: jsonb("structured_plan_history").$type<unknown[]>().notNull().default([]),
  proseIssueHistory: jsonb("prose_issue_history").$type<unknown[]>().notNull().default([]),
  repairActions: jsonb("repair_actions").$type<string[]>().notNull().default([]),
  warnings: jsonb("warnings").$type<string[]>().notNull().default([]),
  latencyMs: integer("latency_ms"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  totalTokens: integer("total_tokens"),
  completionIds: jsonb("completion_ids").$type<string[]>().notNull().default([]),
  clinicalBodyHash: text("clinical_body_hash"),
  finalNoteHash: text("final_note_hash"),
  /** Null unless NOTE_AUDIT_STORE_CONTENT=true. Values may include invalid model JSON strings. */
  rawModelJson: jsonb("raw_model_json").$type<unknown[] | null>(),
  /** Null unless NOTE_AUDIT_STORE_CONTENT=true. */
  finalNoteText: text("final_note_text"),
  /** Per-note accuracy confidence (high | medium | low); null for blocked/model-failed rows. */
  accuracyConfidence: text("accuracy_confidence"),
  /** True when every selected program was documented and none were swapped. */
  accuracySelectionHonored: boolean("accuracy_selection_honored"),
  /** True when a name-scrubbed assessment excerpt was sent to the model for grounding. */
  accuracyAssessmentGrounded: boolean("accuracy_assessment_grounded"),
  /** Count of server-side program changes (altered/auto-filled selections). */
  accuracyAlteredCount: integer("accuracy_altered_count"),
  /** Full structured accuracy report. Null unless NOTE_AUDIT_STORE_CONTENT=true. */
  accuracyReport: jsonb("accuracy_report").$type<unknown>(),
  /** saved | blocked_critical | model_failed */
  finalStatus: text("final_status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertNoteGenerationAuditSchema = createInsertSchema(noteGenerationAuditTable).omit({
  id: true,
  createdAt: true,
});
export type InsertNoteGenerationAudit = z.infer<typeof insertNoteGenerationAuditSchema>;
export type NoteGenerationAudit = typeof noteGenerationAuditTable.$inferSelect;
