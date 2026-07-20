import { and, eq, inArray } from "drizzle-orm";
import { GenerateNoteBody } from "@workspace/api-zod";
import { db } from "@workspace/db";
import {
  clientsTable,
  clientProgramsTable,
  notesTable,
  programsTable,
  type ClientProfileRow,
} from "@workspace/db/schema";
import {
  CLINICAL_BODY_PROMPT_HASH,
  CLINICAL_BODY_PROMPT_VERSION,
  generateClinicalBodyOpenAI,
  openaiNoteGenerationLabel,
  resolvedOpenAIModel,
  type NoteGenerationAttemptTelemetry,
  type NoteGenerationContext,
} from "./openai-notes";
import {
  buildLockedClosingParagraph,
  buildLockedOpening,
  buildNextSessionSentence,
  buildPerformanceSentence,
} from "./note-assembly";
import {
  buildNoteGenerationAuditEntry,
  hashNoteGenerationContext,
  writeNoteGenerationAudit,
} from "./note-generation-audit";
import { assessmentGenerationGate } from "./note-readiness";
import { truncateAssessmentTextForNoteContext } from "./assessment-extract";
import {
  buildNoteAccuracyReport,
  type NoteAccuracyReport,
} from "./note-accuracy-report";
import { criterionPercentage, scrubAssessmentNames } from "./flexible-note-input";

type ClientRow = typeof clientsTable.$inferSelect;
type GenerateNoteInput = ReturnType<typeof GenerateNoteBody.parse>;

export type GenerateSessionNoteFailure = {
  ok: false;
  status: 400 | 422 | 502;
  error: string;
  messages: string[];
};

export type GenerateSessionNoteSuccess = {
  ok: true;
  noteId: number;
  content: string;
  generatedAt: Date;
  generationModel: string;
  warnings: string[];
  maladaptiveReplacementPairings: {
    segmentIndex: number;
    maladaptiveBehavior: string;
    replacementProgramName: string;
  }[];
  accuracyReport: NoteAccuracyReport;
};

export type GenerateSessionNoteResult =
  | GenerateSessionNoteFailure
  | GenerateSessionNoteSuccess;

function assembleSessionNote(params: {
  opening: string;
  clinicalBody: string;
  closing: string;
  performance: string;
  nextSession: string;
}): string {
  return [
    params.opening.trim(),
    params.clinicalBody.trim(),
    params.closing.trim(),
    params.performance.trim(),
    params.nextSession.trim(),
  ].join("\n\n");
}

function modelFailureMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown OpenAI error";
}

export async function generateSessionNoteForClient(params: {
  companyId: number;
  client: ClientRow;
  body: GenerateNoteInput;
  generation?: {
    requestTimeoutMs?: number;
    timeBudgetMs?: number;
    fallbackModel?: string | null;
  };
}): Promise<GenerateSessionNoteResult> {
  const { companyId, client, body, generation: tuning } = params;
  const profile = (client.profile as ClientProfileRow | null | undefined) ?? null;
  const assessmentGate = assessmentGenerationGate({
    hasAssessment: client.hasAssessment,
    assessmentStatus: client.assessmentStatus,
    profile,
  });
  if (!assessmentGate.ok) return assessmentGate;

  const hints = body.abcHints;
  const inputErrors: string[] = [];
  if (hints.length !== body.sessionHours) {
    inputErrors.push(`abcHints must contain exactly ${body.sessionHours} hourly rows.`);
  }
  if (body.selectedReplacements.length === 0) {
    inputErrors.push("Select at least one replacement program.");
  }

  const assignedIds: number[] = [];
  for (let hour = 0; hour < body.sessionHours; hour++) {
    const id = hints[hour]?.replacementProgramId;
    if (id == null || !body.selectedReplacements.includes(id)) {
      inputErrors.push(
        `Hour ${hour + 1} must assign a replacementProgramId from selectedReplacements.`,
      );
      continue;
    }
    assignedIds.push(id);
    const trialEntry = body.programTrialData[String(id)];
    if (!trialEntry || criterionPercentage(trialEntry) == null) {
      inputErrors.push(`Hour ${hour + 1} program ${id} requires a valid selected percentage.`);
    }
  }
  const assignedSet = new Set(assignedIds);
  for (const selectedId of body.selectedReplacements) {
    if (!assignedSet.has(selectedId)) {
      inputErrors.push(
        `Selected program ${selectedId} must be assigned to at least one service hour.`,
      );
    }
  }
  if (inputErrors.length > 0) {
    return {
      ok: false,
      status: 400,
      error: "Invalid hourly program assignments",
      messages: inputErrors,
    };
  }

  const linkedPrograms = await db
    .select({ id: programsTable.id, name: programsTable.name })
    .from(clientProgramsTable)
    .innerJoin(programsTable, eq(clientProgramsTable.programId, programsTable.id))
    .where(
      and(
        eq(clientProgramsTable.clientId, client.id),
        eq(programsTable.companyId, companyId),
        inArray(programsTable.id, [...new Set(assignedIds)]),
      ),
    );
  const programNameById = new Map(linkedPrograms.map((program) => [program.id, program.name]));
  const missingLinked = [...new Set(assignedIds)].filter((id) => !programNameById.has(id));
  if (missingLinked.length > 0) {
    return {
      ok: false,
      status: 400,
      error: "Invalid hourly program assignments",
      messages: missingLinked.map(
        (id) => `Program ${id} is not linked to this client and company.`,
      ),
    };
  }

  const rawAssessment = profile?.assessmentTextSnapshot?.trim() ?? "";
  const { text: truncatedAssessment, truncated } =
    truncateAssessmentTextForNoteContext(rawAssessment);
  const assessmentExcerpt = scrubAssessmentNames(truncatedAssessment, profile);
  const hourlyAssignments = hints.map((hint, segmentIndex) => {
    const programId = hint.replacementProgramId!;
    return {
      segmentIndex,
      programId,
      programName: programNameById.get(programId)!,
      criterionPercentage: criterionPercentage(body.programTrialData[String(programId)]!)!,
      activityHint: hint.activityAntecedent?.trim() || null,
      behaviorHint: hint.maladaptiveBehavior?.trim() || null,
    };
  });

  const context: NoteGenerationContext = {
    sessionHours: body.sessionHours,
    sessionDate: body.sessionDate,
    therapySetting: body.therapySetting,
    environmentalChanges: body.environmentalChanges?.trim() ?? "",
    profileBehaviors: profile?.maladaptiveBehaviors ?? [],
    profileInterventions: profile?.interventions ?? [],
    reinforcementPreferences:
      profile?.assessmentSummary?.reinforcementPreferences ?? [],
    assessmentExcerpt,
    assessmentReferenceFileName: profile?.assessmentFileName ?? null,
    hourlyAssignments,
  };

  const warnings: string[] = [];
  if (truncated) {
    warnings.push("The assessment excerpt supplied to the model was truncated for prompt size.");
  }
  const auditBase = {
    companyId,
    clientId: client.id,
    model: resolvedOpenAIModel(),
    promptVersion: CLINICAL_BODY_PROMPT_VERSION,
    promptHash: CLINICAL_BODY_PROMPT_HASH,
    contextHash: hashNoteGenerationContext(context),
    assessmentFilename: profile?.assessmentFileName ?? null,
    assessmentText: rawAssessment,
    assessmentExcerptLength: assessmentExcerpt.length,
    assessmentExcerptTruncated: truncated,
    sessionDate: body.sessionDate,
    sessionHours: body.sessionHours,
  };

  let modelGeneration;
  try {
    modelGeneration = await generateClinicalBodyOpenAI(context, {
      requestTimeoutMs: tuning?.requestTimeoutMs,
      timeBudgetMs: tuning?.timeBudgetMs,
      fallbackModel: tuning?.fallbackModel,
    });
  } catch (error) {
    const attemptHistory =
      error && typeof error === "object" && "noteGenerationAttemptHistory" in error
        ? ((error as { noteGenerationAttemptHistory?: NoteGenerationAttemptTelemetry[] })
            .noteGenerationAttemptHistory ?? [])
        : [];
    const rawModelOutputs =
      error && typeof error === "object" && "noteGenerationRawModelOutputs" in error
        ? ((error as { noteGenerationRawModelOutputs?: string[] })
            .noteGenerationRawModelOutputs ?? [])
        : [];
    const repairActions =
      error && typeof error === "object" && "noteGenerationRepairActions" in error
        ? ((error as { noteGenerationRepairActions?: string[] })
            .noteGenerationRepairActions ?? [])
        : [];
    await writeNoteGenerationAudit(
      buildNoteGenerationAuditEntry({
        ...auditBase,
        noteId: null,
        repairAttempts: repairActions.length,
        validatorIssues: [],
        criticalIssues: [],
        finalValidatorIssues: [],
        finalCriticalIssues: [],
        attemptHistory,
        repairActions,
        warnings,
        rawModelOutputs,
        finalStatus: "model_failed",
      }),
    );
    return {
      ok: false,
      status: 502,
      error: "AI note generation failed.",
      messages: [modelFailureMessage(error)],
    };
  }

  warnings.push(`Clinical narrative generated via ${openaiNoteGenerationLabel()}.`);
  warnings.push(...modelGeneration.warnings);
  const trialSummaries = hourlyAssignments.map((assignment) => {
    const entry = body.programTrialData[String(assignment.programId)]!;
    return {
      totalTrials: entry.count!,
      successfulTrialNumbers: [...entry.effectiveTrials],
    };
  });
  const closingPreferences = profile?.assessmentSummary?.reinforcementPreferences ?? [];
  const noteContent = assembleSessionNote({
    opening: buildLockedOpening(
      body.presentPeople,
      body.hasEnvironmentalChanges,
      body.therapySetting,
      profile?.firstName,
    ),
    clinicalBody: modelGeneration.body,
    closing: buildLockedClosingParagraph(closingPreferences),
    performance: buildPerformanceSentence(
      body.sessionHours,
      trialSummaries,
      profile?.firstName,
    ),
    nextSession: buildNextSessionSentence(body.nextSessionDate),
  });

  const accuracyReport = buildNoteAccuracyReport({
    effectiveIssues: [],
    alteredSelections: [],
    missingSelectedProgramNames: [],
    assessmentGrounded: assessmentExcerpt.length > 0,
  });
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

  await writeNoteGenerationAudit(
    buildNoteGenerationAuditEntry({
      ...auditBase,
      model: modelGeneration.modelUsed,
      noteId: inserted.id,
      repairAttempts: modelGeneration.repairAttempts,
      validatorIssues: [],
      criticalIssues: [],
      finalValidatorIssues: [],
      finalCriticalIssues: [],
      attemptHistory: modelGeneration.attemptHistory,
      repairActions: modelGeneration.repairActions,
      warnings,
      rawModelOutputs: modelGeneration.rawModelOutputs,
      clinicalBody: modelGeneration.body,
      finalNoteText: noteContent,
      accuracyReport,
      finalStatus: warnings.length > 1 ? "saved_with_warnings" : "saved",
    }),
  );

  return {
    ok: true,
    noteId: inserted.id,
    content: noteContent,
    generatedAt,
    generationModel: modelGeneration.modelUsed,
    warnings,
    maladaptiveReplacementPairings: [],
    accuracyReport,
  };
}
