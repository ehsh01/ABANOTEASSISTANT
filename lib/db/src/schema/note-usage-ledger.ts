import { serial, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { abanote } from "./abanote";
import { companiesTable } from "./companies";
import { notesTable } from "./notes";
import { usersTable } from "./users";

/**
 * Append-only quota ledger. **One row per billable saved note for its lifetime** — the unique
 * index on `note_id` is the source of "first save only counts" idempotency at the DB layer, so
 * a race between two simultaneous saves cannot double-count the same note.
 *
 * Reads: `COUNT(*) WHERE company_id = ? AND counted_at >= billingPeriodStart AND counted_at < billingPeriodEnd`
 * gives quota used. Snapshots of `stripe_subscription_id` / `stripe_price_id` make billing-period
 * boundaries reproducible even after a plan change in the same period.
 *
 * No ledger row is written for complimentary saves (`freeUsage` / `billing_mode = 'complimentary'`).
 */
export const noteUsageLedgerTable = abanote.table(
  "note_usage_ledger",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companiesTable.id, { onDelete: "cascade" }),
    noteId: integer("note_id")
      .notNull()
      .references(() => notesTable.id, { onDelete: "cascade" }),
    countedAt: timestamp("counted_at", { withTimezone: true }).defaultNow().notNull(),
    billingPeriodStart: timestamp("billing_period_start", { withTimezone: true }).notNull(),
    billingPeriodEnd: timestamp("billing_period_end", { withTimezone: true }).notNull(),
    countedByUserId: integer("counted_by_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripePriceId: text("stripe_price_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    /** First-save-only quota enforcement (race-safe). */
    uniqueNoteIdx: uniqueIndex("note_usage_ledger_note_id_uniq").on(t.noteId),
  }),
);

export const insertNoteUsageLedgerSchema = createInsertSchema(noteUsageLedgerTable).omit({
  id: true,
  createdAt: true,
});
export type InsertNoteUsageLedger = z.infer<typeof insertNoteUsageLedgerSchema>;
export type NoteUsageLedger = typeof noteUsageLedgerTable.$inferSelect;
