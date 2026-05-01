/**
 * Run schema push using `artifacts/api-server/.env` without `source` (which breaks on
 * values that are not valid bash, e.g. unquoted angle brackets in EMAIL_FROM).
 *
 * From repo root: pnpm --filter @workspace/db run push:from-api-env
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const envPath = path.join(repoRoot, "artifacts", "api-server", ".env");
const libDbRoot = path.join(repoRoot, "lib", "db");

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

function runPush(label, databaseUrl) {
  console.log(`\n--- ${label} ---\n`);
  const env = { ...process.env, DATABASE_URL: databaseUrl };
  const ensure = spawnSync("node", [path.join(__dirname, "ensure-abanote-schema.mjs")], {
    cwd: libDbRoot,
    env,
    stdio: "inherit",
  });
  if (ensure.status !== 0) {
    process.exit(ensure.status ?? 1);
  }
  // Do not use --force here: on managed DBs it can try to drop `abanote` and fail with
  // "cannot drop schema abanote because other objects depend on it" (2BP01).
  const push = spawnSync(
    "pnpm",
    ["exec", "drizzle-kit", "push", "--config", "./drizzle.config.ts"],
    { cwd: libDbRoot, env, stdio: "inherit" },
  );
  if (push.status !== 0) {
    process.exit(push.status ?? 1);
  }
}

const fileEnv = loadDotEnv(envPath);
const prodUrl = fileEnv.DATABASE_URL;
if (!prodUrl) {
  console.error("DATABASE_URL not set in artifacts/api-server/.env");
  process.exit(1);
}

runPush("production (DATABASE_URL)", prodUrl);

const stagingUrl = fileEnv.DATABASE_URL_STAGING?.trim();
if (stagingUrl && stagingUrl !== prodUrl) {
  runPush("staging (DATABASE_URL_STAGING)", stagingUrl);
} else {
  console.log("\n--- Skipping staging (no DATABASE_URL_STAGING or same as production) ---\n");
}
