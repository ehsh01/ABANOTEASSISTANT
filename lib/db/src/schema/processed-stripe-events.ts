import { text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { abanote } from "./abanote";

/**
 * Webhook idempotency table. Stripe retries each event until our endpoint returns 2xx; we record
 * `stripe_event_id` here as the PK so a duplicate delivery short-circuits to a no-op instead of
 * applying the same subscription/invoice state change twice.
 */
export const processedStripeEventsTable = abanote.table("processed_stripe_events", {
  stripeEventId: text("stripe_event_id").primaryKey(),
  eventType: text("event_type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertProcessedStripeEventSchema = createInsertSchema(
  processedStripeEventsTable,
).omit({
  processedAt: true,
});
export type InsertProcessedStripeEvent = z.infer<typeof insertProcessedStripeEventSchema>;
export type ProcessedStripeEvent = typeof processedStripeEventsTable.$inferSelect;
