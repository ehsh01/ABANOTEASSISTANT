import { pgTable, serial, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { programsTable } from "./programs";

export const clientProgramsTable = pgTable(
  "client_programs",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id")
      .notNull()
      .references(() => clientsTable.id, { onDelete: "cascade" }),
    programId: integer("program_id")
      .notNull()
      .references(() => programsTable.id, { onDelete: "cascade" }),
  },
  (t) => [unique("client_programs_client_program_unique").on(t.clientId, t.programId)],
);

export const insertClientProgramSchema = createInsertSchema(clientProgramsTable).omit({
  id: true,
});
export type InsertClientProgram = z.infer<typeof insertClientProgramSchema>;
export type ClientProgram = typeof clientProgramsTable.$inferSelect;
