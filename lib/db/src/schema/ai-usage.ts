import {
  index,
  integer,
  numeric,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { abanote } from "./abanote";
import { companiesTable } from "./companies";
import { usersTable } from "./users";

/** Append-only ledger with one row for every attempted external AI provider call. */
export const aiUsageTable = abanote.table(
  "ai_usage",
  {
    id: serial("id").primaryKey(),
    feature: text("feature").notNull(),
    userId: integer("user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    companyId: integer("company_id").references(() => companiesTable.id, {
      onDelete: "set null",
    }),
    model: text("model").notNull(),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    estimatedCostUsd: numeric("estimated_cost_usd", {
      precision: 12,
      scale: 6,
    })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    createdAtIdx: index("ai_usage_created_at_idx").on(t.createdAt),
    featureUserCreatedIdx: index("ai_usage_feature_user_created_idx").on(
      t.feature,
      t.userId,
      t.createdAt,
    ),
    featureCompanyCreatedIdx: index("ai_usage_feature_company_created_idx").on(
      t.feature,
      t.companyId,
      t.createdAt,
    ),
  }),
);

export const insertAiUsageSchema = createInsertSchema(aiUsageTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAiUsage = z.infer<typeof insertAiUsageSchema>;
export type AiUsage = typeof aiUsageTable.$inferSelect;
