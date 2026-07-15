import { ApiError, ResponseParseError } from "./custom-fetch";
import { createNoteGenerationJob, getNoteGenerationJob } from "./generated/api";
import type {
  CreateNoteGenerationJobResponse,
  GenerateNoteRequest,
  GenerateNoteResponse,
} from "./generated/api.schemas";

/** Poll interval while waiting for OpenAI note generation (async job). */
const POLL_INTERVAL_MS = 2500;
/** Stop polling after this long and ask the user to retry. */
const MAX_POLL_MS = 20 * 60 * 1000;
/** Retry the job-create POST this many times when it hits a transient gateway/network error. */
const MAX_CREATE_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * True when a thrown request error is transient (a gateway/edge blip or network error) rather than a
 * definitive client/server rejection. Cloudflare returns an HTML **524/502/503/504** while the origin
 * is briefly slow or saturated; that surfaces here as either an ApiError (5xx / 0) or a
 * ResponseParseError (HTML body that is not JSON). None of these mean the note generation job failed —
 * the job runs server-side regardless — so we must keep polling instead of aborting the whole wait.
 */
function isTransientRequestError(error: unknown): boolean {
  if (error instanceof ResponseParseError) return true;
  if (error instanceof ApiError) {
    const s = error.status;
    // 0/undefined => network error; 408 timeout; 425 too early; 429 rate limit; any 5xx (incl. 520-524).
    return s === 0 || s === 408 || s === 425 || s === 429 || s >= 500;
  }
  // TypeError etc. from fetch (DNS/offline/CORS blips) — treat as transient and keep polling.
  return error instanceof TypeError;
}

async function createJobWithRetry(
  request: GenerateNoteRequest,
): Promise<CreateNoteGenerationJobResponse> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_CREATE_ATTEMPTS; attempt += 1) {
    try {
      return await createNoteGenerationJob(request);
    } catch (error) {
      lastError = error;
      // Client rejections (validation, auth, draft-quota 4xx) are definitive — surface immediately.
      if (!isTransientRequestError(error) || attempt === MAX_CREATE_ATTEMPTS) {
        throw error;
      }
      await sleep(1500 * attempt);
    }
  }
  throw lastError;
}

/**
 * Start async note generation and poll until complete.
 *
 * Avoids Cloudflare/nginx gateway timeouts on long multi-hour sessions by returning from POST
 * immediately (HTTP 202) and polling GET /notes/generate/jobs/:jobId until the job finishes.
 *
 * Individual poll requests are resilient: a transient gateway error (e.g. a one-off Cloudflare 524
 * while the origin is briefly busy) does NOT abort the wait — the job keeps running server-side, so we
 * log and keep polling until it reports `completed`/`failed` or the overall deadline is reached.
 */
export async function generateNoteAsync(
  request: GenerateNoteRequest,
): Promise<GenerateNoteResponse> {
  const created = await createJobWithRetry(request);
  const jobId = created.data.jobId;
  const started = Date.now();
  let lastTransientError: unknown = null;

  while (Date.now() - started < MAX_POLL_MS) {
    await sleep(POLL_INTERVAL_MS);

    let job: Awaited<ReturnType<typeof getNoteGenerationJob>>;
    try {
      job = await getNoteGenerationJob(jobId);
    } catch (error) {
      if (isTransientRequestError(error)) {
        // Edge/origin blip — the job is unaffected. Keep polling.
        lastTransientError = error;
        continue;
      }
      throw error;
    }

    const status = job.data.status;

    if (status === "completed") {
      const note = job.data.note;
      if (!note) {
        throw new Error("Note generation completed but no note was returned.");
      }
      return {
        success: true,
        data: note,
        warnings: job.warnings,
        error: null,
      };
    }

    if (status === "failed") {
      const errorBody = {
        success: false as const,
        error: job.error ?? "Note generation failed",
        messages: job.messages ?? [],
      };
      throw new ApiError(
        new Response(JSON.stringify(errorBody), {
          status: 502,
          statusText: "Note generation failed",
          headers: { "Content-Type": "application/json" },
        }),
        errorBody,
        { method: "GET", url: `/api/notes/generate/jobs/${jobId}` },
      );
    }
  }

  const timeoutHint =
    lastTransientError instanceof Error ? ` (last poll error: ${lastTransientError.message})` : "";
  throw new Error(
    `Note generation is taking longer than expected. Please wait a moment and try again.${timeoutHint}`,
  );
}
