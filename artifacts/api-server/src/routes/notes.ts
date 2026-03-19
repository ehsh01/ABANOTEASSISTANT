import { Router, type IRouter } from "express";
import {
  GenerateNoteBody,
  GenerateNoteResponse,
  SaveNoteParams,
  SaveNoteBody,
  SaveNoteResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const MOCK_NOTE_TEMPLATE = (clientName: string, sessionDate: string, sessionHours: number, presentPeople: string[], hasEnvChanges: boolean, envChanges: string, programs: string[]) => `
Session Note — ${clientName}
Session Date: ${sessionDate}
Duration: ${sessionHours} hour${sessionHours > 1 ? "s" : ""}
Present: ${presentPeople.join(", ")}

**Session Summary**

${clientName} participated in a ${sessionHours}-hour ABA therapy session on ${sessionDate}. The session was conducted in the home setting with ${presentPeople.join(" and ")} present. The Registered Behavior Technician (RBT) implemented programming as directed by the Board Certified Behavior Analyst (BCBA) supervisor.

${hasEnvChanges ? `**Environmental Changes**\n${envChanges}\n` : ""}

**Skill Acquisition Programs**

${programs.map((prog, i) => `${i + 1}. **${prog}**: ${clientName} demonstrated consistent responding across multiple trials during today's session. The client met criterion for ${Math.floor(Math.random() * 3) + 2} of ${Math.floor(Math.random() * 3) + 4} targets. Prompting hierarchy was implemented as outlined in the treatment plan, with gradual fading of prompt levels to promote independence. Data were recorded using a trial-by-trial format.`).join("\n\n")}

**Behavior Reduction**

${clientName} exhibited minimal challenging behavior during today's session. The behavior intervention plan was followed with fidelity. When problem behavior occurred, the RBT implemented the prescribed extinction protocol and redirected the client to the task at hand. The client responded appropriately to the intervention strategies and was able to re-engage with programming within a reasonable timeframe.

**Caregiver Involvement**

${presentPeople.join(" and ")} participated actively in today's session. The RBT provided coaching on implementation of behavior programs and reviewed current data trends. The caregiver demonstrated understanding of reinforcement delivery and prompting strategies as outlined in the parent training goals.

**Summary and Recommendations**

Overall, ${clientName} had a productive session. Programming targets are progressing as expected. The BCBA will review current data trends at the next supervision meeting to determine if modifications to the treatment plan are warranted. It is recommended to continue current programming with close monitoring of acquisition data.
`.trim();

router.post("/notes/generate", async (req, res) => {
  const body = GenerateNoteBody.parse(req.body);

  await new Promise((resolve) => setTimeout(resolve, 2000));

  const clientNames: Record<string, string> = {
    c1: "James R.",
    c2: "Sophia M.",
    c3: "Ethan T.",
    c4: "Olivia K.",
    c5: "Liam B.",
  };

  const clientName = clientNames[body.clientId] ?? "Client";

  const noteContent = MOCK_NOTE_TEMPLATE(
    clientName,
    body.sessionDate,
    body.sessionHours,
    body.presentPeople,
    body.hasEnvironmentalChanges,
    body.environmentalChanges ?? "",
    body.selectedReplacements,
  );

  const warnings: string[] = [];
  if (body.selectedReplacements.length < body.sessionHours) {
    warnings.push(
      `Fewer programs selected than session hours. ${body.sessionHours - body.selectedReplacements.length} supplemental program(s) will be noted without client outcome data.`,
    );
  }

  const data = GenerateNoteResponse.parse({
    success: true,
    data: {
      noteId: `note-${Date.now()}`,
      content: noteContent,
      clientId: body.clientId,
      clientName,
      sessionDate: body.sessionDate,
      sessionHours: body.sessionHours,
      generatedAt: new Date().toISOString(),
    },
    warnings: warnings.length > 0 ? warnings : undefined,
    error: null,
  });

  res.json(data);
});

router.post("/notes/:noteId/save", (req, res) => {
  const params = SaveNoteParams.parse(req.params);
  const body = SaveNoteBody.parse(req.body);

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
