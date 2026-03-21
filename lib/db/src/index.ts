import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { parse } from "pg-connection-string";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

/**
 * node-postgres v8+ treats `sslmode=require` in a connection string like
 * verify-full, which breaks many managed Postgres providers (e.g. DigitalOcean)
 * when combined with `rejectUnauthorized: false`. Drizzle Kit avoids this by
 * passing explicit `dbCredentials` instead of a URL. Mirror that here.
 */
const parsed = parse(process.env.DATABASE_URL);

if (!parsed.host || !parsed.database || !parsed.user) {
  throw new Error(
    "DATABASE_URL must include host, database name, and user",
  );
}

const port =
  parsed.port !== undefined && parsed.port !== null
    ? Number(parsed.port)
    : 5432;

if (Number.isNaN(port)) {
  throw new Error("DATABASE_URL has invalid port");
}

const useTls =
  Boolean(parsed.host) &&
  parsed.host !== "localhost" &&
  parsed.host !== "127.0.0.1" &&
  parsed.host !== "helium";

export const pool = new Pool({
  host: parsed.host,
  port,
  user: parsed.user,
  password: parsed.password,
  database: parsed.database,
  ssl: useTls ? { rejectUnauthorized: false } : undefined,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
