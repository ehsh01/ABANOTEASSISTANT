import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { GenerateNoteBody } from "@workspace/api-zod";
import { db } from "@workspace/db";
import {
  clientsTable,
  companiesTable,
  noteGenerationJobsTable,
  type ClientProfileRow,
  type NoteGenerationJobResultData,
} from "@workspace/db/schema";
import { normalizeLegacyTherapySetting } from "@workspace/therapy-settings";
import { withTransientDbRetry } from "./db-transient-retry";
import { evaluateBilling } from "./billing/service";
import {
  draftCapMessage,
  getMaxUnsavedDraftsForCompany,
  tryConsumeDraftSlot,
} from "./draft-quota";
import { isOpenAINoteGenerationConfigured } from "./openai-notes";
import { generateSessionNoteForClient } from "./notes-service";
import { assessmentGenerationGate } from "./note-readiness";

type DraftSlot = { used: number; max: number };

export type PrepareNoteGenerationFailure = {
  ok: false;
  status: number;
  error: string;
  messages: string[];
  draftQuota?: DraftSlot;
};

export type PrepareNoteGenerationSuccess = {
  ok: true;
  companyId: number;
  userId: number;
  client: typeof clientsTable.$inferSelect;
  body: ReturnType<typeof GenerateNoteBody.parse>;
  draftQuota: DraftSlot;
};

export type PrepareNoteGenerationResult =
  | PrepareNoteGenerationSuccess
  | PrepareNoteGenerationFailure;

function parseGenerateNoteBody(raw: unknown): ReturnType<typeof GenerateNoteBody.parse> {
  const bodyIn =
    raw != null && typeof raw === "object"
      ? {
          ...(raw as Record<string, unknown>),
          therapySetting:
            typeof (raw as { therapySetting?: unknown }).therapySetting === "string"
              ? normalizeLegacyTherapySetting((raw as { therapySetting: string }).therapySetting)
              : (raw as { therapySetting?: unknown }).therapySetting,
        }
      : raw;
  return GenerateNoteBody.parse(bodyIn);
}

/** Shared gates for sync POST /notes/generate and async POST /notes/generate/jobs. */
export async function prepareNoteGeneration(params: {
  companyId: number;
  userId: number;
  rawBody: unknown;
}): Promise<PrepareNoteGenerationResult> {
  const { companyId, userId } = params;

  let body: ReturnType<typeof GenerateNoteBody.parse>;
  try {
    body = parseGenerateNoteBody(params.rawBody);
  } catch {
    return { ok: false, status: 400, error: "Invalid request body", messages: [] };
  }

  if (process.env.ENFORCE_COMPLIMENTARY_ACCESS === "true") {
    const [co] = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, companyId))
      .limit(1);
    if (!co?.freeUsage) {
      return {
        ok: false,
        status: 402,
        error: "Complimentary or paid access required for note generation.",
        messages: [],
      };
    }
  }

  const billing = await evaluateBilling(companyId);
  if (billing && !billing.generationAllowed) {
    return {
      ok: false,
      status: 402,
      error: billing.blockedReason ?? "Subscription required to generate new notes.",
      messages: [],
    };
  }

  if (!isOpenAINoteGenerationConfigured()) {
    return {
      ok: false,
      status: 503,
      error: "AI note generation is not configured on the server.",
      messages: [
        "OPENAI_API_KEY is missing or empty. Set it in artifacts/api-server/.env (or your host environment) and restart the API (e.g. pm2 restart abanoteassistant-api). " +
          "Session notes are generated only with OpenAI; there is no template fallback.",
      ],
    };
  }

  const [client] = await withTransientDbRetry(
    () =>
      db
        .select()
        .from(clientsTable)
        .where(and(eq(clientsTable.id, body.clientId), eq(clientsTable.companyId, companyId)))
        .limit(1),
    { label: "load client" },
  );

  if (!client) {
    return { ok: false, status: 404, error: "Client not found", messages: [] };
  }

  const assessmentGate = assessmentGenerationGate({
    hasAssessment: client.hasAssessment,
    assessmentStatus: client.assessmentStatus,
    profile: client.profile as ClientProfileRow | null | undefined,
  });
  if (!assessmentGate.ok) return assessmentGate;

  const [companyForCap] = await withTransientDbRetry(
    () =>
      db
        .select()
        .from(companiesTable)
        .where(eq(companiesTable.id, companyId))
        .limit(1),
    { label: "load company for draft cap" },
  );
  const maxUnsavedDrafts = getMaxUnsavedDraftsForCompany(companyForCap ?? null);
  const slot = await tryConsumeDraftSlot(userId, maxUnsavedDrafts);
  if (!slot.ok) {
    return {
      ok: false,
      status: 429,
      error: draftCapMessage(maxUnsavedDrafts),
      messages: [],
      draftQuota: { used: slot.used, max: slot.max },
    };
  }

  return {
    ok: true,
    companyId,
    userId,
    client,
    body,
    draftQuota: { used: slot.used, max: slot.max },
  };
}

async function markJobFailed(
  jobId: string,
  status: number,
  error: string,
  messages: string[],
): Promise<void> {
  const now = new Date();
  await withTransientDbRetry(
    () =>
      db
        .update(noteGenerationJobsTable)
        .set({
          status: "failed",
          errorMessage: error,
          errorStatus: status,
          errorMessages: messages.length > 0 ? messages : null,
          updatedAt: now,
          completedAt: now,
        })
        .where(eq(noteGenerationJobsTable.id, jobId)),
    { label: "mark job failed" },
  );
}

/** Runs OpenAI generation for a pending job (fire-and-forget from the HTTP handler). */
export async function runNoteGenerationJob(jobId: string): Promise<void> {
  const [job] = await withTransientDbRetry(
    () =>
      db
        .select()
        .from(noteGenerationJobsTable)
        .where(eq(noteGenerationJobsTable.id, jobId))
        .limit(1),
    { label: "load job" },
  );

  if (!job || job.status !== "pending") {
    return;
  }

  const now = new Date();
  await withTransientDbRetry(
    () =>
      db
        .update(noteGenerationJobsTable)
        .set({ status: "running", updatedAt: now })
        .where(eq(noteGenerationJobsTable.id, jobId)),
    { label: "mark job running" },
  );

  const [client] = await withTransientDbRetry(
    () =>
      db
        .select()
        .from(clientsTable)
        .where(and(eq(clientsTable.id, job.clientId), eq(clientsTable.companyId, job.companyId)))
        .limit(1),
    { label: "load client for job" },
  );

  if (!client) {
    await markJobFailed(jobId, 404, "Client not found", []);
    return;
  }
  const assessmentGate = assessmentGenerationGate({
    hasAssessment: client.hasAssessment,
    assessmentStatus: client.assessmentStatus,
    profile: client.profile as ClientProfileRow | null | undefined,
  });
  if (!assessmentGate.ok) {
    await markJobFailed(
      jobId,
      assessmentGate.status,
      assessmentGate.error,
      assessmentGate.messages,
    );
    return;
  }

  let body: ReturnType<typeof GenerateNoteBody.parse>;
  try {
    body = parseGenerateNoteBody(job.requestBody);
  } catch {
    await markJobFailed(jobId, 400, "Invalid stored job request body", []);
    return;
  }

  const result = await generateSessionNoteForClient({
    companyId: job.companyId,
    client,
    body,
  });

  if (!result.ok) {
    await markJobFailed(jobId, result.status, result.error, result.messages);
    return;
  }

  const resultData: NoteGenerationJobResultData = {
    noteId: result.noteId,
    content: result.content,
    clientId: client.id,
    clientName: client.name,
    sessionDate: body.sessionDate,
    sessionHours: body.sessionHours,
    generatedAt: result.generatedAt.toISOString(),
    generationSource: "openai",
    generationModel: result.generationModel,
    maladaptiveReplacementPairings: result.maladaptiveReplacementPairings,
    draftQuota: { used: job.draftSlotUsed, max: job.draftSlotMax },
  };

  const completedAt = new Date();
  await withTransientDbRetry(
    () =>
      db
        .update(noteGenerationJobsTable)
        .set({
          status: "completed",
          resultData,
          warnings: result.warnings.length > 0 ? result.warnings : null,
          updatedAt: completedAt,
          completedAt,
        })
        .where(eq(noteGenerationJobsTable.id, jobId)),
    { label: "mark job completed" },
  );
}

export async function createNoteGenerationJobRecord(params: {
  companyId: number;
  userId: number;
  clientId: number;
  body: ReturnType<typeof GenerateNoteBody.parse>;
  draftQuota: DraftSlot;
}): Promise<string> {
  const jobId = randomUUID();
  const now = new Date();
  await withTransientDbRetry(
    () =>
      db.insert(noteGenerationJobsTable).values({
        id: jobId,
        companyId: params.companyId,
        userId: params.userId,
        clientId: params.clientId,
        status: "pending",
        requestBody: params.body as unknown as Record<string, unknown>,
        draftSlotUsed: params.draftQuota.used,
        draftSlotMax: params.draftQuota.max,
        resultData: null,
        warnings: null,
        errorMessage: null,
        errorStatus: null,
        errorMessages: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      }),
    { label: "create job" },
  );
  return jobId;
}

export function enqueueNoteGenerationJob(jobId: string): void {
  setImmediate(() => {
    void runNoteGenerationJob(jobId).catch((err) => {
      console.error("[note-generation-job] unhandled failure", jobId, err);
      void markJobFailed(
        jobId,
        500,
        "Note generation failed unexpectedly",
        [err instanceof Error ? err.message : String(err)],
      );
    });
  });
}
