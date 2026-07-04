import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  GenerateNoteBody,
  GenerateNoteResponse,
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
import { normalizeLegacyTherapySetting } from "@workspace/therapy-settings";
import { db } from "@workspace/db";
import { clientsTable, companiesTable, notesTable } from "@workspace/db/schema";
import { isOpenAINoteGenerationConfigured } from "../openai-notes";
import { generateSessionNoteForClient } from "../notes-service";
import { evaluateBilling, recordSavedNote } from "../billing/service";
import {
  draftCapMessage,
  getMaxUnsavedDraftsForCompany,
  readDraftQuotaForUser,
  resetDraftQuotaForUser,
  tryConsumeDraftSlot,
} from "../draft-quota";
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

router.post("/notes/generate", async (req, res) => {
  const companyId = req.companyId;
  const userId = req.userId;
  if (companyId === undefined || userId === undefined) {
    res.status(401).json({ success: false, error: "Unauthorized", messages: [] });
    return;
  }

  const raw = req.body;
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

  const body = GenerateNoteBody.parse(bodyIn);

  if (process.env.ENFORCE_COMPLIMENTARY_ACCESS === "true") {
    const [co] = await db
      .select()
      .from(companiesTable)
      .where(eq(companiesTable.id, companyId))
      .limit(1);
    if (!co?.freeUsage) {
      res.status(402).json({
        success: false,
        error: "Complimentary or paid access required for note generation.",
        messages: [],
      });
      return;
    }
  }

  // Stripe billing gate (independent of the legacy ENFORCE_COMPLIMENTARY_ACCESS flag). When the
  // server is configured with BILLING_ENFORCEMENT=off (default) this resolves to a permissive
  // decision so the legacy flow is untouched. Policy:
  //   - subscribed/trialing within grace → generation BLOCKED (user can still save in-progress)
  //   - suspended (no sub, expired sub, manually suspended) → generation BLOCKED
  //   - complimentary → always allowed
  const billing = await evaluateBilling(companyId);
  if (billing && !billing.generationAllowed) {
    res.status(402).json({
      success: false,
      error: billing.blockedReason ?? "Subscription required to generate new notes.",
      messages: [],
    });
    return;
  }

  if (!isOpenAINoteGenerationConfigured()) {
    res.status(503).json({
      success: false,
      error: "AI note generation is not configured on the server.",
      messages: [
        "OPENAI_API_KEY is missing or empty. Set it in artifacts/api-server/.env (or your host environment) and restart the API (e.g. pm2 restart abanoteassistant-api). " +
          "Session notes are generated only with OpenAI; there is no template fallback.",
      ],
    });
    return;
  }

  const [client] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.id, body.clientId), eq(clientsTable.companyId, companyId)))
    .limit(1);

  if (!client) {
    res.status(404).json({ success: false, error: "Client not found", messages: [] });
    return;
  }

  // Policy: no session note generation without an assessment on file for this client.
  if (!client.hasAssessment || client.assessmentStatus === "missing") {
    res.status(422).json({
      success: false,
      error: "Assessment required",
      messages: [
        "This client does not have an assessment on file. Upload an assessment (e.g. FBA/BIP PDF) for the client before generating session notes.",
      ],
    });
    return;
  }

  // Unsaved-draft cap. Atomically reserves one of MAX_UNSAVED_DRAFTS slots BEFORE we make the
  // expensive OpenAI call. Two concurrent requests from two tabs can't race past the cap because
  // the slot-consume update is a single CAS-style WHERE count < max. On 429 the UI shows the
  // calm SaaS copy from `draftCapMessage()` and either saves a draft or POSTs /notes/drafts/discard
  // to free the pool. Slots are also reserved even when generation later fails — intentional, so
  // a flaky AI provider can't be turned into an unlimited-regenerate loophole; the user can
  // always click "Discard drafts" to recover. Validation/lookup failures above this point don't
  // burn a slot because they short-circuit before we get here.
  const [companyForCap] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, companyId))
    .limit(1);
  const maxUnsavedDrafts = getMaxUnsavedDraftsForCompany(companyForCap ?? null);
  const slot = await tryConsumeDraftSlot(userId, maxUnsavedDrafts);
  if (!slot.ok) {
    res.status(429).json({
      success: false,
      error: draftCapMessage(maxUnsavedDrafts),
      messages: [],
      draftQuota: { used: slot.used, max: slot.max },
    });
    return;
  }

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
