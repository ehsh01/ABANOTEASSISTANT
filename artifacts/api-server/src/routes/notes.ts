import { Router, type IRouter } from "express";
import {
  GenerateNoteResponse,
  GetNoteGenerationJobParams,
  GetNoteGenerationJobResponse,
  ListNotesResponse,
  ListAbcBuilderActivityAntecedentsResponse,
  GetNoteParams,
  GetNoteResponse,
  DeleteNoteParams,
  DeleteNoteResponse,
  SaveNoteParams,
  SaveNoteBody,
  SaveNoteResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import { clientsTable, companiesTable, noteGenerationJobsTable, notesTable } from "@workspace/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { generateSessionNoteForClient } from "../notes-service";
import { evaluateBilling, recordSavedNote } from "../billing/service";
import {
  getMaxUnsavedDraftsForCompany,
  readDraftQuotaForUser,
  resetDraftQuotaForUser,
} from "../draft-quota";
import {
  createNoteGenerationJobRecord,
  enqueueNoteGenerationJob,
  prepareNoteGeneration,
} from "../note-generation-jobs";
import { ABC_ACTIVITY_ANTECEDENT_CATALOG } from "../abc-activity-antecedent-catalog";

const router: IRouter = Router();

function toIso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : String(d);
}

function normalizeNoteStatus(value: string): "draft" | "final" {
  return value === "final" ? "final" : "draft";
}

router.get("/notes", async (req, res) => {
  const companyId = req.companyId;
  if (companyId === undefined) {
    res.status(401).json({ success: false, error: "Unauthorized", messages: [] });
    return;
  }

  const rows = await db
    .select({
      noteId: notesTable.id,
      clientId: notesTable.clientId,
      clientName: clientsTable.name,
      status: notesTable.status,
      sessionDate: notesTable.sessionDate,
      sessionHours: notesTable.sessionHours,
      generatedAt: notesTable.generatedAt,
      createdAt: notesTable.createdAt,
      updatedAt: notesTable.updatedAt,
    })
    .from(notesTable)
    .innerJoin(clientsTable, eq(notesTable.clientId, clientsTable.id))
    .where(and(eq(notesTable.companyId, companyId), eq(clientsTable.companyId, companyId)))
    .orderBy(desc(notesTable.generatedAt));

  const data = ListNotesResponse.parse({
    success: true,
    data: rows.map((r) => ({
      noteId: r.noteId,
      clientId: r.clientId,
      clientName: r.clientName,
      status: normalizeNoteStatus(r.status),
      sessionDate: r.sessionDate,
      sessionHours: r.sessionHours,
      generatedAt: toIso(r.generatedAt),
      createdAt: toIso(r.createdAt),
      updatedAt: toIso(r.updatedAt),
    })),
  });

  res.json(data);
});

router.get("/notes/abc-builder/activity-antecedents", async (req, res) => {
  const companyId = req.companyId;
  if (companyId === undefined) {
    res.status(401).json({ success: false, error: "Unauthorized", messages: [] });
    return;
  }

  const data = ListAbcBuilderActivityAntecedentsResponse.parse({
    success: true,
    data: { activities: [...ABC_ACTIVITY_ANTECEDENT_CATALOG] },
    error: null,
  });
  res.json(data);
});

// Static `/notes/draft-quota` and `/notes/drafts/discard` are registered BEFORE the dynamic
// `/notes/:noteId` route so Express matches them as literal paths rather than parsing
// "draft-quota" / "drafts" as a noteId. Per Express semantics, route order in the router
// determines match precedence.
router.get("/notes/draft-quota", async (req, res) => {
  const companyId = req.companyId;
  const userId = req.userId;
  if (companyId === undefined || userId === undefined) {
    res.status(401).json({ success: false, error: "Unauthorized", messages: [] });
    return;
  }
  const [companyRow] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId))
    .limit(1);
  const max = getMaxUnsavedDraftsForCompany(companyRow ?? null);
  const snapshot = await readDraftQuotaForUser(userId, max);
  res.json({ success: true, data: snapshot, error: null });
});

router.post("/notes/drafts/discard", async (req, res) => {
  const companyId = req.companyId;
  const userId = req.userId;
  if (companyId === undefined || userId === undefined) {
    res.status(401).json({ success: false, error: "Unauthorized", messages: [] });
    return;
  }
  const [companyRow] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId))
    .limit(1);
  const max = getMaxUnsavedDraftsForCompany(companyRow ?? null);
  const snapshot = await resetDraftQuotaForUser(userId, max);
  res.json({ success: true, data: snapshot, error: null });
});

router.get("/notes/:noteId", async (req, res) => {
  const companyId = req.companyId;
  if (companyId === undefined) {
    res.status(401).json({ success: false, error: "Unauthorized", messages: [] });
    return;
  }

  const params = GetNoteParams.parse(req.params);

  const [row] = await db
    .select({
      noteId: notesTable.id,
      clientId: notesTable.clientId,
      clientName: clientsTable.name,
      status: notesTable.status,
      sessionDate: notesTable.sessionDate,
      sessionHours: notesTable.sessionHours,
      generatedAt: notesTable.generatedAt,
      createdAt: notesTable.createdAt,
      updatedAt: notesTable.updatedAt,
      content: notesTable.content,
    })
    .from(notesTable)
    .innerJoin(clientsTable, eq(notesTable.clientId, clientsTable.id))
    .where(
      and(
        eq(notesTable.id, params.noteId),
        eq(notesTable.companyId, companyId),
        eq(clientsTable.companyId, companyId),
      ),
    )
    .limit(1);

  if (!row) {
    res.status(404).json({ success: false, error: "Note not found", messages: [] });
    return;
  }

  const data = GetNoteResponse.parse({
    success: true,
    data: {
      noteId: row.noteId,
      clientId: row.clientId,
      clientName: row.clientName,
      status: normalizeNoteStatus(row.status),
      sessionDate: row.sessionDate,
      sessionHours: row.sessionHours,
      generatedAt: toIso(row.generatedAt),
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
      content: row.content,
    },
  });

  res.json(data);
});

router.delete("/notes/:noteId", async (req, res) => {
  const companyId = req.companyId;
  if (companyId === undefined) {
    res.status(401).json({ success: false, error: "Unauthorized", messages: [] });
    return;
  }

  const params = DeleteNoteParams.parse(req.params);

  const [existing] = await db
    .select({ id: notesTable.id })
    .from(notesTable)
    .where(and(eq(notesTable.id, params.noteId), eq(notesTable.companyId, companyId)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ success: false, error: "Note not found", messages: [] });
    return;
  }

  await db.delete(notesTable).where(and(eq(notesTable.id, params.noteId), eq(notesTable.companyId, companyId)));

  const data = DeleteNoteResponse.parse({
    success: true,
    data: { noteId: params.noteId },
    error: null,
  });

  res.json(data);
});

router.post("/notes/generate/jobs", async (req, res) => {
  const companyId = req.companyId;
  const userId = req.userId;
  if (companyId === undefined || userId === undefined) {
    res.status(401).json({ success: false, error: "Unauthorized", messages: [] });
    return;
  }

  const prepared = await prepareNoteGeneration({
    companyId,
    userId,
    rawBody: req.body,
  });
  if (!prepared.ok) {
    res.status(prepared.status).json({
      success: false,
      error: prepared.error,
      messages: prepared.messages,
      ...(prepared.draftQuota ? { draftQuota: prepared.draftQuota } : {}),
    });
    return;
  }

  const jobId = await createNoteGenerationJobRecord({
    companyId: prepared.companyId,
    userId: prepared.userId,
    clientId: prepared.client.id,
    body: prepared.body,
    draftQuota: prepared.draftQuota,
  });
  enqueueNoteGenerationJob(jobId);

  res.status(202).json({
    success: true,
    data: { jobId, status: "pending" as const },
    error: null,
  });
});

router.get("/notes/generate/jobs/:jobId", async (req, res) => {
  const companyId = req.companyId;
  const userId = req.userId;
  if (companyId === undefined || userId === undefined) {
    res.status(401).json({ success: false, error: "Unauthorized", messages: [] });
    return;
  }

  const params = GetNoteGenerationJobParams.parse(req.params);
  const [job] = await db
    .select()
    .from(noteGenerationJobsTable)
    .where(
      and(
        eq(noteGenerationJobsTable.id, params.jobId),
        eq(noteGenerationJobsTable.companyId, companyId),
        eq(noteGenerationJobsTable.userId, userId),
      ),
    )
    .limit(1);

  if (!job) {
    res.status(404).json({ success: false, error: "Job not found", messages: [] });
    return;
  }

  if (job.status === "pending" || job.status === "running") {
    const payload = GetNoteGenerationJobResponse.parse({
      success: true,
      data: { jobId: job.id, status: job.status },
      error: null,
    });
    res.json(payload);
    return;
  }

  if (job.status === "failed") {
    const payload = GetNoteGenerationJobResponse.parse({
      success: true,
      data: { jobId: job.id, status: "failed" },
      error: job.errorMessage ?? "Note generation failed",
      messages: job.errorMessages ?? [],
    });
    res.json(payload);
    return;
  }

  const note = job.resultData;
  if (!note) {
    res.status(500).json({
      success: false,
      error: "Completed job is missing result data",
      messages: [],
    });
    return;
  }

  const payload = GetNoteGenerationJobResponse.parse({
    success: true,
    data: {
      jobId: job.id,
      status: "completed",
      note,
      draftQuota: note.draftQuota,
    },
    warnings: job.warnings && job.warnings.length > 0 ? job.warnings : undefined,
    error: null,
  });
  res.json(payload);
});

router.post("/notes/generate", async (req, res) => {
  const companyId = req.companyId;
  const userId = req.userId;
  if (companyId === undefined || userId === undefined) {
    res.status(401).json({ success: false, error: "Unauthorized", messages: [] });
    return;
  }

  const prepared = await prepareNoteGeneration({
    companyId,
    userId,
    rawBody: req.body,
  });
  if (!prepared.ok) {
    res.status(prepared.status).json({
      success: false,
      error: prepared.error,
      messages: prepared.messages,
      ...(prepared.draftQuota ? { draftQuota: prepared.draftQuota } : {}),
    });
    return;
  }

  const { client, body, draftQuota: slot } = prepared;

  const result = await generateSessionNoteForClient({ companyId, client, body });
  if (!result.ok) {
    res.status(result.status).json({
      success: false,
      error: result.error,
      messages: result.messages,
    });
    return;
  }

  res.setHeader("X-ABA-Clinical-Body-Source", "openai");
  res.setHeader("X-ABA-OpenAI-Model", result.generationModel);

  const data = GenerateNoteResponse.parse({
    success: true,
    data: {
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
      draftQuota: { used: slot.used, max: slot.max },
    },
    warnings: result.warnings.length > 0 ? result.warnings : undefined,
    error: null,
  });

  res.json(data);
});

router.post("/notes/:noteId/save", async (req, res) => {
  const companyId = req.companyId;
  const userId = req.userId;
  if (companyId === undefined || userId === undefined) {
    res.status(401).json({ success: false, error: "Unauthorized", messages: [] });
    return;
  }

  const params = SaveNoteParams.parse(req.params);
  const body = SaveNoteBody.parse(req.body);

  const [existing] = await db
    .select()
    .from(notesTable)
    .where(and(eq(notesTable.id, params.noteId), eq(notesTable.companyId, companyId)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ success: false, error: "Note not found", messages: [] });
    return;
  }

  // Stripe billing gate. When BILLING_ENFORCEMENT=off this is permissive and behaves like before.
  // Quota check happens BEFORE the DB write so we never persist a save we won't count.
  const billing = await evaluateBilling(companyId);
  if (billing && !billing.saveAllowed) {
    res.status(402).json({
      success: false,
      error: billing.blockedReason ?? "Plan limit reached for this period.",
      messages: [],
    });
    return;
  }

  // Soft-warn just below quota when enforcement is on (any level). UI gets the message via the
  // optional `warnings` field on SaveNoteResponse — backward compatible.
  const warnings: string[] = [];
  if (
    billing &&
    billing.enforcement !== "off" &&
    billing.savedQuota !== null &&
    billing.derivedMode !== "complimentary"
  ) {
    const remaining = billing.savedQuota - billing.savedThisPeriod;
    if (remaining > 0 && remaining <= Math.max(1, Math.floor(billing.savedQuota * 0.15))) {
      const isAppManagedTrial = billing.derivedMode === "trial" && !billing.plan;
      warnings.push(
        isAppManagedTrial
          ? `Only ${remaining} saved notes remaining in your free trial. Subscribe to keep going without interruption.`
          : `Only ${remaining} saved notes remaining in this billing period before you reach your plan limit.`,
      );
    }
  }

  const now = new Date();
  await db
    .update(notesTable)
    .set({
      status: body.status,
      content: body.content,
      updatedAt: now,
    })
    .where(and(eq(notesTable.id, params.noteId), eq(notesTable.companyId, companyId)));

  let savedThisPeriodAfter = billing?.savedThisPeriod ?? 0;
  let countedThisRequest = false;
  if (billing && billing.derivedMode !== "complimentary") {
    const ledger = await recordSavedNote({
      decision: billing,
      noteId: params.noteId,
      userId,
    });
    savedThisPeriodAfter = ledger.savedThisPeriod;
    countedThisRequest = ledger.countedThisRequest;
  }

  // Saving *any* draft frees the entire unsaved-draft pool for this user. The UI uses the
  // returned `draftQuota: { used: 0, max }` snapshot to re-enable Generate without an extra
  // round trip. `billing` is set on every save path (evaluateBilling always returns a decision
  // when the company exists, which we just verified above by looking up the note); we still
  // null-check it to satisfy the type system.
  const maxUnsavedDraftsAfterSave = getMaxUnsavedDraftsForCompany(billing?.company ?? null);
  const draftQuotaAfterSave = await resetDraftQuotaForUser(userId, maxUnsavedDraftsAfterSave);

  const includeBillingSnapshot = !!billing && billing.enforcement !== "off";
  const data = SaveNoteResponse.parse({
    success: true,
    data: {
      noteId: params.noteId,
      status: body.status,
      ...(includeBillingSnapshot && billing
        ? {
            billing: {
              billingMode: billing.derivedMode,
              savedThisPeriod: savedThisPeriodAfter,
              savedQuota: billing.savedQuota,
              countedThisRequest,
            },
          }
        : {}),
      draftQuota: draftQuotaAfterSave,
    },
    error: null,
    ...(warnings.length > 0 ? { warnings } : {}),
  });

  res.json(data);
});

export default router;
