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
import { clientsTable, companiesTable, programsTable, notesTable } from "@workspace/db/schema";
import {
  buildLockedOpening,
  buildNextSessionSentence,
  buildPerformanceSentence,
  LOCKED_CLOSING_PARAGRAPH,
} from "../note-assembly";

const router: IRouter = Router();

/** Mock clinical body between locked opening and locked closing — replace with ABC pipeline later. */
function mockClinicalBody(
  clientName: string,
  sessionDate: string,
  sessionHours: number,
  presentPeople: string[],
  hasEnvChanges: boolean,
  envChanges: string,
  programNames: string[],
): string {
  const presentLine = presentPeople.length > 0 ? presentPeople.join(", ") : "Caregiver (documented as present)";
  const envBlock =
    hasEnvChanges && envChanges.trim().length > 0
      ? `\n\n**Environmental changes (this session)**\n\n${envChanges.trim()}\n`
      : "";

  const programsBlock =
    programNames.length > 0
      ? programNames
          .map(
            (prog, i) =>
              `${i + 1}. **${prog}**: ${clientName} participated in trials targeting this program during the session. The RBT implemented procedures consistent with the behavior plan and collected data as appropriate.`,
          )
          .join("\n\n")
      : "No replacement programs were enumerated for this generated draft; update selections and regenerate as needed.";

  return `${envBlock}
**Session metadata**

Session date: ${sessionDate}  
Duration: ${sessionHours} hour${sessionHours > 1 ? "s" : ""}  
Individuals documented as present: ${presentLine}

**Session summary**

Following the opening above, ${clientName} participated in a ${sessionHours}-hour home-based session. The RBT implemented program targets as directed by the supervising BCBA.

**Skill acquisition / replacement programs**

${programsBlock}

**Behavior reduction**

${clientName}'s behavior was addressed in accordance with the behavior intervention plan. The RBT applied plan-specified strategies when clinically indicated and documented observations during the session.

**Caregiver involvement**

${presentLine} participated during the session. The RBT coordinated implementation and data collection with the caregiver as appropriate.
`.trim();
}

function assembleSessionNote(
  clientName: string,
  sessionDate: string,
  sessionHours: number,
  presentPeople: string[],
  hasEnvChanges: boolean,
  envChanges: string,
  programNames: string[],
  nextSessionDate: string | undefined,
): string {
  const opening = buildLockedOpening(clientName, presentPeople, hasEnvChanges);
  const body = mockClinicalBody(
    clientName,
    sessionDate,
    sessionHours,
    presentPeople,
    hasEnvChanges,
    envChanges,
    programNames,
  );
  const performance = buildPerformanceSentence(clientName);
  const nextSession = buildNextSessionSentence(clientName, nextSessionDate);

  return [
    opening,
    "",
    body,
    "",
    LOCKED_CLOSING_PARAGRAPH,
    "",
    performance,
    nextSession,
  ].join("\n");
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

  const noteContent = assembleSessionNote(
    client.name,
    body.sessionDate,
    body.sessionHours,
    body.presentPeople,
    body.hasEnvironmentalChanges,
    body.environmentalChanges ?? "",
    programNames,
    body.nextSessionDate,
  );

  const warnings: string[] = [];
  if (body.selectedReplacements.length < body.sessionHours) {
    warnings.push(
      `Fewer programs selected than session hours. ${body.sessionHours - body.selectedReplacements.length} supplemental program(s) will be noted without client outcome data.`,
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
