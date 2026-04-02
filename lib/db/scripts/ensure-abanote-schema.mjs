/**
 * drizzle-kit push uses schemaFilter: ["abanote"]. On a fresh database the schema
 * does not exist yet, so introspection fails with "schema abanote does not exist".
 * Run this before push (see package.json "push" script).
 *
 * Use parsed credentials + explicit ssl (same as drizzle.config.ts). With
 * connectionString-only Pool config, some Node/pg versions still verify the DO
 * managed-Postgres chain and throw SELF_SIGNED_CERT_IN_CHAIN.
 */
import pg from "pg";
import { parse } from "pg-connection-string";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("ensure-abanote-schema: DATABASE_URL is required");
  process.exit(1);
}

const parsed = parse(url);
if (!parsed.host || !parsed.database || !parsed.user) {
  console.error(
    "ensure-abanote-schema: DATABASE_URL must include host, database name, and user",
  );
  process.exit(1);
}

const port =
  parsed.port !== undefined && parsed.port !== null
    ? Number(parsed.port)
    : 5432;

if (Number.isNaN(port)) {
  console.error("ensure-abanote-schema: DATABASE_URL has invalid port");
  process.exit(1);
}

const pool = new pg.Pool({
  host: parsed.host,
  port,
  user: parsed.user,
  password: parsed.password,
  database: parsed.database,
  ssl: { rejectUnauthorized: false },
});

try {
  await pool.query("CREATE SCHEMA IF NOT EXISTS abanote");
  console.log("ensure-abanote-schema: schema abanote is ready");
} finally {
  await pool.end();
}
