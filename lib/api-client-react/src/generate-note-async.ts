import { ApiError } from "./custom-fetch";
import { createNoteGenerationJob, getNoteGenerationJob } from "./generated/api";
import type { GenerateNoteRequest, GenerateNoteResponse } from "./generated/api.schemas";

/** Poll interval while waiting for OpenAI note generation (async job). */
const POLL_INTERVAL_MS = 2500;
/** Stop polling after this long and ask the user to retry. */
const MAX_POLL_MS = 20 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Start async note generation and poll until complete.
 *
 * Avoids Cloudflare/nginx gateway timeouts on long multi-hour sessions by returning from POST
 * immediately (HTTP 202) and polling GET /notes/generate/jobs/:jobId until the job finishes.
 */
export async function generateNoteAsync(
  request: GenerateNoteRequest,
): Promise<GenerateNoteResponse> {
  const created = await createNoteGenerationJob(request);
  const jobId = created.data.jobId;
  const started = Date.now();

  while (Date.now() - started < MAX_POLL_MS) {
    await sleep(POLL_INTERVAL_MS);
    const job = await getNoteGenerationJob(jobId);
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

  throw new Error(
    "Note generation is taking longer than expected. Please wait a moment and try again.",
  );
}
