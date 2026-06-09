import { randomUUID } from "node:crypto";
import { APIError } from "openai";
import { Router, type IRouter } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
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
import {
  clientsTable,
  companiesTable,
  programsTable,
  clientProgramsTable,
  notesTable,
  type ClientProfileRow,
} from "@workspace/db/schema";
import {
  generateClinicalBodyOpenAI,
  isOpenAINoteGenerationConfigured,
  openaiNoteGenerationLabel,
  resolvedOpenAIModel,
  type NoteGenerationContext,
} from "../openai-notes";
import { evaluateBilling, recordSavedNote } from "../billing/service";
import {
  draftCapMessage,
  getMaxUnsavedDraftsForCompany,
  readDraftQuotaForUser,
  resetDraftQuotaForUser,
  tryConsumeDraftSlot,
} from "../draft-quota";
import { maladaptiveBehaviorTargetsForNoteCatalog } from "../client-profile-maladaptive";
import {
  approximateAgeYearsAtSession,
  canonicalMaladaptiveBehaviorLabel,
  maladaptiveBehaviorsCatalogForRotation,
  maladaptiveBehaviorsForSessionHours,
  replacementProgramAssignmentsForSessionHours,
  rebalanceTaskRefusalReplacementProgramsHourly,
  rebalanceBehaviorMappedReplacementProgramsHourly,
  buildBehaviorReplacementCandidatesForNarrativeSegments,
  isSundaySessionDate,
  replacementProgramPoolForAutoAssignment,
  replacementProgramSlotCount,
  validateCaregiverMentionRule,
  validateClinicalBodyCompliance,
  collapseHourlyNoteNarrativeToSegments,
  type NoteComplianceContext,
  type TherapistTrialSummaryForHourEntry,
} from "../note-validation";
import {
  buildLockedOpening,
  buildNextSessionSentence,
  buildPerformanceSentence,
  LOCKED_CLOSING_PARAGRAPH,
  type TherapySetting,
} from "../note-assembly";
import { truncateAssessmentTextForNoteContext } from "../assessment-extract";
import {
  getAssessmentStructuredFromProfile,
  intersectCatalog,
  validateAssessmentStructured,
} from "../assessment-structured";
import { resolveAbcHintsForNoteGeneration } from "../abc-hints";
import { isLanguageMaladaptiveBehaviorLabel } from "../language-maladaptive-behavior";
import {
  isSkillAcquisitionOnlyReplacementProgram,
  maladaptiveReplacementPairingsForSessionNote,
} from "../skill-acquisition-programs";
import { ABC_ACTIVITY_ANTECEDENT_CATALOG } from "../abc-activity-antecedent-catalog";

/**
 * Per-hour trial summary for the AI when `programTrialData` has a usable entry for that hour's program id.
 * Indices outside 1..count are dropped; duplicates removed; list sorted ascending.
 *
 * Contract: `count == null` means "no trial data entered" (skip the hour). `count >= 1` means trials
 * were entered for that program — even when `effectiveTrials` is empty, we keep the entry as a
 * **0-success / count-trial** record so the wizard's "0%" selection genuinely flows through to the
 * end-of-note performance line and the per-paragraph percentage prose (the AI will write
 * "successful approximately 0% of the time"). Previously an empty `effectiveTrials` was treated the
 * same as missing data and the hour was dropped entirely.
 */
function buildTherapistTrialSummaryForReplacementHour(params: {
  sessionHours: number;
  programIdForHour: (number | null)[];
  rbtActionsOnlyOutcomeForHour: boolean[];
  programTrialData:
    | Record<string, { count: number | null; effectiveTrials: number[] }>
    | undefined;
}): NoteGenerationContext["therapistTrialSummaryForReplacementHour"] {
  const { sessionHours, programIdForHour, rbtActionsOnlyOutcomeForHour, programTrialData } = params;
  return Array.from({ length: sessionHours }, (_, h) => {
    if (rbtActionsOnlyOutcomeForHour[h]) return null;
    const id = programIdForHour[h];
    if (id == null) return null;
    const entry = programTrialData?.[String(id)];
    if (!entry) return null;
    const count = entry.count;
    if (typeof count !== "number" || !Number.isFinite(count) || !Number.isInteger(count) || count < 1) {
      return null;
    }
    const trials = entry.effectiveTrials ?? [];
    const inRange = trials.filter(
      (t): t is number => typeof t === "number" && Number.isInteger(t) && t >= 1 && t <= count,
    );
    const uniqueSorted = [...new Set(inRange)].sort((a, b) => a - b);
    // Empty `successfulTrialNumbers` is intentional for 0% selections — keep the entry instead of
    // returning null, so the percentage rollup downstream sees 0/count for this hour.
    return { totalTrials: count, successfulTrialNumbers: uniqueSorted };
  });
}

/** Map OpenAI / transport failures to actionable text (distinct from "missing OPENAI_API_KEY" 503). */
function formatOpenAINoteGenerationError(err: unknown): string {
  const status = err instanceof APIError ? err.status : undefined;
  if (status === 401) {
    return (
      "OpenAI returned 401 (unauthorized): the key is invalid, revoked, or for a different organization/project. " +
      "Create or verify a key at https://platform.openai.com/api-keys , set OPENAI_API_KEY in artifacts/api-server/.env on the server, then restart PM2. " +
      "Your .env line can look unchanged locally while the key no longer works at OpenAI."
    );
  }
  if (status === 429) {
    return (
      "OpenAI returned 429 (rate limit or insufficient quota). Check usage and billing at https://platform.openai.com — nothing on your server changed, but OpenAI may have tightened limits or a payment failed."
    );
  }
  if (status === 503 || status === 502) {
    return "OpenAI returned a temporary service error. Retry in a few minutes.";
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (/401|incorrect api key|invalid api key|invalid_api_key|authentication/i.test(msg)) {
    return (
      "OpenAI rejected the API key. The value in .env may be expired or revoked at OpenAI even if the file was not edited. " +
      "Generate a new key at https://platform.openai.com/api-keys , update the server .env, and restart PM2."
    );
  }
  return msg;
}

const router: IRouter = Router();

function assembleSessionNote(
  presentPeople: string[],
  hasEnvChanges: boolean,
  therapySetting: TherapySetting,
  clinicalBody: string,
  nextSessionDate: string | undefined,
  clientFirstName: string | null | undefined,
  narrativeProgramSegmentCount: number,
  therapistTrialSummaryForReplacementHour: TherapistTrialSummaryForHourEntry[] | undefined,
): string {
  const opening = buildLockedOpening(presentPeople, hasEnvChanges, therapySetting, clientFirstName);
  const performance = buildPerformanceSentence(
    narrativeProgramSegmentCount,
    therapistTrialSummaryForReplacementHour,
    clientFirstName,
  );
  const nextSession = buildNextSessionSentence(nextSessionDate, clientFirstName);

  return [opening, "", clinicalBody, "", LOCKED_CLOSING_PARAGRAPH, "", performance, "", nextSession].join("\n");
}

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

  const profile = (client.profile as ClientProfileRow | null | undefined) ?? null;
  const rawAssessmentSnapshot = profile?.assessmentTextSnapshot?.trim() ?? "";

  if (body.selectedReplacements.length === 0) {
    res.status(422).json({
      success: false,
      error: "Programs required",
      messages: ["Select at least one replacement program for this session before generating a note."],
    });
    return;
  }

  let programNames: string[] = [];
  const programRows = await db
    .select()
    .from(programsTable)
    .where(and(eq(programsTable.companyId, companyId), inArray(programsTable.id, body.selectedReplacements)));
  const nameById = new Map(programRows.map((p) => [p.id, p.name]));
  programNames = body.selectedReplacements.map((id) => nameById.get(id) ?? `Program ${id}`);

  const linkedProgramRows = await db
    .select({ id: programsTable.id, name: programsTable.name })
    .from(clientProgramsTable)
    .innerJoin(programsTable, eq(clientProgramsTable.programId, programsTable.id))
    .where(and(eq(clientProgramsTable.clientId, body.clientId), eq(programsTable.companyId, companyId)));

  const selectedIdSet = new Set(body.selectedReplacements);
  const assessmentReplacementNameSet = new Set(
    (profile?.replacementPrograms ?? [])
      .map((n) => String(n).trim())
      .filter((n) => n.length > 0),
  );

  /** Linked DB rows authorized for this note: assessment profile list + anything explicitly selected for the session. */
  let allowedProgramRows =
    assessmentReplacementNameSet.size > 0
      ? linkedProgramRows.filter(
          (r) => selectedIdSet.has(r.id) || assessmentReplacementNameSet.has(r.name.trim()),
        )
      : linkedProgramRows;

  const structuredForNote = getAssessmentStructuredFromProfile(profile);
  if (structuredForNote) {
    const structIssues = validateAssessmentStructured(structuredForNote);
    if (structIssues.length > 0) {
      res.status(422).json({
        success: false,
        error: "Invalid structured assessment on client profile",
        messages: structIssues,
      });
      return;
    }
    for (const id of body.selectedReplacements) {
      const n = nameById.get(id)?.trim();
      if (n && !structuredForNote.replacement_programs.includes(n)) {
        res.status(422).json({
          success: false,
          error: "Program not on structured assessment",
          messages: [
            `Selected program "${n}" is not listed on the client's assessmentStructured.replacement_programs.`,
          ],
        });
        return;
      }
    }
    allowedProgramRows = allowedProgramRows.filter((r) =>
      structuredForNote.replacement_programs.includes(r.name.trim()),
    );
  }

  const allowedIdToName = new Map(allowedProgramRows.map((r) => [r.id, r.name]));
  for (const id of body.selectedReplacements) {
    const n = nameById.get(id);
    if (n) {
      allowedIdToName.set(id, n);
    }
  }

  const hints = body.abcHints ?? [];
  const abcHintProgramMessages: string[] = [];
  for (let h = 0; h < hints.length; h++) {
    const pid = hints[h]?.replacementProgramId;
    if (pid == null) continue;
    if (typeof pid !== "number" || !allowedIdToName.has(pid)) {
      abcHintProgramMessages.push(
        assessmentReplacementNameSet.size > 0
          ? `abcHints[${h}]: replacementProgramId must be a program selected for this session or one whose exact name is on the client's replacement-program list from the assessment/profile.`
          : `abcHints[${h}]: replacementProgramId must be the id of a replacement program linked to this client (GET /api/clients/:clientId/programs).`,
      );
    }
  }
  if (abcHintProgramMessages.length > 0) {
    res.status(400).json({
      success: false,
      error: "Invalid ABC Builder input",
      messages: abcHintProgramMessages,
    });
    return;
  }

  const replacementProgramsCatalog = (() => {
    const names = [
      ...allowedProgramRows.map((r) => r.name.trim()),
      ...programNames.map((s) => s.trim()),
    ].filter((s) => s.length > 0);
    if (names.length > 0) {
      return [...new Set(names)].sort((a, b) => b.length - a.length || a.localeCompare(b));
    }
    return [];
  })();

  let replacementProgramsCatalogForNote = replacementProgramsCatalog;
  if (structuredForNote) {
    replacementProgramsCatalogForNote = intersectCatalog(
      replacementProgramsCatalogForNote,
      structuredForNote.replacement_programs,
    );
    if (replacementProgramsCatalogForNote.length === 0) {
      res.status(422).json({
        success: false,
        error: "No replacement programs remain after applying structured assessment",
        messages: [
          "Program names for this session did not intersect with assessmentStructured.replacement_programs.",
        ],
      });
      return;
    }
  }

  const clientAgeYears = approximateAgeYearsAtSession(profile?.dateOfBirth ?? null, body.sessionDate);

  const { text: clientAssessmentTextExcerpt, truncated: assessmentExcerptForNoteTruncated } =
    truncateAssessmentTextForNoteContext(profile?.assessmentTextSnapshot ?? "");

  const profileBehaviorList = profile?.maladaptiveBehaviors ?? [];
  const rotationResult = maladaptiveBehaviorsCatalogForRotation(
    profileBehaviorList,
    rawAssessmentSnapshot,
  );
  let behaviorCatalog = rotationResult.catalog.map(canonicalMaladaptiveBehaviorLabel);
  if (structuredForNote) {
    behaviorCatalog = intersectCatalog(
      behaviorCatalog,
      structuredForNote.behaviors.map(canonicalMaladaptiveBehaviorLabel),
    );
    if (behaviorCatalog.length === 0) {
      res.status(422).json({
        success: false,
        error: "No maladaptive behaviors remain after applying structured assessment",
        messages: [
          "The session rotation catalog did not intersect with assessmentStructured.behaviors; align profile/assessment text labels with the structured assessment list.",
        ],
      });
      return;
    }
  }
  const maladaptiveBehaviorTargetsForNote = maladaptiveBehaviorTargetsForNoteCatalog(
    behaviorCatalog,
    profile ?? undefined,
  );
  const behaviorRotationSeed = randomUUID();
  const baseMaladaptiveForHour = maladaptiveBehaviorsForSessionHours(
    behaviorCatalog,
    body.sessionHours,
    behaviorRotationSeed,
  );

  const abcResolved = resolveAbcHintsForNoteGeneration(
    body.abcHints,
    body.sessionHours,
    behaviorCatalog,
    baseMaladaptiveForHour,
  );
  if (!abcResolved.ok) {
    res.status(400).json({
      success: false,
      error: "Invalid ABC Builder input",
      messages: abcResolved.messages,
    });
    return;
  }

  const maladaptiveBehaviorForHour = abcResolved.maladaptiveBehaviorForHour.map(
    canonicalMaladaptiveBehaviorLabel,
  );
  const activityAntecedentForHour = abcResolved.activityAntecedentForHour;

  const linkedIdsUnique = [...new Set(allowedProgramRows.map((r) => r.id))].sort((a, b) => a - b);
  const idToNameForPrograms = allowedIdToName.size > 0 ? allowedIdToName : nameById;
  const poolIds = replacementProgramPoolForAutoAssignment(
    body.selectedReplacements,
    linkedIdsUnique.length > 0 ? linkedIdsUnique : body.selectedReplacements,
    body.sessionHours,
  );
  const explicitProgramIdByHour = Array.from({ length: body.sessionHours }, (_, h) => hints[h]?.replacementProgramId);
  const {
    names: replacementProgramForHour,
    rbtActionsOnly: rbtActionsOnlyOutcomeForHour,
    programIdForHour,
  } = replacementProgramAssignmentsForSessionHours({
    sessionHours: body.sessionHours,
    poolIds,
    idToName: idToNameForPrograms,
    selectedIdSet: selectedIdSet,
    explicitProgramIdByHour,
    sessionSelectionCoversHours:
      body.selectedReplacements.length >= replacementProgramSlotCount(body.sessionHours),
  });

  rebalanceTaskRefusalReplacementProgramsHourly({
    sessionHours: body.sessionHours,
    maladaptiveBehaviorForHour,
    names: replacementProgramForHour,
    rbtActionsOnlyOutcomeForHour,
    programIdForHour,
    explicitProgramIdByHour,
    poolIds,
    idToName: idToNameForPrograms,
    selectedIdSet,
  });

  const behaviorToReplacementsMap = structuredForNote?.behavior_to_replacements_map ?? {};
  const behaviorRebalanceSwaps = rebalanceBehaviorMappedReplacementProgramsHourly({
    sessionHours: body.sessionHours,
    maladaptiveBehaviorForHour,
    names: replacementProgramForHour,
    rbtActionsOnlyOutcomeForHour,
    programIdForHour,
    explicitProgramIdByHour,
    poolIds,
    idToName: idToNameForPrograms,
    selectedIdSet,
    behaviorToReplacementsMap,
    authorizedProgramNames: replacementProgramsCatalogForNote,
  });

  const therapistTrialSummaryHourly = buildTherapistTrialSummaryForReplacementHour({
    sessionHours: body.sessionHours,
    programIdForHour,
    rbtActionsOnlyOutcomeForHour,
    programTrialData: body.programTrialData,
  });
  const languageMaladaptiveEpisodeHourly = maladaptiveBehaviorForHour.map((b) =>
    isLanguageMaladaptiveBehaviorLabel(b),
  );

  let interventionsForNote = profile?.interventions ?? [];
  if (structuredForNote) {
    interventionsForNote = intersectCatalog(interventionsForNote, structuredForNote.interventions);
    if (interventionsForNote.length === 0) {
      res.status(422).json({
        success: false,
        error: "No interventions remain after applying structured assessment",
        messages: [
          "Profile interventions did not intersect with assessmentStructured.interventions; update the client profile or structured assessment.",
        ],
      });
      return;
    }
  }

  const narrativeCollapsed = collapseHourlyNoteNarrativeToSegments({
    sessionHours: body.sessionHours,
    maladaptiveBehaviorForHour,
    replacementProgramForHour,
    rbtActionsOnlyOutcomeForHour,
    activityAntecedentForHour,
    languageMaladaptiveEpisodeForHour: languageMaladaptiveEpisodeHourly,
    therapistTrialSummaryForReplacementHour: therapistTrialSummaryHourly,
  });

  const acquisitionOnlySegmentForHour = narrativeCollapsed.replacementProgramForHour.map((name) =>
    isSkillAcquisitionOnlyReplacementProgram(name),
  );
  const maladaptiveBehaviorForNarrative = narrativeCollapsed.maladaptiveBehaviorForHour.map((b, i) =>
    acquisitionOnlySegmentForHour[i] ? "" : b,
  );
  const languageMaladaptiveForNarrative = narrativeCollapsed.languageMaladaptiveEpisodeForHour.map((v, i) =>
    acquisitionOnlySegmentForHour[i] ? false : v,
  );

  const complianceCtxBase: NoteComplianceContext = {
    sessionHours: body.sessionHours,
    therapySetting: body.therapySetting,
    narrativeSegmentCount: narrativeCollapsed.narrativeSegmentCount,
    replacementProgramsInOrder: replacementProgramsCatalogForNote,
    replacementProgramForHour: narrativeCollapsed.replacementProgramForHour,
    rbtActionsOnlyOutcomeForHour: narrativeCollapsed.rbtActionsOnlyOutcomeForHour,
    maladaptiveBehaviors: behaviorCatalog,
    maladaptiveBehaviorForHour: maladaptiveBehaviorForNarrative,
    activityAntecedentForHour: narrativeCollapsed.activityAntecedentForHour,
    languageMaladaptiveEpisodeForHour: languageMaladaptiveForNarrative,
    acquisitionOnlySegmentForHour,
    interventions: interventionsForNote,
    therapistTrialSummaryForReplacementHour: narrativeCollapsed.therapistTrialSummaryForReplacementHour,
    clientAgeYears,
    presentPeople: body.presentPeople,
  };

  const warnings: string[] = [];
  if (structuredForNote) {
    warnings.push(
      "Structured assessment mode: maladaptive behaviors, interventions, and replacement programs for this note were intersected with profile.assessmentStructured allow-lists.",
    );
  }
  if (acquisitionOnlySegmentForHour.some(Boolean)) {
    warnings.push(
      "One or more narrative segments use skill-acquisition-only programs (Respond to Own Name, or a program name containing Echoic): the clinical body must not cite a maladaptive catalog label in those paragraphs.",
    );
  }
  if (assessmentReplacementNameSet.size > 0) {
    const omitted = linkedProgramRows.filter(
      (r) => !selectedIdSet.has(r.id) && !assessmentReplacementNameSet.has(r.name.trim()),
    );
    if (omitted.length > 0) {
      warnings.push(
        `These linked programs are not on the client's assessment/profile replacement-program list and were omitted from hour assignment: ${omitted.map((r) => r.name).join(", ")}.`,
      );
    }
  }
  if (rotationResult.labelsAddedFromAssessmentText.length > 0) {
    warnings.push(
      `Maladaptive behaviors found verbatim in the stored assessment but not on the client profile were included in this note's rotation: ${rotationResult.labelsAddedFromAssessmentText.join(", ")}. Consider adding them to the client profile for consistency.`,
    );
  }
  if (rotationResult.labelsOmittedNotFoundInAssessment.length > 0) {
    warnings.push(
      `These maladaptive behaviors are in the rotation but were not found as exact substrings in the stored assessment text (check OCR/BIP wording if needed): ${rotationResult.labelsOmittedNotFoundInAssessment.join(", ")}.`,
    );
  }
  if (rawAssessmentSnapshot.length === 0) {
    warnings.push(
      "No assessment text excerpt is stored on this client. Upload the assessment PDF (POST /api/clients/:clientId/assessment/document) so the AI can ground narratives in the BIP/FBA. Until then, generation uses profile behavior and program lists only.",
    );
  } else if (assessmentExcerptForNoteTruncated) {
    warnings.push(
      "Assessment excerpt sent to the AI was truncated for prompt size; later pages of very long assessments may not influence this note.",
    );
  }

  const filledAbcHours = activityAntecedentForHour.map((a) => (typeof a === "string" && a.length > 0 ? 1 : 0));
  if (filledAbcHours.some((x) => x === 1)) {
    warnings.push(
      "ABC Builder: one or more hours use RBT-selected activity/antecedent and maladaptive behavior; the AI must keep those exact strings.",
    );
  }
  if (isSundaySessionDate(body.sessionDate)) {
    warnings.push(
      "Sunday sessions require documented parental consent. Verify that a signed consent form authorizing Sunday sessions is on file for this client — otherwise the agency is in breach of the authorization requirements.",
    );
  }
  warnings.push(...behaviorRebalanceSwaps);

  const behaviorReplacementCandidatesForHour = buildBehaviorReplacementCandidatesForNarrativeSegments({
    narrativeSegmentCount: narrativeCollapsed.narrativeSegmentCount,
    maladaptiveBehaviorForHour: maladaptiveBehaviorForNarrative,
    acquisitionOnlySegmentForHour,
    behaviorToReplacementsMap,
    authorizedProgramNames: replacementProgramsCatalogForNote,
  });

  const oaCtx: NoteGenerationContext = {
    /** Deliberately not the profile name — session notes must not contain personal names. */
    clientName: "the client",
    firstName: "the client",
    gender: profile?.gender,
    sessionHours: body.sessionHours,
    narrativeSegmentCount: narrativeCollapsed.narrativeSegmentCount,
    sessionDate: body.sessionDate,
    therapySetting: body.therapySetting,
    presentPeople: body.presentPeople,
    hasEnvironmentalChanges: body.hasEnvironmentalChanges,
    environmentalChanges: body.environmentalChanges ?? "",
    maladaptiveBehaviors: behaviorCatalog,
    maladaptiveBehaviorTargets: maladaptiveBehaviorTargetsForNote,
    maladaptiveBehaviorForHour: maladaptiveBehaviorForNarrative,
    acquisitionOnlySegmentForHour,
    interventions: interventionsForNote,
    replacementProgramsInOrder: replacementProgramsCatalogForNote,
    replacementProgramForHour: narrativeCollapsed.replacementProgramForHour,
    rbtActionsOnlyOutcomeForHour: narrativeCollapsed.rbtActionsOnlyOutcomeForHour,
    requestNonce: behaviorRotationSeed,
    clientAgeYears,
    ageBand: client.ageBand,
    clientAssessmentTextExcerpt,
    assessmentReferenceFileName: profile?.assessmentFileName ?? null,
    activityAntecedentForHour: narrativeCollapsed.activityAntecedentForHour,
    languageMaladaptiveEpisodeForHour: narrativeCollapsed.languageMaladaptiveEpisodeForHour,
    therapistTrialSummaryForReplacementHour: narrativeCollapsed.therapistTrialSummaryForReplacementHour,
    behaviorReplacementCandidatesForHour,
  };

  let clinicalBody: string;
  const generationSource: "openai" = "openai";
  let generationModel: string;

  try {
    const oaResult = await generateClinicalBodyOpenAI(oaCtx);
    clinicalBody = oaResult.body;
    warnings.push(`Clinical narrative generated via ${openaiNoteGenerationLabel()}.`);
    warnings.push(...oaResult.warnings);
    generationModel = resolvedOpenAIModel();
  } catch (err) {
    console.error("[notes/generate] OpenAI failed:", err);
    res.status(502).json({
      success: false,
      error: "AI note generation failed.",
      messages: [formatOpenAINoteGenerationError(err)],
    });
    return;
  }

  for (const issue of validateClinicalBodyCompliance(clinicalBody, complianceCtxBase)) {
    warnings.push(`Clinical body compliance check: ${issue}`);
  }

  const noteContent = assembleSessionNote(
    body.presentPeople,
    body.hasEnvironmentalChanges,
    body.therapySetting,
    clinicalBody,
    body.nextSessionDate,
    profile?.firstName,
    narrativeCollapsed.narrativeSegmentCount,
    narrativeCollapsed.therapistTrialSummaryForReplacementHour,
  );

  for (const issue of validateCaregiverMentionRule(noteContent, body.presentPeople)) {
    warnings.push(`Full-note check: ${issue}`);
  }

  const programSlotNeed = replacementProgramSlotCount(body.sessionHours);
  if (body.selectedReplacements.length < programSlotNeed) {
    warnings.push(
      `Fewer programs selected than replacement-program slots for this session (${programSlotNeed} slot(s) for ${body.sessionHours} hour(s); 2-hour sessions use one program per hour, longer sessions use about one program per 90 minutes). Slots without a matching selection in ABC Builder are auto-filled from the client's assessment/profile replacement-program list (selected session targets first, then other assessment-listed programs). Use ABC Builder to override any hour.`,
    );
  }
  if (narrativeCollapsed.rbtActionsOnlyOutcomeForHour.some(Boolean)) {
    warnings.push(
      "One or more narrative segments document a replacement program that was not selected for this session; the narrative for those segments must describe RBT implementation only (no valenced client outcome for that program).",
    );
  }

  const generatedAt = new Date();

  const [inserted] = await db
    .insert(notesTable)
    .values({
      companyId,
      clientId: client.id,
      content: noteContent,
      status: "draft",
      sessionDate: body.sessionDate,
      sessionHours: body.sessionHours,
      generatedAt,
    })
    .returning();

  console.log(
    `[notes/generate] openai_ok noteId=${inserted.id} model=${generationModel} clientId=${client.id} companyId=${companyId}`,
  );
  res.setHeader("X-ABA-Clinical-Body-Source", "openai");
  res.setHeader("X-ABA-OpenAI-Model", generationModel);

  const maladaptiveReplacementPairings = maladaptiveReplacementPairingsForSessionNote({
    acquisitionOnlySegmentForHour,
    maladaptiveBehaviorForNarrative,
    replacementProgramForHour: narrativeCollapsed.replacementProgramForHour,
  });

  const data = GenerateNoteResponse.parse({
    success: true,
    data: {
      noteId: inserted.id,
      content: noteContent,
      clientId: client.id,
      clientName: client.name,
      sessionDate: body.sessionDate,
      sessionHours: body.sessionHours,
      generatedAt: generatedAt.toISOString(),
      generationSource,
      generationModel,
      maladaptiveReplacementPairings,
      draftQuota: { used: slot.used, max: slot.max },
    },
    warnings: warnings.length > 0 ? warnings : undefined,
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
