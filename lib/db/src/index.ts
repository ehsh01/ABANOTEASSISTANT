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

/**
 * The managed Postgres cluster caps total connections (e.g. DigitalOcean's smallest
 * tier allows 25, with 3 reserved for superuser) and is shared by several apps.
 * Keep this process's pool small and release idle connections quickly so we do not
 * exhaust the server-wide slots ("remaining connection slots are reserved..." 53300).
 */
const parsedPoolMax = Number(process.env.PG_POOL_MAX ?? "");
const poolMax =
  Number.isFinite(parsedPoolMax) && parsedPoolMax >= 1 ? Math.floor(parsedPoolMax) : 4;

export const pool = new Pool({
  host: parsed.host,
  port,
  user: parsed.user,
  password: parsed.password,
  database: parsed.database,
  ssl: useTls ? { rejectUnauthorized: false } : undefined,
  max: poolMax,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 15_000,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
