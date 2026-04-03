/**
 * One-off ops: set password for a user by email (case-insensitive).
 *
 *   cd /path/to/ABANOTEASSISTANT
 *   ALLOW_PASSWORD_RESET_SCRIPT=1 node artifacts/api-server/scripts/reset-user-password.mjs 'user@example.com' 'NewPasswordHere'
 *
 * Uses DATABASE_URL from the environment, or reads DATABASE_URL from artifacts/api-server/.env.
 */
import bcrypt from "bcrypt";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { parse } from "pg-connection-string";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) {
    return process.env.DATABASE_URL.trim();
  }
  const envPath = resolve(__dirname, "../.env");
  if (!existsSync(envPath)) {
    return null;
  }
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const i = trimmed.indexOf("=");
    if (i <= 0) {
      continue;
    }
    const key = trimmed.slice(0, i).trim();
    if (key !== "DATABASE_URL") {
      continue;
    }
    let v = trimmed.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    return v;
  }
  return null;
}

if (process.env.ALLOW_PASSWORD_RESET_SCRIPT !== "1") {
  console.error(
    "Refusing to run: set ALLOW_PASSWORD_RESET_SCRIPT=1 for this one-off script.",
  );
  process.exit(1);
}

const loginEmail = process.argv[2];
const newPassword = process.argv[3];
if (!loginEmail?.trim() || !newPassword || newPassword.length < 8) {
  console.error(
    "Usage: ALLOW_PASSWORD_RESET_SCRIPT=1 node .../reset-user-password.mjs <email> <newPasswordMin8>",
  );
  process.exit(1);
}

const url = loadDatabaseUrl();
if (!url) {
  console.error("DATABASE_URL is not set and could not be read from .env");
  process.exit(1);
}

const parsed = parse(url);
if (!parsed.host || !parsed.database || !parsed.user) {
  console.error("DATABASE_URL must include host, database, and user");
  process.exit(1);
}

const port =
  parsed.port !== undefined && parsed.port !== null
    ? Number(parsed.port)
    : 5432;

const pool = new pg.Pool({
  host: parsed.host,
  port,
  user: parsed.user,
  password: parsed.password,
  database: parsed.database,
  ssl: { rejectUnauthorized: false },
});

const norm = loginEmail.trim().toLowerCase();
const passwordHash = await bcrypt.hash(newPassword, 10);

try {
  const r = await pool.query(
    `UPDATE abanote.users SET password_hash = $1, updated_at = now() WHERE lower(email) = $2 RETURNING id, email`,
    [passwordHash, norm],
  );
  if (r.rowCount === 0) {
    console.error("No user found for that email in abanote.users");
    process.exit(1);
  }
  console.log("Updated user:", r.rows[0]);
} finally {
  await pool.end();
}
