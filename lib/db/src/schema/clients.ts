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

/** Extended client fields stored in Postgres (UI wizard + edit). */
export type ClientProfileRow = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  maladaptiveBehaviors: string[];
  replacementPrograms: string[];
  interventions: string[];
  assessmentFileName?: string;
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
