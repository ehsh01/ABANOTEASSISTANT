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
import {
  approximateAgeYearsAtSession,
  maladaptiveBehaviorsCatalogForRotation,
  maladaptiveBehaviorsForSessionHours,
  replacementProgramAssignmentsForSessionHours,
  replacementProgramPoolOrdered,
  validateCaregiverMentionRule,
  validateClinicalBodyCompliance,
  type NoteComplianceContext,
} from "../note-validation";
import {
  buildLockedOpening,
  buildNextSessionSentence,
  buildPerformanceSentence,
  LOCKED_CLOSING_PARAGRAPH,
  type TherapySetting,
} from "../note-assembly";
import { truncateAssessmentTextForNoteContext } from "../assessment-extract";
import { resolveAbcHintsForNoteGeneration } from "../abc-hints";
import { isLanguageMaladaptiveBehaviorLabel } from "../language-maladaptive-behavior";
import { ABC_ACTIVITY_ANTECEDENT_CATALOG } from "../abc-activity-antecedent-catalog";

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
): string {
  const opening = buildLockedOpening(presentPeople, hasEnvChanges, therapySetting, clientFirstName);
  const performance = buildPerformanceSentence();
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
  if (companyId === undefined) {
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

  const linkedIdToName = new Map(linkedProgramRows.map((r) => [r.id, r.name]));
  const selectedIdSet = new Set(body.selectedReplacements);
  const abcHintProgramMessages: string[] = [];
  const hints = body.abcHints ?? [];
  for (let h = 0; h < hints.length; h++) {
    const pid = hints[h]?.replacementProgramId;
    if (pid == null) continue;
    if (typeof pid !== "number" || !linkedIdToName.has(pid)) {
      abcHintProgramMessages.push(
        `abcHints[${h}]: replacementProgramId must be the id of a replacement program linked to this client (GET /api/clients/:clientId/programs).`,
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
    const names = linkedProgramRows.map((r) => r.name.trim()).filter((s) => s.length > 0);
    if (names.length > 0) {
      return [...new Set(names)].sort((a, b) => b.length - a.length || a.localeCompare(b));
    }
    const fromSelected = programNames.map((s) => s.trim()).filter((s) => s.length > 0);
    return [...new Set(fromSelected)].sort((a, b) => b.length - a.length || a.localeCompare(b));
  })();

  const profile = (client.profile as ClientProfileRow | null | undefined) ?? null;
  const clientAgeYears = approximateAgeYearsAtSession(profile?.dateOfBirth ?? null, body.sessionDate);

  const rawAssessmentSnapshot = profile?.assessmentTextSnapshot?.trim() ?? "";
  const { text: clientAssessmentTextExcerpt, truncated: assessmentExcerptForNoteTruncated } =
    truncateAssessmentTextForNoteContext(profile?.assessmentTextSnapshot ?? "");

  const profileBehaviorList = profile?.maladaptiveBehaviors ?? [];
  const rotationResult = maladaptiveBehaviorsCatalogForRotation(
    profileBehaviorList,
    rawAssessmentSnapshot,
  );
  const behaviorCatalog = rotationResult.catalog;
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

  const { maladaptiveBehaviorForHour, activityAntecedentForHour } = abcResolved;

  const linkedIdsUnique = [...new Set(linkedProgramRows.map((r) => r.id))].sort((a, b) => a - b);
  const idToNameForPrograms = linkedIdToName.size > 0 ? linkedIdToName : nameById;
  const poolIds = replacementProgramPoolOrdered(
    body.selectedReplacements,
    linkedIdsUnique.length > 0 ? linkedIdsUnique : body.selectedReplacements,
  );
  const explicitProgramIdByHour = Array.from({ length: body.sessionHours }, (_, h) => hints[h]?.replacementProgramId);
  const { names: replacementProgramForHour, rbtActionsOnly: rbtActionsOnlyOutcomeForHour } =
    replacementProgramAssignmentsForSessionHours({
      sessionHours: body.sessionHours,
      poolIds,
      idToName: idToNameForPrograms,
      selectedIdSet: selectedIdSet,
      explicitProgramIdByHour,
    });
  const languageMaladaptiveEpisodeForHour = maladaptiveBehaviorForHour.map((b) =>
    isLanguageMaladaptiveBehaviorLabel(b),
  );

  const complianceCtxBase: NoteComplianceContext = {
    sessionHours: body.sessionHours,
    replacementProgramsInOrder: replacementProgramsCatalog,
    replacementProgramForHour,
    rbtActionsOnlyOutcomeForHour,
    maladaptiveBehaviors: behaviorCatalog,
    maladaptiveBehaviorForHour,
    activityAntecedentForHour,
    languageMaladaptiveEpisodeForHour,
    interventions: profile?.interventions ?? [],
    clientAgeYears,
    presentPeople: body.presentPeople,
  };

  const warnings: string[] = [];
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

  const oaCtx: NoteGenerationContext = {
    /** Deliberately not the profile name — session notes must not contain personal names. */
    clientName: "the client",
    firstName: "the client",
    gender: profile?.gender,
    sessionHours: body.sessionHours,
    sessionDate: body.sessionDate,
    therapySetting: body.therapySetting,
    presentPeople: body.presentPeople,
    hasEnvironmentalChanges: body.hasEnvironmentalChanges,
    environmentalChanges: body.environmentalChanges ?? "",
    maladaptiveBehaviors: behaviorCatalog,
    maladaptiveBehaviorForHour,
    interventions: profile?.interventions ?? [],
    replacementProgramsInOrder: replacementProgramsCatalog,
    replacementProgramForHour,
    rbtActionsOnlyOutcomeForHour,
    requestNonce: behaviorRotationSeed,
    clientAgeYears,
    ageBand: client.ageBand,
    clientAssessmentTextExcerpt,
    assessmentReferenceFileName: profile?.assessmentFileName ?? null,
    activityAntecedentForHour,
    languageMaladaptiveEpisodeForHour,
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
  );

  for (const issue of validateCaregiverMentionRule(noteContent, body.presentPeople)) {
    warnings.push(`Full-note check: ${issue}`);
  }

  if (body.selectedReplacements.length < body.sessionHours) {
    warnings.push(
      "Fewer programs selected than session hours: hours without “Program this hour” in ABC Builder are auto-filled from all client-linked programs (selected first, then others), not by repeating only the selected list. Use ABC Builder to override any hour.",
    );
  }
  if (rbtActionsOnlyOutcomeForHour.some(Boolean)) {
    warnings.push(
      "One or more hours document a replacement program that was not selected for this session; the narrative for those hours must describe RBT implementation only (no valenced client outcome for that program).",
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
    },
    warnings: warnings.length > 0 ? warnings : undefined,
    error: null,
  });

  res.json(data);
});

router.post("/notes/:noteId/save", async (req, res) => {
  const companyId = req.companyId;
  if (companyId === undefined) {
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

  const now = new Date();
  await db
    .update(notesTable)
    .set({
      status: body.status,
      content: body.content,
      updatedAt: now,
    })
    .where(and(eq(notesTable.id, params.noteId), eq(notesTable.companyId, companyId)));

  const data = SaveNoteResponse.parse({
    success: true,
    data: {
      noteId: params.noteId,
      status: body.status,
    },
    error: null,
  });

  res.json(data);
});

export default router;
