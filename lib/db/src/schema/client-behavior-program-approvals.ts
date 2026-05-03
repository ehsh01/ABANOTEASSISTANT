import { serial, integer, text, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { abanote } from "./abanote";
import { clientsTable } from "./clients";
import { programsTable } from "./programs";

/**
 * Per-client, per-maladaptive-behavior approval of which replacement programs (wizard `programs` rows)
 * may be used when that behavior is selected in session notes / ABC builder.
 */
export const clientBehaviorProgramApprovalsTable = abanote.table(
  "client_behavior_program_approvals",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clientsTable.id, { onDelete: "cascade" }),
    /** Exact maladaptive behavior label as on the client profile (trimmed when written). */
    behaviorLabel: text("behavior_label").notNull(),
    programId: integer("program_id")
      .notNull()
      .references(() => programsTable.id, { onDelete: "cascade" }),
    matchType: text("match_type").notNull(),
    requiresBcbaReview: boolean("requires_bcba_review").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    clientBehaviorProgramUnique: uniqueIndex("cbpa_client_behavior_program_unique").on(
      t.clientId,
      t.behaviorLabel,
      t.programId,
    ),
  }),
);

export const insertClientBehaviorProgramApprovalSchema = createInsertSchema(
  clientBehaviorProgramApprovalsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertClientBehaviorProgramApproval = z.infer<
  typeof insertClientBehaviorProgramApprovalSchema
>;
export type ClientBehaviorProgramApproval = typeof clientBehaviorProgramApprovalsTable.$inferSelect;
