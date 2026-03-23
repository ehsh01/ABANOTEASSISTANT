import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  GenerateNoteBody,
  GenerateNoteResponse,
  ListNotesResponse,
  GetNoteParams,
  GetNoteResponse,
  DeleteNoteParams,
  DeleteNoteResponse,
  SaveNoteParams,
  SaveNoteBody,
  SaveNoteResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import {
  clientsTable,
  companiesTable,
  programsTable,
  notesTable,
  type ClientProfileRow,
} from "@workspace/db/schema";
import { buildAbcClinicalBody } from "../abc-note-body";
import {
  generateClinicalBodyOpenAI,
  isOpenAINoteGenerationConfigured,
  openaiNoteGenerationLabel,
  resolvedOpenAIModel,
  type NoteGenerationContext,
} from "../openai-notes";
import {
  approximateAgeYearsAtSession,
  validateCaregiverMentionRule,
  validateClinicalBodyCompliance,
  type NoteComplianceContext,
} from "../note-validation";
import {
  buildLockedOpening,
  buildNextSessionSentence,
  buildPerformanceSentence,
  LOCKED_CLOSING_PARAGRAPH,
} from "../note-assembly";

const router: IRouter = Router();

function clientFirstName(fullName: string): string {
  const p = fullName.trim().split(/\s+/).filter(Boolean);
  return p[0] ?? fullName;
}

function assembleSessionNote(
  clientName: string,
  presentPeople: string[],
  hasEnvChanges: boolean,
  clinicalBody: string,
  nextSessionDate: string | undefined,
): string {
  const opening = buildLockedOpening(clientName, presentPeople, hasEnvChanges);
  const performance = buildPerformanceSentence(clientName);
  const nextSession = buildNextSessionSentence(clientName, nextSessionDate);

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

  const body = GenerateNoteBody.parse(req.body);

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

  let programNames: string[] = [];
  if (body.selectedReplacements.length > 0) {
    const programRows = await db
      .select()
      .from(programsTable)
      .where(
        and(eq(programsTable.companyId, companyId), inArray(programsTable.id, body.selectedReplacements)),
      );
    const nameById = new Map(programRows.map((p) => [p.id, p.name]));
    programNames = body.selectedReplacements.map((id) => nameById.get(id) ?? `Program ${id}`);
  }

  const profile = (client.profile as ClientProfileRow | null | undefined) ?? null;
  const clientAgeYears = approximateAgeYearsAtSession(profile?.dateOfBirth ?? null, body.sessionDate);

  const complianceCtxBase: NoteComplianceContext = {
    sessionHours: body.sessionHours,
    replacementProgramsInOrder: programNames,
    clientAgeYears,
    presentPeople: body.presentPeople,
  };

  const abcInput = {
    clientName: client.name,
    gender: profile?.gender,
    sessionHours: body.sessionHours,
    programNames,
    maladaptiveBehaviors: profile?.maladaptiveBehaviors ?? [],
    interventions: profile?.interventions ?? [],
    hasEnvironmentalChanges: body.hasEnvironmentalChanges,
    environmentalChanges: body.environmentalChanges ?? "",
  };

  const warnings: string[] = [];
  let clinicalBody: string;
  let generationSource: "openai" | "template" = "template";
  let generationModel: string | null = null;

  if (isOpenAINoteGenerationConfigured()) {
    const oaCtx: NoteGenerationContext = {
      clientName: client.name,
      firstName: clientFirstName(client.name),
      gender: profile?.gender,
      sessionHours: body.sessionHours,
      sessionDate: body.sessionDate,
      presentPeople: body.presentPeople,
      hasEnvironmentalChanges: body.hasEnvironmentalChanges,
      environmentalChanges: body.environmentalChanges ?? "",
      maladaptiveBehaviors: profile?.maladaptiveBehaviors ?? [],
      interventions: profile?.interventions ?? [],
      replacementProgramsInOrder: programNames,
      requestNonce: randomUUID(),
      clientAgeYears,
      ageBand: client.ageBand,
    };
    try {
      const oaResult = await generateClinicalBodyOpenAI(oaCtx);
      clinicalBody = oaResult.body;
      warnings.push(`Clinical narrative generated via ${openaiNoteGenerationLabel()}.`);
      warnings.push(...oaResult.warnings);
      generationSource = "openai";
      generationModel = resolvedOpenAIModel();
    } catch (err) {
      console.error("[notes/generate] OpenAI failed, using template body:", err);
      const { text, warnings: abcWarnings } = buildAbcClinicalBody(abcInput);
      clinicalBody = text;
      generationSource = "template";
      generationModel = null;
      warnings.push(
        ...abcWarnings,
        `OpenAI generation failed (${err instanceof Error ? err.message : String(err)}); template narrative was used instead.`,
      );
      for (const issue of validateClinicalBodyCompliance(clinicalBody, complianceCtxBase)) {
        warnings.push(`Template compliance check: ${issue}`);
      }
    }
  } else {
    const { text, warnings: abcWarnings } = buildAbcClinicalBody(abcInput);
    clinicalBody = text;
    generationSource = "template";
    generationModel = null;
    warnings.push(
      ...abcWarnings,
      "OPENAI_API_KEY is not set on the API server; notes use the built-in template (fast, similar each time). Add OPENAI_API_KEY to artifacts/api-server/.env and restart the API.",
    );
    for (const issue of validateClinicalBodyCompliance(clinicalBody, complianceCtxBase)) {
      warnings.push(`Template compliance check: ${issue}`);
    }
  }

  const noteContent = assembleSessionNote(
    client.name,
    body.presentPeople,
    body.hasEnvironmentalChanges,
    clinicalBody,
    body.nextSessionDate,
  );

  for (const issue of validateCaregiverMentionRule(noteContent, body.presentPeople)) {
    warnings.push(`Full-note check: ${issue}`);
  }

  if (body.selectedReplacements.length < body.sessionHours) {
    warnings.push(
      `Fewer programs selected than session hours. Some hours reuse or rotate selected replacement programs in the narrative.`,
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
