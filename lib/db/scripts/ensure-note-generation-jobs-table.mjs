/**
 * Idempotent DDL for `abanote.note_generation_jobs` (async POST /notes/generate/jobs).
 *
 * From repo root: pnpm --filter @workspace/db run ensure:note-generation-jobs-table
 */
import pg from "pg";
import { parse } from "pg-connection-string";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const envPath = path.join(repoRoot, "artifacts", "api-server", ".env");

function loadDotEnv(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) {
    console.error(`Missing env file: ${filePath}`);
    process.exit(1);
  }
  let text = fs.readFileSync(filePath, "utf8");
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    let key = trimmed.slice(0, eq).trim();
    if (key.startsWith("export ")) {
      key = key.slice("export ".length).trim();
    }
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function poolForUrl(databaseUrl) {
  const parsed = parse(databaseUrl);
  if (!parsed.host || !parsed.database || !parsed.user) {
    throw new Error("DATABASE_URL must include host, database name, and user");
  }
  const port =
    parsed.port !== undefined && parsed.port !== null ? Number(parsed.port) : 5432;
  if (Number.isNaN(port)) {
    throw new Error("DATABASE_URL has invalid port");
  }
  const useTls =
    Boolean(parsed.host) && parsed.host !== "localhost" && parsed.host !== "127.0.0.1";
  return new pg.Pool({
    host: parsed.host,
    port,
    user: parsed.user,
    password: parsed.password,
    database: parsed.database,
    ssl: useTls ? { rejectUnauthorized: false } : undefined,
  });
}

const ddl = `
CREATE TABLE IF NOT EXISTS abanote.note_generation_jobs (
  id text PRIMARY KEY,
  company_id integer NOT NULL REFERENCES abanote.companies(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES abanote.users(id) ON DELETE CASCADE,
  client_id integer NOT NULL REFERENCES abanote.clients(id) ON DELETE CASCADE,
  status text NOT NULL,
  request_body jsonb NOT NULL,
  draft_slot_used integer NOT NULL,
  draft_slot_max integer NOT NULL,
  result_data jsonb,
  warnings jsonb,
  error_message text,
  error_status integer,
  error_messages jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS note_generation_jobs_company_user_created_idx
  ON abanote.note_generation_jobs (company_id, user_id, created_at DESC);
`;

async function runFor(label, databaseUrl) {
  console.log(`\n--- ${label} ---\n`);
  const pool = poolForUrl(databaseUrl);
  try {
    await pool.query("CREATE SCHEMA IF NOT EXISTS abanote");
    await pool.query(ddl);
    console.log("OK: note_generation_jobs table + indexes ensured.");
  } finally {
    await pool.end();
  }
}

const fileEnv = loadDotEnv(envPath);
const prodUrl = fileEnv.DATABASE_URL;
if (!prodUrl) {
  console.error("DATABASE_URL not set in artifacts/api-server/.env");
  process.exit(1);
}

await runFor("production (DATABASE_URL)", prodUrl);

const stagingUrl = fileEnv.DATABASE_URL_STAGING?.trim();
if (stagingUrl && stagingUrl !== prodUrl) {
  await runFor("staging (DATABASE_URL_STAGING)", stagingUrl);
} else {
  console.log("\n--- Skipping staging (no DATABASE_URL_STAGING or same as production) ---\n");
}
