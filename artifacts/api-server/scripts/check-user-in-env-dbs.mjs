/**
 * Ops: list user row(s) for an email in DATABASE_URL and DATABASE_URL_STAGING
 * (reads artifacts/api-server/.env). Run from repo root:
 *   pnpm --filter @workspace/api-server exec node artifacts/api-server/scripts/check-user-in-env-dbs.mjs <email>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { parse } from "pg-connection-string";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiServerDir = path.resolve(__dirname, "..");

const target = (process.argv[2] || "").trim().toLowerCase();
if (!target || !target.includes("@")) {
  console.error(
    "Usage: node artifacts/api-server/scripts/check-user-in-env-dbs.mjs <email>",
  );
  process.exit(1);
}

function loadEnvFile(p) {
  const out = {};
  if (!fs.existsSync(p)) {
    return out;
  }
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) {
      continue;
    }
    const i = t.indexOf("=");
    if (i <= 0) {
      continue;
    }
    let k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

async function queryDb(label, url) {
  if (!url?.trim()) {
    console.log(`${label}: (not configured)`);
    return;
  }
  const parsed = parse(url);
  const pool = new pg.Pool({
    host: parsed.host,
    port: parsed.port ? Number(parsed.port) : 5432,
    user: parsed.user,
    password: parsed.password,
    database: parsed.database,
    ssl: { rejectUnauthorized: false },
  });
  try {
    const r = await pool.query(
      `select id, email, email_verified, role, company_id,
              left(password_hash, 7) as bcrypt_prefix,
              length(password_hash) as hash_len
       from abanote.users where lower(email) = lower($1)`,
      [target],
    );
    console.log(`\n${label}`);
    console.log(`  host=${parsed.host} database=${parsed.database}`);
    console.log(`  rows=${r.rowCount}`);
    for (const row of r.rows) {
      console.log(`  ${JSON.stringify(row)}`);
    }
  } catch (e) {
    console.log(`${label}: ERROR ${e.message}`);
  } finally {
    await pool.end();
  }
}

const envPath = path.join(apiServerDir, ".env");
const env = loadEnvFile(envPath);
console.log(`Checking abanote.users for: ${target}`);
console.log(`Env file: ${envPath}`);

await queryDb("PRODUCTION (DATABASE_URL)", env.DATABASE_URL);
await queryDb("STAGING (DATABASE_URL_STAGING)", env.DATABASE_URL_STAGING);
