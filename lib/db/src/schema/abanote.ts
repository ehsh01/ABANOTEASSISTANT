import { pgSchema } from "drizzle-orm/pg-core";

/**
 * All ABA tables use this Postgres schema so the app can share a managed cluster
 * with other products that already own `public.users`, `public.companies`, etc.
 */
export const abanote = pgSchema("abanote");
