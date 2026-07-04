import { serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
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
  sessionDate: text("session_date").notNull(),
  sessionHours: integer("session_hours").notNull(),
  /** Repair passes consumed inside the OpenAI loop (0 = first draft passed). */
  repairAttempts: integer("repair_attempts").notNull().default(0),
  /** Validator issues remaining after the repair loop (full strings). */
  validatorIssues: jsonb("validator_issues").$type<string[]>().notNull().default([]),
  /** Subset of validatorIssues classified as critical (blocking). */
  criticalIssues: jsonb("critical_issues").$type<string[]>().notNull().default([]),
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
