/**
 * Local `pnpm dev` does not use PM2, so `ecosystem.config.cjs` never loads `.env`.
 * In development-like NODE_ENV, merge `.env` into `process.env` (without overriding
 * non-empty variables already set by the shell or host).
 *
 * Resolves the file from `process.cwd()` so it works when cwd is the package dir
 * (`artifacts/api-server`) or the monorepo root (PM2 `cwd`).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function parseDotEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
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

const nodeEnv = process.env.NODE_ENV;
const loadFile =
  nodeEnv === "development" || nodeEnv === "test" || nodeEnv === undefined;

function resolveEnvFilePath(): string | null {
  const cwd = process.cwd();
  const candidates = [
    resolve(cwd, ".env"),
    resolve(cwd, "artifacts/api-server/.env"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      return p;
    }
  }
  return null;
}

if (loadFile) {
  const envPath = resolveEnvFilePath();
  if (envPath) {
    const parsed = parseDotEnv(readFileSync(envPath, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      const cur = process.env[key];
      if (cur === undefined || cur === "") {
        process.env[key] = value;
      }
    }
  }
}
