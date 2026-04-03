import "./load-local-env";
import app from "./app";
import { isOpenAINoteGenerationConfigured } from "./openai-notes";

/**
 * Prefer API_PORT_PROD / API_PORT_STAGING over generic PORT. PM2 or the host may inject
 * PORT=4000 (e.g. Replit-style) while nginx still proxies to 5002/5007 — that caused 502s.
 */
function resolveListenPortEnv(): string | undefined {
  // Bracket form: esbuild `define: { "process.env.NODE_ENV": '"production"' }` in build.ts
  // must not replace this read — otherwise staging PM2 always binds API_PORT_PROD.
  const nodeEnv = process.env["NODE_ENV"];
  const prod = process.env.API_PORT_PROD?.trim();
  const stg = process.env.API_PORT_STAGING?.trim();
  if (nodeEnv === "production" && prod) {
    return prod;
  }
  if (nodeEnv === "staging" && stg) {
    return stg;
  }
  return process.env.PORT?.trim();
}

const rawPort = resolveListenPortEnv();

if (!rawPort) {
  throw new Error(
    "PORT (or API_PORT_PROD / API_PORT_STAGING for PM2) must be set.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  if (isOpenAINoteGenerationConfigured()) {
    console.log("[notes] OpenAI clinical narrative: enabled (OPENAI_API_KEY is set)");
  } else {
    console.warn(
      "[notes] OPENAI_API_KEY is missing — POST /notes/generate will return 503 until set in artifacts/api-server/.env (then restart the API).",
    );
  }
});
