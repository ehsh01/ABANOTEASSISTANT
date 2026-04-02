/**
 * drizzle-kit push uses schemaFilter: ["abanote"]. On a fresh database the schema
 * does not exist yet, so introspection fails with "schema abanote does not exist".
 * Run this before push (see package.json "push" script).
 */
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("ensure-abanote-schema: DATABASE_URL is required");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

try {
  await pool.query("CREATE SCHEMA IF NOT EXISTS abanote");
  console.log("ensure-abanote-schema: schema abanote is ready");
} finally {
  await pool.end();
}
