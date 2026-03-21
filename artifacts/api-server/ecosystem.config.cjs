/**
 * PM2 Ecosystem Configuration for ABA Note Assistant
 *
 * Loads `artifacts/api-server/.env` so PM2 does not inherit unrelated shell/PM2 globals.
 * Production listens on 5002, staging on 5007 by default (override via API_PORT_PROD / API_PORT_STAGING in .env).
 *
 * Must be `.cjs` because `artifacts/api-server/package.json` has `"type": "module"`.
 *
 * Usage (from repo root):
 *   pm2 start artifacts/api-server/ecosystem.config.cjs --only abanoteassistant-api
 *   pm2 start artifacts/api-server/ecosystem.config.cjs --only abanoteassistant-api-staging
 */

const fs = require("fs");
const path = require("path");

/** @param {string} filePath */
function loadDotEnv(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) {
    return out;
  }
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
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

const envPath = path.join(__dirname, ".env");
const fileEnv = loadDotEnv(envPath);

/** @param {string} key */
function env(key) {
  if (Object.prototype.hasOwnProperty.call(fileEnv, key) && fileEnv[key] !== "") {
    return fileEnv[key];
  }
  const v = process.env[key];
  return v === undefined || v === "" ? undefined : v;
}

const repoRoot = path.resolve(__dirname, "../..");

function prodEnv() {
  // Spread `.env` so Resend, APP_ORIGIN, etc. reach the Node process (previously only
  // DATABASE_URL + JWT_SECRET were passed, so RESEND_API_KEY in .env was ignored).
  const e = {
    ...fileEnv,
    NODE_ENV: "production",
    PORT: env("API_PORT_PROD") || "5002",
  };
  const db = env("DATABASE_URL");
  const jwt = env("JWT_SECRET");
  if (db) {
    e.DATABASE_URL = db;
  }
  if (jwt) {
    e.JWT_SECRET = jwt;
  }
  return e;
}

function stagingEnv() {
  const e = {
    ...fileEnv,
    NODE_ENV: "staging",
    PORT: env("API_PORT_STAGING") || "5007",
  };
  const db = env("DATABASE_URL_STAGING") || env("DATABASE_URL");
  const jwt = env("JWT_SECRET_STAGING") || env("JWT_SECRET");
  if (db) {
    e.DATABASE_URL = db;
  }
  if (jwt) {
    e.JWT_SECRET = jwt;
  }
  return e;
}

module.exports = {
  apps: [
    {
      name: "abanoteassistant-api",
      script: "artifacts/api-server/dist/index.cjs",
      cwd: repoRoot,
      instances: 2,
      exec_mode: "cluster",
      env: prodEnv(),
      error_file: "./logs/abanoteassistant-api-error.log",
      out_file: "./logs/abanoteassistant-api-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      watch: false,
    },
    {
      name: "abanoteassistant-api-staging",
      script: "artifacts/api-server/dist/index.cjs",
      cwd: repoRoot,
      instances: 1,
      exec_mode: "cluster",
      env: stagingEnv(),
      error_file: "./logs/abanoteassistant-api-staging-error.log",
      out_file: "./logs/abanoteassistant-api-staging-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      watch: false,
    },
  ],
};
