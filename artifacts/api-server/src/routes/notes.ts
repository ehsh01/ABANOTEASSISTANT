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

const router: IRouter = Router();

const MOCK_NOTE_TEMPLATE = (
  clientName: string,
  sessionDate: string,
  sessionHours: number,
  presentPeople: string[],
  hasEnvChanges: boolean,
  envChanges: string,
  programNames: string[],
) =>
  `
Session Note — ${clientName}
Session Date: ${sessionDate}
Duration: ${sessionHours} hour${sessionHours > 1 ? "s" : ""}
Present: ${presentPeople.join(", ")}

**Session Summary**

${clientName} participated in a ${sessionHours}-hour ABA therapy session on ${sessionDate}. The session was conducted in the home setting with ${presentPeople.join(" and ")} present. The Registered Behavior Technician (RBT) implemented programming as directed by the Board Certified Behavior Analyst (BCBA) supervisor.

${hasEnvChanges ? `**Environmental Changes**\n${envChanges}\n` : ""}

**Skill Acquisition Programs**

${programNames
  .map(
    (prog, i) =>
      `${i + 1}. **${prog}**: ${clientName} demonstrated consistent responding across multiple trials during today's session. The client met criterion for ${Math.floor(Math.random() * 3) + 2} of ${Math.floor(Math.random() * 3) + 4} targets. Prompting hierarchy was implemented as outlined in the treatment plan, with gradual fading of prompt levels to promote independence. Data were recorded using a trial-by-trial format.`,
  )
  .join("\n\n")}

**Behavior Reduction**

${clientName} exhibited minimal challenging behavior during today's session. The behavior intervention plan was followed with fidelity. When problem behavior occurred, the RBT implemented the prescribed extinction protocol and redirected the client to the task at hand. The client responded appropriately to the intervention strategies and was able to re-engage with programming within a reasonable timeframe.

**Caregiver Involvement**

${presentPeople.join(" and ")} participated actively in today's session. The RBT provided coaching on implementation of behavior programs and reviewed current data trends. The caregiver demonstrated understanding of reinforcement delivery and prompting strategies as outlined in the parent training goals.

**Summary and Recommendations**

Overall, ${clientName} had a productive session. Programming targets are progressing as expected. The BCBA will review current data trends at the next supervision meeting to determine if modifications to the treatment plan are warranted. It is recommended to continue current programming with close monitoring of acquisition data.
`.trim();

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

  const noteContent = MOCK_NOTE_TEMPLATE(
    client.name,
    body.sessionDate,
    body.sessionHours,
    body.presentPeople,
    body.hasEnvironmentalChanges,
    body.environmentalChanges ?? "",
    programNames,
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
