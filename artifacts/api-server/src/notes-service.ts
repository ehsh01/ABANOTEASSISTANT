import { and, eq } from "drizzle-orm";
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
import { criterionPercentageOrZero, resolveHourlyProgramIds, scrubAssessmentNames, ZERO_CRITERION_TRIAL_ENTRY } from "./flexible-note-input";

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
  if ((profile?.maladaptiveBehaviors ?? []).length === 0) {
    return {
      ok: false,
      status: 422,
      error: "Approved behaviors required",
      messages: ["Add at least one approved maladaptive behavior to the client profile."],
    };
  }
  if ((profile?.interventions ?? []).length === 0) {
    return {
      ok: false,
      status: 422,
      error: "Approved interventions required",
      messages: ["Add at least one approved intervention to the client profile."],
    };
  }

  const hints = body.abcHints;
  const inputErrors: string[] = [];
  if (hints.length !== body.sessionHours) {
    inputErrors.push(`abcHints must contain exactly ${body.sessionHours} hourly rows.`);
  }
  if (body.selectedReplacements.length === 0) {
    inputErrors.push("Select at least one replacement program.");
  }
  if (inputErrors.length > 0) {
    return {
      ok: false,
      status: 400,
      error: "Invalid hourly program assignments",
      messages: inputErrors,
    };
  }

  const allLinkedPrograms = await db
    .select({ id: programsTable.id, name: programsTable.name })
    .from(clientProgramsTable)
    .innerJoin(programsTable, eq(clientProgramsTable.programId, programsTable.id))
    .where(
      and(
        eq(clientProgramsTable.clientId, client.id),
        eq(programsTable.companyId, companyId),
      ),
    );
  const programNameById = new Map(allLinkedPrograms.map((program) => [program.id, program.name]));
  const linkedIds = allLinkedPrograms.map((program) => program.id);
  if (linkedIds.length === 0) {
    return {
      ok: false,
      status: 400,
      error: "Invalid hourly program assignments",
      messages: ["This client has no linked replacement programs."],
    };
  }

  const assignedIds = resolveHourlyProgramIds({
    sessionHours: body.sessionHours,
    hintProgramIds: hints.map((hint) => hint.replacementProgramId),
    selectedIds: body.selectedReplacements,
    linkedIds,
  });
  if (assignedIds.length !== body.sessionHours) {
    return {
      ok: false,
      status: 400,
      error: "Invalid hourly program assignments",
      messages: ["Could not assign one replacement program to every service hour."],
    };
  }

  const hourlyAssignments = assignedIds.map((programId, segmentIndex) => {
    const hint = hints[segmentIndex];
    const trialEntry =
      body.programTrialData[String(programId)] ?? ZERO_CRITERION_TRIAL_ENTRY;
    return {
      segmentIndex,
      programId,
      programName: programNameById.get(programId)!,
      // Blank percentage means the program did not meet criterion.
      criterionPercentage: criterionPercentageOrZero(trialEntry),
      activityHint: hint?.activityAntecedent?.trim() || null,
      behaviorHint: hint?.maladaptiveBehavior?.trim() || null,
    };
  });

  const rawAssessment = profile?.assessmentTextSnapshot?.trim() ?? "";
  const { text: truncatedAssessment, truncated } =
    truncateAssessmentTextForNoteContext(rawAssessment);
  const assessmentExcerpt = scrubAssessmentNames(truncatedAssessment, profile);

  const context: NoteGenerationContext = {
    sessionHours: body.sessionHours,
    sessionDate: body.sessionDate,
    therapySetting: body.therapySetting,
    environmentalChanges: body.environmentalChanges?.trim() ?? "",
    profileBehaviors: profile?.maladaptiveBehaviors ?? [],
    profileBehaviorTargets: (profile?.maladaptiveBehaviorTargets ?? [])
      .filter((target) => (profile?.maladaptiveBehaviors ?? []).includes(target.name))
      .map((target) => ({
        name: target.name,
        topography: target.topography?.trim() || null,
      })),
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
    const entry =
      body.programTrialData[String(assignment.programId)] ?? ZERO_CRITERION_TRIAL_ENTRY;
    return {
      totalTrials: entry.count ?? ZERO_CRITERION_TRIAL_ENTRY.count,
      successfulTrialNumbers: [...(entry.effectiveTrials ?? [])],
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
      finalValidatorIssues: modelGeneration.finalPlanIssues,
      finalCriticalIssues: [],
      attemptHistory: modelGeneration.attemptHistory,
      repairActions: modelGeneration.repairActions,
      warnings,
      rawModelOutputs: modelGeneration.rawModelOutputs,
      clinicalBody: modelGeneration.body,
      finalNoteText: noteContent,
      accuracyReport,
      finalStatus:
        modelGeneration.finalPlanIssues.length > 0 || warnings.length > 1
          ? "saved_with_warnings"
          : "saved",
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
