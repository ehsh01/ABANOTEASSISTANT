/**
 * Ops: list Postgres databases on the same cluster as DATABASE_URL and summarize
 * abanote schema (user/client counts + optional email match).
 *
 *   pnpm --filter @workspace/api-server exec node scripts/discover-aba-databases.mjs [email]
 *
 * Reads artifacts/api-server/.env for DATABASE_URL (any database name in URL is fine;
 * we connect to that host and list databases from pg_database).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { parse } from "pg-connection-string";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");
const targetEmail = (process.argv[2] || "reiinvestorsllc@gmail.com").trim().toLowerCase();

function loadDatabaseUrl() {
  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing ${envPath}`);
  }
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) {
      continue;
    }
    const i = t.indexOf("=");
    if (i <= 0) {
      continue;
    }
    const k = t.slice(0, i).trim();
    if (k !== "DATABASE_URL") {
      continue;
    }
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    return v;
  }
  throw new Error("DATABASE_URL not found in .env");
}

function poolForDb(parsed, database) {
  return new pg.Pool({
    host: parsed.host,
    port: parsed.port ? Number(parsed.port) : 5432,
    user: parsed.user,
    password: parsed.password,
    database,
    ssl: { rejectUnauthorized: false },
  });
}

const url = loadDatabaseUrl();
const parsed = parse(url);
if (!parsed.host || !parsed.user || !parsed.database) {
  throw new Error("Invalid DATABASE_URL");
}

const adminDb = parsed.database;
const adminPool = poolForDb(parsed, adminDb);

let dbNames;
try {
  const r = await adminPool.query(`
    SELECT datname
    FROM pg_database
    WHERE datistemplate = false
      AND datallowconn
    ORDER BY datname
  `);
  dbNames = r.rows.map((x) => x.datname);
} finally {
  await adminPool.end();
}

console.log(`Host: ${parsed.host} (admin connect db: ${adminDb})`);
console.log(`Databases: ${dbNames.join(", ")}`);
console.log(`Looking for email: ${targetEmail}\n`);

for (const dbname of dbNames) {
  const pool = poolForDb(parsed, dbname);
  try {
    const sch = await pool.query(
      `SELECT 1 FROM information_schema.schemata WHERE schema_name = 'abanote' LIMIT 1`,
    );
    if (sch.rowCount === 0) {
      console.log(`${dbname}: (no abanote schema)`);
      continue;
    }
    const counts = await pool.query(`
      SELECT
        (SELECT count(*)::int FROM abanote.users) AS users,
        (SELECT count(*)::int FROM abanote.clients) AS clients,
        (SELECT count(*)::int FROM abanote.companies) AS companies
    `);
    const { users, clients, companies } = counts.rows[0];
    const hit = await pool.query(
      `SELECT id, email, email_verified, company_id, role
       FROM abanote.users WHERE lower(email) = $1`,
      [targetEmail],
    );
    const marker = hit.rowCount > 0 ? " <<< TARGET USER HERE" : "";
    console.log(
      `${dbname}: users=${users} clients=${clients} companies=${companies}${marker}`,
    );
    if (hit.rowCount > 0) {
      for (const row of hit.rows) {
        console.log(`   row: ${JSON.stringify(row)}`);
      }
    }
  } catch (e) {
    console.log(`${dbname}: ERROR ${e.message}`);
  } finally {
    await pool.end();
  }
}

console.log("\nSet DATABASE_URL database name to the DB that contains your user row, then:");
console.log("  pm2 restart abanoteassistant-api --update-env && pm2 save");
