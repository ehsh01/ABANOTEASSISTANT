if (process.env.NOTE_SMOKE_STAGING !== "true") {
  throw new Error("Set NOTE_SMOKE_STAGING=true to run the isolated staging smoke test.");
}

await import("../../artifacts/api-server/src/load-local-env");
if (
  !process.env.DATABASE_URL_STAGING ||
  process.env.DATABASE_URL_STAGING === process.env.DATABASE_URL
) {
  throw new Error("A separate DATABASE_URL_STAGING is required.");
}
process.env.DATABASE_URL = process.env.DATABASE_URL_STAGING;
process.env.JWT_SECRET = process.env.JWT_SECRET_STAGING || process.env.JWT_SECRET;

const { db } = await import("@workspace/db");
const {
  clientsTable,
  clientProgramsTable,
  notesTable,
  programsTable,
} = await import("@workspace/db/schema");
const { and, eq } = await import("drizzle-orm");
const { GenerateNoteBody } = await import("@workspace/api-zod");
const { generateSessionNoteForClient } = await import(
  "../../artifacts/api-server/src/notes-service"
);

const clients = await db
  .select()
  .from(clientsTable)
  .where(eq(clientsTable.assessmentStatus, "ready"));

let chosenClient: (typeof clients)[number] | null = null;
let linkedPrograms: { id: number; name: string }[] = [];
for (const client of clients) {
  const rows = await db
    .select({ id: programsTable.id, name: programsTable.name })
    .from(clientProgramsTable)
    .innerJoin(programsTable, eq(clientProgramsTable.programId, programsTable.id))
    .where(
      and(
        eq(clientProgramsTable.clientId, client.id),
        eq(programsTable.companyId, client.companyId),
      ),
    );
  if (rows.length >= 5) {
    chosenClient = client;
    linkedPrograms = rows.slice(0, 5);
    break;
  }
}

if (!chosenClient) {
  throw new Error("No staging client has a ready assessment and five linked programs.");
}

const percentages = [0, 10, 20, 30, 100];
const selectedReplacements = linkedPrograms.map((program) => program.id);
const abcHints = [
  ...linkedPrograms.map((program) => ({
    activityAntecedent: null,
    maladaptiveBehavior: null,
    replacementProgramId: program.id,
  })),
  {
    activityAntecedent: null,
    maladaptiveBehavior: null,
    replacementProgramId: linkedPrograms[0]!.id,
  },
];
const programTrialData = Object.fromEntries(
  linkedPrograms.map((program, index) => [
    String(program.id),
    {
      count: 10,
      effectiveTrials: Array.from(
        { length: percentages[index]! / 10 },
        (_, trialIndex) => trialIndex + 1,
      ),
    },
  ]),
);

const request = GenerateNoteBody.parse({
  clientId: chosenClient.id,
  sessionHours: 6,
  sessionDate: "2026-07-20",
  therapySetting: "Home",
  presentPeople: ["Caregiver"],
  hasEnvironmentalChanges: false,
  selectedReplacements,
  abcHints,
  programTrialData,
});

const result = await generateSessionNoteForClient({
  companyId: chosenClient.companyId,
  client: chosenClient,
  body: request,
  generation: { requestTimeoutMs: 180_000, timeBudgetMs: 240_000 },
});
if (!result.ok) {
  throw new Error(`${result.error}: ${result.messages.join(" ")}`);
}

try {
  for (let index = 0; index < linkedPrograms.length; index++) {
    const program = linkedPrograms[index]!;
    const percentage = percentages[index]!;
    if (!result.content.includes(program.name) || !result.content.includes(`${percentage}%`)) {
      throw new Error(`Missing exact lock for program ${program.id} at ${percentage}%.`);
    }
  }
  const repeatedProgramOccurrences = result.content.split(linkedPrograms[0]!.name).length - 1;
  if (repeatedProgramOccurrences < 2) {
    throw new Error("Repeated program was not documented in both assigned hours.");
  }

  const missingRequest = GenerateNoteBody.parse({
    ...request,
    abcHints: request.abcHints.slice(0, 5),
  });
  const missingResult = await generateSessionNoteForClient({
    companyId: chosenClient.companyId,
    client: chosenClient,
    body: missingRequest,
  });
  if (missingResult.ok || missingResult.status !== 400) {
    throw new Error("Missing-hour request was not rejected.");
  }

  console.log(
    JSON.stringify({
      liveGeneration: "passed",
      paragraphPercentages: percentages,
      repeatedProgram: true,
      missingHourRejected: true,
    }),
  );
} finally {
  await db.delete(notesTable).where(eq(notesTable.id, result.noteId));
}

process.exit(0);
