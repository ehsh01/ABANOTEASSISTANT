import {
  index,
  integer,
  jsonb,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { abanote } from "./abanote";
import { companiesTable } from "./companies";

/** Durable provider-response cache. Cache keys are SHA-256 digests, never clinical text. */
export const aiResponseCacheTable = abanote.table(
  "ai_response_cache",
  {
    id: serial("id").primaryKey(),
    feature: text("feature").notNull(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companiesTable.id, { onDelete: "cascade" }),
    cacheKey: text("cache_key").notNull(),
    model: text("model").notNull(),
    response: jsonb("response").$type<unknown>().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    featureKeyIdx: uniqueIndex("ai_response_cache_feature_company_key_uniq").on(
      t.feature,
      t.companyId,
      t.cacheKey,
    ),
    expiresAtIdx: index("ai_response_cache_expires_at_idx").on(t.expiresAt),
  }),
);

export const insertAiResponseCacheSchema = createInsertSchema(
  aiResponseCacheTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAiResponseCache = z.infer<typeof insertAiResponseCacheSchema>;
export type AiResponseCache = typeof aiResponseCacheTable.$inferSelect;
