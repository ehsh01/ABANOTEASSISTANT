import { text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { abanote } from "./abanote";
import { companiesTable } from "./companies";
import { usersTable } from "./users";
import { clientsTable } from "./clients";

export const NOTE_GENERATION_JOB_STATUSES = ["pending", "running", "completed", "failed"] as const;
export type NoteGenerationJobStatus = (typeof NOTE_GENERATION_JOB_STATUSES)[number];

/** Snapshot of a successful generation returned to the client when the job completes. */
export type NoteGenerationJobResultData = {
  noteId: number;
  content: string;
  clientId: number;
  clientName: string;
  sessionDate: string;
  sessionHours: number;
  generatedAt: string;
  generationSource: "openai";
  generationModel: string | null;
  maladaptiveReplacementPairings?: Array<{
    segmentIndex: number;
    maladaptiveBehavior: string;
    replacementProgramName: string;
  }>;
  draftQuota: { used: number; max: number };
};

/**
 * Async note-generation jobs for long-running OpenAI pipelines.
 *
 * POST /notes/generate returns immediately with a job id; the client polls GET
 * /notes/generate/jobs/:jobId until status is completed or failed. Stored in Postgres so
 * PM2 cluster workers share job state (in-memory would break across instances).
 */
export const noteGenerationJobsTable = abanote.table("note_generation_jobs", {
  id: text("id").primaryKey(),
  companyId: integer("company_id")
    .notNull()
    .references(() => companiesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  clientId: integer("client_id")
    .notNull()
    .references(() => clientsTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().$type<NoteGenerationJobStatus>(),
  requestBody: jsonb("request_body").$type<Record<string, unknown>>().notNull(),
  draftSlotUsed: integer("draft_slot_used").notNull(),
  draftSlotMax: integer("draft_slot_max").notNull(),
  resultData: jsonb("result_data").$type<NoteGenerationJobResultData | null>(),
  warnings: jsonb("warnings").$type<string[] | null>(),
  errorMessage: text("error_message"),
  errorStatus: integer("error_status"),
  errorMessages: jsonb("error_messages").$type<string[] | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const insertNoteGenerationJobSchema = createInsertSchema(noteGenerationJobsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertNoteGenerationJob = z.infer<typeof insertNoteGenerationJobSchema>;
export type NoteGenerationJob = typeof noteGenerationJobsTable.$inferSelect;
