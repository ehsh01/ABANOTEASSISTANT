import { Router, type IRouter } from "express";
import { and, eq, inArray } from "drizzle-orm";
import {
  GenerateNoteBody,
  GenerateNoteResponse,
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
  buildLockedOpening,
  buildNextSessionSentence,
  buildPerformanceSentence,
  LOCKED_CLOSING_PARAGRAPH,
} from "../note-assembly";

const router: IRouter = Router();

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

  await new Promise((resolve) => setTimeout(resolve, 2000));

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
  const { text: clinicalBody, warnings: abcWarnings } = buildAbcClinicalBody({
    clientName: client.name,
    sessionHours: body.sessionHours,
    programNames,
    maladaptiveBehaviors: profile?.maladaptiveBehaviors ?? [],
    interventions: profile?.interventions ?? [],
    hasEnvironmentalChanges: body.hasEnvironmentalChanges,
    environmentalChanges: body.environmentalChanges ?? "",
  });

  const noteContent = assembleSessionNote(
    client.name,
    body.presentPeople,
    body.hasEnvironmentalChanges,
    clinicalBody,
    body.nextSessionDate,
  );

  const warnings: string[] = [...abcWarnings];
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
