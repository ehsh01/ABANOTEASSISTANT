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
  companiesTable,
  notesTable,
  programsTable,
} = await import("@workspace/db/schema");
const { and, eq } = await import("drizzle-orm");
const { GenerateNoteBody } = await import("@workspace/api-zod");
const { generateSessionNoteForClient } = await import(
  "../../artifacts/api-server/src/notes-service"
);

const clients = await db
  .select({
    id: clientsTable.id,
    companyId: clientsTable.companyId,
    name: clientsTable.name,
    ageBand: clientsTable.ageBand,
    hasAssessment: clientsTable.hasAssessment,
    assessmentStatus: clientsTable.assessmentStatus,
    profile: clientsTable.profile,
    createdAt: clientsTable.createdAt,
    updatedAt: clientsTable.updatedAt,
  })
  .from(clientsTable)
  .where(eq(clientsTable.assessmentStatus, "ready"));

let chosenClient: (typeof clients)[number] | null = null;
let linkedPrograms: { id: number; name: string }[] = [];
let temporaryCompanyId: number | null = null;
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
  const [company] = await db
    .insert(companiesTable)
    .values({
      name: `Flexible note staging smoke ${Date.now()}`,
      freeUsage: true,
    })
    .returning({ id: companiesTable.id });
  temporaryCompanyId = company!.id;
  const programNames = [
    "Compliance Training",
    "Request for Break",
    "Accepting alternatives and making choices",
    "Schedule of activities",
    "Time on Task",
  ];
  linkedPrograms = await db
    .insert(programsTable)
    .values(
      programNames.map((name) => ({
        companyId: temporaryCompanyId!,
        name,
        type: "primary",
      })),
    )
    .returning({ id: programsTable.id, name: programsTable.name });
  const [client] = await db
    .insert(clientsTable)
    .values({
      companyId: temporaryCompanyId,
      name: "Staging Smoke Client",
      hasAssessment: true,
      assessmentStatus: "ready",
      profile: {
        firstName: "Smoke",
        lastName: "Client",
        dateOfBirth: "2018-01-01",
        gender: "male",
        maladaptiveBehaviors: ["Task refusal", "Physical Aggression"],
        replacementPrograms: programNames,
        skillAcquisitionPrograms: [],
        interventions: [
          "Premack Principle",
          "Response blocking",
          "Differential Reinforcement of Alternative Behavior (DRA)",
        ],
        assessmentFileName: "staging-smoke-assessment.pdf",
        assessmentTextSnapshot:
          "Task refusal includes pushing work materials away. Physical Aggression includes hitting with an open hand. Approved interventions include Premack Principle, Response blocking, and Differential Reinforcement of Alternative Behavior (DRA).",
      },
    })
    .returning({
      id: clientsTable.id,
      companyId: clientsTable.companyId,
      name: clientsTable.name,
      ageBand: clientsTable.ageBand,
      hasAssessment: clientsTable.hasAssessment,
      assessmentStatus: clientsTable.assessmentStatus,
      profile: clientsTable.profile,
      createdAt: clientsTable.createdAt,
      updatedAt: clientsTable.updatedAt,
    });
  chosenClient = client!;
  await db.insert(clientProgramsTable).values(
    linkedPrograms.map((program) => ({
      clientId: chosenClient!.id,
      programId: program.id,
    })),
  );
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

let generatedNoteId: number | null = null;
try {
  const result = await generateSessionNoteForClient({
    companyId: chosenClient.companyId,
    client: { ...chosenClient, avatarPngBase64: null, avatarUpdatedAt: null },
    body: request,
    generation: { requestTimeoutMs: 180_000, timeBudgetMs: 240_000 },
  });
  if (!result.ok) {
    throw new Error(`${result.error}: ${result.messages.join(" ")}`);
  }
  generatedNoteId = result.noteId;

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
    client: { ...chosenClient, avatarPngBase64: null, avatarUpdatedAt: null },
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
  if (generatedNoteId != null) {
    await db.delete(notesTable).where(eq(notesTable.id, generatedNoteId));
  }
  if (temporaryCompanyId != null) {
    await db.delete(companiesTable).where(eq(companiesTable.id, temporaryCompanyId));
  }
}

process.exit(0);
