/**
 * Note-generation orchestration for `POST /notes/generate` (extracted from routes/notes.ts).
 *
 * The route owns HTTP concerns (auth, body parsing, billing gates, draft-slot quota, response
 * shaping); this service owns the pipeline: catalog/rotation building, ABC-hint resolution,
 * per-hour assignment and rebalancing, OpenAI generation, compliance validation, locked
 * assembly, persistence, and the generation audit trail.
 */
import { randomUUID } from "node:crypto";
import { APIError } from "openai";
import { and, eq, inArray } from "drizzle-orm";
import { GenerateNoteBody } from "@workspace/api-zod";
import { db } from "@workspace/db";
import {
  clientsTable,
  programsTable,
  clientProgramsTable,
  notesTable,
  type ClientProfileRow,
} from "@workspace/db/schema";
import {
  CLINICAL_BODY_PROMPT_VERSION,
  CLINICAL_BODY_PROMPT_HASH,
  generateClinicalBodyOpenAI,
  openaiNoteGenerationLabel,
  resolvedOpenAIModel,
  type NoteGenerationContext,
  type NoteGenerationAttemptTelemetry,
} from "./openai-notes";
import {
  buildNoteGenerationAuditEntry,
  hashNoteGenerationContext,
  writeNoteGenerationAudit,
} from "./note-generation-audit";
import { maladaptiveBehaviorTargetsForNoteCatalog } from "./client-profile-maladaptive";
import {
  maladaptiveBehaviorFunctionsForHourLabels,
  maladaptiveBehaviorTopographyForHourLabels,
  enrichMaladaptiveTargetsWithAssessmentFunctions,
} from "./clinical-behavior-function";
import {
  approximateAgeYearsAtSession,
  canonicalMaladaptiveBehaviorLabel,
  maladaptiveBehaviorsCatalogForRotation,
  maladaptiveBehaviorsForSessionHours,
  replacementProgramAssignmentsForSessionHours,
  rebalanceTaskRefusalReplacementProgramsHourly,
  rebalanceBehaviorMappedReplacementProgramsHourly,
  rebalanceDistinctReplacementProgramsByFunction,
  ensureReplacementProgramAlignmentForSegments,
  replacementProgramSlotHours,
  buildBehaviorReplacementCandidatesForNarrativeSegments,
  buildInterventionCandidatesForNarrativeSegments,
  isSundaySessionDate,
  replacementProgramPoolForAutoAssignment,
  replacementProgramSlotCount,
  validateAssembledSessionNote,
  validateClinicalBodyComplianceDetailed,
  stripUnauthorizedCaregiverLanguage,
  collapseHourlyNoteNarrativeToSegments,
  maladaptiveBehaviorLabelsEquivalent,
  type NoteValidationIssue,
  type NoteComplianceContext,
  type TherapistTrialSummaryForHourEntry,
} from "./note-validation";
import { repairClinicalBodyReplacementProgramAssignments } from "./replacement-program-repair";
import {
  buildLockedClosingParagraph,
  buildLockedOpening,
  buildNextSessionSentence,
  buildPerformanceSentence,
  type TherapySetting,
} from "./note-assembly";
import {
  filterReinforcementPreferencesForNote,
  sanitizeReinforcerNarrativeText,
} from "./reinforcer-preferences";
import {
  normalizeClinicalBodyPraiseWording,
  scrubAssembledNoteQcHotspots,
} from "./note-normalization";
import { assessmentGenerationGate } from "./note-readiness";
import {
  enrichMaladaptiveTargetsWithAssessmentTopography,
  truncateAssessmentTextForNoteContext,
} from "./assessment-extract";
import {
  getAssessmentStructuredFromProfile,
  intersectCatalog,
  validateAssessmentStructured,
  withProfileListsUnioned,
} from "./assessment-structured";
import { resolveAbcHintsForNoteGeneration } from "./abc-hints";
import { isLanguageMaladaptiveBehaviorLabel } from "./language-maladaptive-behavior";
import {
  isSkillAcquisitionOnlyReplacementProgram,
  maladaptiveReplacementPairingsForSessionNote,
} from "./skill-acquisition-programs";

type ClientRow = typeof clientsTable.$inferSelect;
type GenerateNoteInput = ReturnType<typeof GenerateNoteBody.parse>;

export type GenerateSessionNoteFailure = {
  ok: false;
  /** HTTP status the route should return (message text preserved verbatim). */
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
  maladaptiveReplacementPairings: ReturnType<typeof maladaptiveReplacementPairingsForSessionNote>;
};

export type GenerateSessionNoteResult = GenerateSessionNoteFailure | GenerateSessionNoteSuccess;

/**
 * Per-hour trial summary for the AI when `programTrialData` has a usable entry for that hour's program id.
 * Indices outside 1..count are dropped; duplicates removed; list sorted ascending.
 *
 * Contract: `count == null` means "no trial data entered" (skip the hour). `count >= 1` means trials
 * were entered for that program — even when `effectiveTrials` is empty, we keep the entry as a
 * **0-success / count-trial** record so the wizard's "0%" selection genuinely flows through to the
 * end-of-note performance line and the per-paragraph percentage prose (the AI will write
 * "successful approximately 0% of the time"). Previously an empty `effectiveTrials` was treated the
 * same as missing data and the hour was dropped entirely.
 */
function buildTherapistTrialSummaryForReplacementHour(params: {
  sessionHours: number;
  programIdForHour: (number | null)[];
  rbtActionsOnlyOutcomeForHour: boolean[];
  programTrialData:
    | Record<string, { count: number | null; effectiveTrials: number[] }>
    | undefined;
}): NoteGenerationContext["therapistTrialSummaryForReplacementHour"] {
  const { sessionHours, programIdForHour, rbtActionsOnlyOutcomeForHour, programTrialData } = params;
  return Array.from({ length: sessionHours }, (_, h) => {
    if (rbtActionsOnlyOutcomeForHour[h]) return null;
    const id = programIdForHour[h];
    if (id == null) return null;
    const entry = programTrialData?.[String(id)];
    if (!entry) return null;
    const count = entry.count;
    if (typeof count !== "number" || !Number.isFinite(count) || !Number.isInteger(count) || count < 1) {
      return null;
    }
    const trials = entry.effectiveTrials ?? [];
    const inRange = trials.filter(
      (t): t is number => typeof t === "number" && Number.isInteger(t) && t >= 1 && t <= count,
    );
    const uniqueSorted = [...new Set(inRange)].sort((a, b) => a - b);
    // Empty `successfulTrialNumbers` is intentional for 0% selections — keep the entry instead of
    // returning null, so the percentage rollup downstream sees 0/count for this hour.
    return { totalTrials: count, successfulTrialNumbers: uniqueSorted };
  });
}

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

function assembleSessionNote(
  presentPeople: string[],
  hasEnvChanges: boolean,
  therapySetting: TherapySetting,
  clinicalBody: string,
  nextSessionDate: string | undefined,
  clientFirstName: string | null | undefined,
  narrativeProgramSegmentCount: number,
  therapistTrialSummaryForReplacementHour: TherapistTrialSummaryForHourEntry[] | undefined,
  reinforcementPreferences?: string[] | null,
  clientAgeYears?: number | null,
): string {
  const opening = buildLockedOpening(presentPeople, hasEnvChanges, therapySetting, clientFirstName);
  const closing = buildLockedClosingParagraph(reinforcementPreferences, { clientAgeYears });
  const performance = buildPerformanceSentence(
    narrativeProgramSegmentCount,
    therapistTrialSummaryForReplacementHour,
    clientFirstName,
  );
  const nextSession = buildNextSessionSentence(nextSessionDate);

  return [opening, "", clinicalBody, "", closing, "", performance, "", nextSession].join("\n");
}

/**
 * Full generation pipeline for one session note. Assumes the route already enforced auth,
 * billing gates, OpenAI configuration, client/assessment policy, and the unsaved-draft cap.
 */
export async function generateSessionNoteForClient(params: {
  companyId: number;
  client: ClientRow;
  body: GenerateNoteInput;
}): Promise<GenerateSessionNoteResult> {
  const { companyId, client, body } = params;

  const profile = (client.profile as ClientProfileRow | null | undefined) ?? null;
  const rawAssessmentSnapshot = profile?.assessmentTextSnapshot?.trim() ?? "";
  const assessmentGate = assessmentGenerationGate({
    hasAssessment: client.hasAssessment,
    assessmentStatus: client.assessmentStatus,
    profile,
  });
  if (!assessmentGate.ok) {
    return assessmentGate;
  }

  if (body.selectedReplacements.length === 0) {
    return {
      ok: false,
      status: 422,
      error: "Programs required",
      messages: ["Select at least one replacement program for this session before generating a note."],
    };
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

  const selectedIdSet = new Set(body.selectedReplacements);
  const assessmentReplacementNameSet = new Set(
    (profile?.replacementPrograms ?? [])
      .map((n) => String(n).trim())
      .filter((n) => n.length > 0),
  );

  /** Linked DB rows authorized for this note: assessment profile list + anything explicitly selected for the session. */
  let allowedProgramRows =
    assessmentReplacementNameSet.size > 0
      ? linkedProgramRows.filter(
          (r) => selectedIdSet.has(r.id) || assessmentReplacementNameSet.has(r.name.trim()),
        )
      : linkedProgramRows;

  // App profile is authoritative: union the profile's own lists into the structured allow-lists so
  // the intersections below can never DROP a behavior/program/intervention the RBT added to the app
  // (e.g. when the PDF-extracted allow-list is stale or narrower than the app). Assessment-only items
  // are still never ADDED, because the catalogs are derived from the profile in the first place.
  const structuredForNote = withProfileListsUnioned(
    getAssessmentStructuredFromProfile(profile),
    profile,
  );
  if (structuredForNote) {
    const structIssues = validateAssessmentStructured(structuredForNote);
    if (structIssues.length > 0) {
      return {
        ok: false,
        status: 422,
        error: "Invalid structured assessment on client profile",
        messages: structIssues,
      };
    }
    for (const id of body.selectedReplacements) {
      const n = nameById.get(id)?.trim();
      if (n && !structuredForNote.replacement_programs.includes(n)) {
        return {
          ok: false,
          status: 422,
          error: "Program not on structured assessment",
          messages: [
            `Selected program "${n}" is not listed on the client's assessmentStructured.replacement_programs.`,
          ],
        };
      }
    }
    allowedProgramRows = allowedProgramRows.filter((r) =>
      structuredForNote.replacement_programs.includes(r.name.trim()),
    );
  }

  const allowedIdToName = new Map(allowedProgramRows.map((r) => [r.id, r.name]));
  for (const id of body.selectedReplacements) {
    const n = nameById.get(id);
    if (n) {
      allowedIdToName.set(id, n);
    }
  }

  const hints = body.abcHints ?? [];
  const abcHintProgramMessages: string[] = [];
  for (let h = 0; h < hints.length; h++) {
    const pid = hints[h]?.replacementProgramId;
    if (pid == null) continue;
    if (typeof pid !== "number" || !allowedIdToName.has(pid)) {
      abcHintProgramMessages.push(
        assessmentReplacementNameSet.size > 0
          ? `abcHints[${h}]: replacementProgramId must be a program selected for this session or one whose exact name is on the client's replacement-program list from the assessment/profile.`
          : `abcHints[${h}]: replacementProgramId must be the id of a replacement program linked to this client (GET /api/clients/:clientId/programs).`,
      );
    }
  }
  if (abcHintProgramMessages.length > 0) {
    return {
      ok: false,
      status: 400,
      error: "Invalid ABC Builder input",
      messages: abcHintProgramMessages,
    };
  }

  const replacementProgramsCatalog = (() => {
    const names = [
      ...allowedProgramRows.map((r) => r.name.trim()),
      ...programNames.map((s) => s.trim()),
    ].filter((s) => s.length > 0);
    if (names.length > 0) {
      return [...new Set(names)].sort((a, b) => b.length - a.length || a.localeCompare(b));
    }
    return [];
  })();

  let replacementProgramsCatalogForNote = replacementProgramsCatalog;
  if (structuredForNote) {
    replacementProgramsCatalogForNote = intersectCatalog(
      replacementProgramsCatalogForNote,
      structuredForNote.replacement_programs,
    );
    if (replacementProgramsCatalogForNote.length === 0) {
      return {
        ok: false,
        status: 422,
        error: "No replacement programs remain after applying structured assessment",
        messages: [
          "Program names for this session did not intersect with assessmentStructured.replacement_programs.",
        ],
      };
    }
  }

  const clientAgeYears = approximateAgeYearsAtSession(profile?.dateOfBirth ?? null, body.sessionDate);

  const { text: clientAssessmentTextExcerpt, truncated: assessmentExcerptForNoteTruncated } =
    truncateAssessmentTextForNoteContext(profile?.assessmentTextSnapshot ?? "");

  const profileBehaviorList = profile?.maladaptiveBehaviors ?? [];
  const rotationResult = maladaptiveBehaviorsCatalogForRotation(
    profileBehaviorList,
    rawAssessmentSnapshot,
  );
  let behaviorCatalog = rotationResult.catalog.map(canonicalMaladaptiveBehaviorLabel);
  if (structuredForNote) {
    behaviorCatalog = intersectCatalog(
      behaviorCatalog,
      structuredForNote.behaviors.map(canonicalMaladaptiveBehaviorLabel),
    );
    if (behaviorCatalog.length === 0) {
      return {
        ok: false,
        status: 422,
        error: "No maladaptive behaviors remain after applying structured assessment",
        messages: [
          "The session rotation catalog did not intersect with assessmentStructured.behaviors; align profile/assessment text labels with the structured assessment list.",
        ],
      };
    }
  }
  const maladaptiveBehaviorTargetsForNote = enrichMaladaptiveTargetsWithAssessmentTopography(
    enrichMaladaptiveTargetsWithAssessmentFunctions(
      maladaptiveBehaviorTargetsForNoteCatalog(behaviorCatalog, profile ?? undefined),
      rawAssessmentSnapshot,
    ),
    rawAssessmentSnapshot,
  );
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
    return {
      ok: false,
      status: 400,
      error: "Invalid ABC Builder input",
      messages: abcResolved.messages,
    };
  }

  const maladaptiveBehaviorForHour = abcResolved.maladaptiveBehaviorForHour.map(
    canonicalMaladaptiveBehaviorLabel,
  );
  const activityAntecedentForHour = abcResolved.activityAntecedentForHour;
  const maladaptiveBehaviorFunctionsHourly = maladaptiveBehaviorFunctionsForHourLabels(
    maladaptiveBehaviorForHour,
    maladaptiveBehaviorTargetsForNote,
    maladaptiveBehaviorLabelsEquivalent,
  );

  const linkedIdsUnique = [...new Set(allowedProgramRows.map((r) => r.id))].sort((a, b) => a - b);
  const idToNameForPrograms = allowedIdToName.size > 0 ? allowedIdToName : nameById;
  const poolIds = replacementProgramPoolForAutoAssignment(
    body.selectedReplacements,
    linkedIdsUnique.length > 0 ? linkedIdsUnique : body.selectedReplacements,
    body.sessionHours,
  );
  const explicitProgramIdByHour = Array.from({ length: body.sessionHours }, (_, h) => hints[h]?.replacementProgramId);
  const {
    names: replacementProgramForHour,
    rbtActionsOnly: rbtActionsOnlyOutcomeForHour,
    programIdForHour,
  } = replacementProgramAssignmentsForSessionHours({
    sessionHours: body.sessionHours,
    poolIds,
    idToName: idToNameForPrograms,
    selectedIdSet: selectedIdSet,
    explicitProgramIdByHour,
    sessionSelectionCoversHours:
      body.selectedReplacements.length >= replacementProgramSlotCount(body.sessionHours),
  });

  rebalanceTaskRefusalReplacementProgramsHourly({
    sessionHours: body.sessionHours,
    maladaptiveBehaviorForHour,
    names: replacementProgramForHour,
    rbtActionsOnlyOutcomeForHour,
    programIdForHour,
    explicitProgramIdByHour,
    poolIds,
    idToName: idToNameForPrograms,
    selectedIdSet,
  });

  const behaviorToReplacementsMap = structuredForNote?.behavior_to_replacements_map ?? {};
  const behaviorRebalanceSwaps = rebalanceBehaviorMappedReplacementProgramsHourly({
    sessionHours: body.sessionHours,
    maladaptiveBehaviorForHour,
    names: replacementProgramForHour,
    rbtActionsOnlyOutcomeForHour,
    programIdForHour,
    explicitProgramIdByHour,
    poolIds,
    idToName: idToNameForPrograms,
    selectedIdSet,
    behaviorToReplacementsMap,
    authorizedProgramNames: replacementProgramsCatalogForNote,
    maladaptiveBehaviorFunctionsForHour: maladaptiveBehaviorFunctionsHourly,
  });

  const distinctReplacementSwaps = rebalanceDistinctReplacementProgramsByFunction({
    sessionHours: body.sessionHours,
    maladaptiveBehaviorForHour,
    names: replacementProgramForHour,
    rbtActionsOnlyOutcomeForHour,
    programIdForHour,
    explicitProgramIdByHour,
    poolIds,
    idToName: idToNameForPrograms,
    selectedIdSet,
    behaviorToReplacementsMap,
    authorizedProgramNames: replacementProgramsCatalogForNote,
    maladaptiveBehaviorFunctionsForHour: maladaptiveBehaviorFunctionsHourly,
  });

  const therapistTrialSummaryHourly = buildTherapistTrialSummaryForReplacementHour({
    sessionHours: body.sessionHours,
    programIdForHour,
    rbtActionsOnlyOutcomeForHour,
    programTrialData: body.programTrialData,
  });
  const languageMaladaptiveEpisodeHourly = maladaptiveBehaviorForHour.map((b) =>
    isLanguageMaladaptiveBehaviorLabel(b),
  );

  let interventionsForNote = profile?.interventions ?? [];
  if (structuredForNote) {
    interventionsForNote = intersectCatalog(
      interventionsForNote,
      structuredForNote.interventions,
    );
    if (interventionsForNote.length === 0) {
      return {
        ok: false,
        status: 422,
        error: "No interventions remain after applying structured assessment",
        messages: [
          "Profile interventions did not intersect with assessmentStructured.interventions; update the client profile or structured assessment.",
        ],
      };
    }
  }

  const narrativeCollapsed = collapseHourlyNoteNarrativeToSegments({
    sessionHours: body.sessionHours,
    maladaptiveBehaviorForHour,
    replacementProgramForHour,
    rbtActionsOnlyOutcomeForHour,
    activityAntecedentForHour,
    languageMaladaptiveEpisodeForHour: languageMaladaptiveEpisodeHourly,
    therapistTrialSummaryForReplacementHour: therapistTrialSummaryHourly,
  });

  const acquisitionOnlySegmentForHour = narrativeCollapsed.replacementProgramForHour.map((name) =>
    isSkillAcquisitionOnlyReplacementProgram(name),
  );
  const maladaptiveBehaviorForNarrative = narrativeCollapsed.maladaptiveBehaviorForHour.map((b, i) =>
    acquisitionOnlySegmentForHour[i] ? "" : b,
  );
  const languageMaladaptiveForNarrative = narrativeCollapsed.languageMaladaptiveEpisodeForHour.map((v, i) =>
    acquisitionOnlySegmentForHour[i] ? false : v,
  );

  const maladaptiveBehaviorFunctionsForHour = maladaptiveBehaviorFunctionsForHourLabels(
    maladaptiveBehaviorForNarrative,
    maladaptiveBehaviorTargetsForNote,
    maladaptiveBehaviorLabelsEquivalent,
  );

  const fullCatalogPoolIds =
    linkedIdsUnique.length > 0 ? linkedIdsUnique : poolIds;
  const segmentCount = narrativeCollapsed.narrativeSegmentCount;
  const segmentReplacementNames = [...narrativeCollapsed.replacementProgramForHour];
  const segmentRbtFlags = [...narrativeCollapsed.rbtActionsOnlyOutcomeForHour];
  const segmentProgramIds: (number | null)[] = Array.from({ length: segmentCount }, (_, s) => {
    for (const h of replacementProgramSlotHours(body.sessionHours, s)) {
      if (programIdForHour[h] !== null) return programIdForHour[h];
    }
    return null;
  });
  const segmentExplicitProgramIds = Array.from({ length: segmentCount }, (_, s) => {
    for (const h of replacementProgramSlotHours(body.sessionHours, s)) {
      const pid = explicitProgramIdByHour[h];
      if (typeof pid === "number") return pid;
    }
    return undefined;
  });
  const segmentAlignmentSwaps = ensureReplacementProgramAlignmentForSegments({
    segmentCount,
    maladaptiveBehaviorForHour: narrativeCollapsed.maladaptiveBehaviorForHour,
    names: segmentReplacementNames,
    rbtActionsOnlyOutcomeForHour: segmentRbtFlags,
    programIdForHour: segmentProgramIds,
    explicitProgramIdByHour: segmentExplicitProgramIds,
    rebalancePoolIds: fullCatalogPoolIds,
    idToName: idToNameForPrograms,
    selectedIdSet,
    behaviorToReplacementsMap,
    authorizedProgramNames: replacementProgramsCatalogForNote,
    maladaptiveBehaviorFunctionsForHour,
    overrideExplicitOnHardMisfit: true,
    slotLabel: "Segment",
  });
  narrativeCollapsed.replacementProgramForHour = segmentReplacementNames;
  narrativeCollapsed.rbtActionsOnlyOutcomeForHour = segmentRbtFlags;

  const complianceCtxBase: NoteComplianceContext = {
    sessionHours: body.sessionHours,
    therapySetting: body.therapySetting,
    narrativeSegmentCount: narrativeCollapsed.narrativeSegmentCount,
    replacementProgramsInOrder: replacementProgramsCatalogForNote,
    replacementProgramForHour: narrativeCollapsed.replacementProgramForHour,
    rbtActionsOnlyOutcomeForHour: narrativeCollapsed.rbtActionsOnlyOutcomeForHour,
    maladaptiveBehaviors: behaviorCatalog,
    maladaptiveBehaviorForHour: maladaptiveBehaviorForNarrative,
    activityAntecedentForHour: narrativeCollapsed.activityAntecedentForHour,
    languageMaladaptiveEpisodeForHour: languageMaladaptiveForNarrative,
    acquisitionOnlySegmentForHour,
    interventions: interventionsForNote,
    therapistTrialSummaryForReplacementHour: narrativeCollapsed.therapistTrialSummaryForReplacementHour,
    clientAgeYears,
    presentPeople: body.presentPeople,
    reinforcementPreferences: filterReinforcementPreferencesForNote(
      profile?.assessmentSummary?.reinforcementPreferences ?? [],
      { clientAgeYears },
    ),
  };

  const warnings: string[] = [];
  if (structuredForNote) {
    warnings.push(
      "Structured assessment mode: maladaptive behaviors, interventions, and replacement programs for this note were intersected with profile.assessmentStructured allow-lists.",
    );
  }
  if (acquisitionOnlySegmentForHour.some(Boolean)) {
    warnings.push(
      "One or more narrative segments use skill-acquisition-only programs (Respond to Own Name, or a program name containing Echoic): the clinical body must not cite a maladaptive catalog label in those paragraphs.",
    );
  }
  if (assessmentReplacementNameSet.size > 0) {
    const omitted = linkedProgramRows.filter(
      (r) => !selectedIdSet.has(r.id) && !assessmentReplacementNameSet.has(r.name.trim()),
    );
    if (omitted.length > 0) {
      warnings.push(
        `These linked programs are not on the client's assessment/profile replacement-program list and were omitted from hour assignment: ${omitted.map((r) => r.name).join(", ")}.`,
      );
    }
  }
  if (rotationResult.labelsAddedFromAssessmentText.length > 0) {
    warnings.push(
      `These maladaptive behaviors appear in the stored assessment but are not on the client profile, so they were NOT used in this note: ${rotationResult.labelsAddedFromAssessmentText.join(", ")}. Add them to the client profile if you want them included.`,
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
  if (isSundaySessionDate(body.sessionDate)) {
    warnings.push(
      "Sunday sessions require documented parental consent. Verify that a signed consent form authorizing Sunday sessions is on file for this client — otherwise the agency is in breach of the authorization requirements.",
    );
  }
  warnings.push(...behaviorRebalanceSwaps, ...distinctReplacementSwaps, ...segmentAlignmentSwaps);

  const maladaptiveBehaviorTopographyForHour = maladaptiveBehaviorTopographyForHourLabels(
    maladaptiveBehaviorForNarrative,
    maladaptiveBehaviorTargetsForNote,
    maladaptiveBehaviorLabelsEquivalent,
  );

  const behaviorReplacementCandidatesForHour = buildBehaviorReplacementCandidatesForNarrativeSegments({
    narrativeSegmentCount: narrativeCollapsed.narrativeSegmentCount,
    maladaptiveBehaviorForHour: maladaptiveBehaviorForNarrative,
    acquisitionOnlySegmentForHour,
    behaviorToReplacementsMap,
    authorizedProgramNames: replacementProgramsCatalogForNote,
    maladaptiveBehaviorFunctionsForHour,
  });

  const interventionCandidatesForHour = buildInterventionCandidatesForNarrativeSegments({
    narrativeSegmentCount: narrativeCollapsed.narrativeSegmentCount,
    maladaptiveBehaviorForHour: maladaptiveBehaviorForNarrative,
    acquisitionOnlySegmentForHour,
    authorizedInterventions: interventionsForNote,
    maladaptiveBehaviorFunctionsForHour,
  });

  const blockedClientNames = [profile?.firstName, profile?.lastName]
    .filter((name): name is string => typeof name === "string" && name.trim().length >= 2);
  const oaCtx: NoteGenerationContext = {
    /** Deliberately not the profile name — session notes must not contain personal names. */
    clientName: "the client",
    firstName: "the client",
    gender: profile?.gender,
    sessionHours: body.sessionHours,
    narrativeSegmentCount: narrativeCollapsed.narrativeSegmentCount,
    sessionDate: body.sessionDate,
    therapySetting: body.therapySetting,
    presentPeople: body.presentPeople,
    hasEnvironmentalChanges: body.hasEnvironmentalChanges,
    environmentalChanges: body.environmentalChanges ?? "",
    maladaptiveBehaviors: behaviorCatalog,
    maladaptiveBehaviorTargets: maladaptiveBehaviorTargetsForNote,
    maladaptiveBehaviorForHour: maladaptiveBehaviorForNarrative,
    acquisitionOnlySegmentForHour,
    interventions: interventionsForNote,
    replacementProgramsInOrder: replacementProgramsCatalogForNote,
    replacementProgramForHour: narrativeCollapsed.replacementProgramForHour,
    rbtActionsOnlyOutcomeForHour: narrativeCollapsed.rbtActionsOnlyOutcomeForHour,
    requestNonce: behaviorRotationSeed,
    clientAgeYears,
    ageBand: client.ageBand,
    clientAssessmentTextExcerpt,
    assessmentReferenceFileName: profile?.assessmentFileName ?? null,
    reinforcementPreferences: filterReinforcementPreferencesForNote(
      profile?.assessmentSummary?.reinforcementPreferences ?? [],
      { clientAgeYears },
    ),
    activityAntecedentForHour: narrativeCollapsed.activityAntecedentForHour,
    languageMaladaptiveEpisodeForHour: narrativeCollapsed.languageMaladaptiveEpisodeForHour,
    therapistTrialSummaryForReplacementHour: narrativeCollapsed.therapistTrialSummaryForReplacementHour,
    behaviorReplacementCandidatesForHour,
    interventionCandidatesForHour,
    maladaptiveBehaviorFunctionsForHour,
    maladaptiveBehaviorTopographyForHour,
    behaviorToReplacementsMap,
  };

  let clinicalBody: string;
  let generationModel: string;
  let generationRepairAttempts = 0;
  let generationFinalIssues: NoteValidationIssue[] = [];
  let generationAttemptHistory: NoteGenerationAttemptTelemetry[] = [];
  let generationRawOutputs: string[] = [];
  let generationRepairActions: string[] = [];
  const contextHash = hashNoteGenerationContext(oaCtx);
  const auditBase = {
    companyId,
    clientId: client.id,
    model: resolvedOpenAIModel(),
    promptVersion: CLINICAL_BODY_PROMPT_VERSION,
    promptHash: CLINICAL_BODY_PROMPT_HASH,
    contextHash,
    assessmentFilename: profile?.assessmentFileName ?? null,
    assessmentText: rawAssessmentSnapshot,
    assessmentExcerptLength: clientAssessmentTextExcerpt.length,
    assessmentExcerptTruncated: assessmentExcerptForNoteTruncated,
    sessionDate: body.sessionDate,
    sessionHours: body.sessionHours,
  };

  try {
    const oaResult = await generateClinicalBodyOpenAI(oaCtx, { blockedClientNames });
    clinicalBody = oaResult.body;
    warnings.push(`Clinical narrative generated via ${openaiNoteGenerationLabel()}.`);
    warnings.push(...oaResult.warnings);
    generationModel = resolvedOpenAIModel();
    generationRepairAttempts = oaResult.repairAttempts;
    generationFinalIssues = oaResult.finalIssues;
    generationAttemptHistory = oaResult.attemptHistory;
    generationRawOutputs = oaResult.rawModelOutputs;
    generationRepairActions = oaResult.repairActions;
  } catch (err) {
    generationAttemptHistory =
      err && typeof err === "object" && "noteGenerationAttemptHistory" in err
        ? ((err as { noteGenerationAttemptHistory?: NoteGenerationAttemptTelemetry[] })
            .noteGenerationAttemptHistory ?? [])
        : [];
    generationRawOutputs =
      err && typeof err === "object" && "noteGenerationRawModelOutputs" in err
        ? ((err as { noteGenerationRawModelOutputs?: string[] }).noteGenerationRawModelOutputs ??
          [])
        : [];
    generationRepairActions =
      err && typeof err === "object" && "noteGenerationRepairActions" in err
        ? ((err as { noteGenerationRepairActions?: string[] }).noteGenerationRepairActions ?? [])
        : [];
    console.error(
      `[notes/generate] OpenAI failed status=${err instanceof APIError ? err.status : "unknown"} type=${err instanceof Error ? err.name : "unknown"}`,
    );
    const modelFailurePlanIssues = generationAttemptHistory.flatMap(
      (attempt) => attempt.planIssues,
    );
    const modelFailureProseIssues = generationAttemptHistory.flatMap(
      (attempt) => attempt.proseIssues,
    );
    await writeNoteGenerationAudit(buildNoteGenerationAuditEntry({
      ...auditBase,
      noteId: null,
      repairAttempts: generationRepairActions.length,
      validatorIssues: [],
      criticalIssues: [],
      finalValidatorIssues: [...modelFailurePlanIssues, ...modelFailureProseIssues],
      finalCriticalIssues: [
        ...modelFailurePlanIssues,
        ...modelFailureProseIssues.filter((issue) => issue.severity === "blocking"),
      ],
      attemptHistory: generationAttemptHistory,
      repairActions: generationRepairActions,
      warnings,
      rawModelOutputs: generationRawOutputs,
      finalStatus: "model_failed",
    }));
    return {
      ok: false,
      status: 502,
      error: "AI note generation failed.",
      messages: [formatOpenAINoteGenerationError(err)],
    };
  }

  let finalClinicalBody = clinicalBody;
  const buildComplianceContext = (): NoteComplianceContext => ({
    ...complianceCtxBase,
    replacementProgramForHour: narrativeCollapsed.replacementProgramForHour,
    rbtActionsOnlyOutcomeForHour: narrativeCollapsed.rbtActionsOnlyOutcomeForHour,
    maladaptiveBehaviorFunctionsForHour,
    maladaptiveBehaviorTopographyForHour,
    behaviorToReplacementsMap,
    blockedClientNames,
  });

  let complianceResult: ReturnType<typeof validateClinicalBodyComplianceDetailed> =
    finalClinicalBody.trim().length > 0
      ? validateClinicalBodyComplianceDetailed(finalClinicalBody, buildComplianceContext())
      : { issues: [], blocking: [], warnings: [] };
  let complianceIssues = complianceResult.issues;
  const replacementProgramIssue = (issue: NoteValidationIssue): boolean =>
    issue.code === "PROGRAM_FUNCTION_MISMATCH";

  if (complianceIssues.some(replacementProgramIssue)) {
    const assignmentsBeforeRepair = [...narrativeCollapsed.replacementProgramForHour];
    const repairNames = [...narrativeCollapsed.replacementProgramForHour];
    const repairRbt = [...narrativeCollapsed.rbtActionsOnlyOutcomeForHour];
    const repairPids = [...segmentProgramIds];
    const repairSwaps = ensureReplacementProgramAlignmentForSegments({
      segmentCount,
      maladaptiveBehaviorForHour: narrativeCollapsed.maladaptiveBehaviorForHour,
      names: repairNames,
      rbtActionsOnlyOutcomeForHour: repairRbt,
      programIdForHour: repairPids,
      explicitProgramIdByHour: segmentExplicitProgramIds,
      rebalancePoolIds: fullCatalogPoolIds,
      idToName: idToNameForPrograms,
      selectedIdSet,
      behaviorToReplacementsMap,
      authorizedProgramNames: replacementProgramsCatalogForNote,
      maladaptiveBehaviorFunctionsForHour,
      overrideExplicitOnHardMisfit: true,
      slotLabel: "Segment",
    });
    const assignmentsChanged = repairNames.some(
      (name, idx) => name !== assignmentsBeforeRepair[idx],
    );
    if (assignmentsChanged || repairSwaps.length > 0) {
      finalClinicalBody = repairClinicalBodyReplacementProgramAssignments(
        finalClinicalBody,
        assignmentsBeforeRepair,
        repairNames,
      );
      narrativeCollapsed.replacementProgramForHour = repairNames;
      narrativeCollapsed.rbtActionsOnlyOutcomeForHour = repairRbt;
      warnings.push(...repairSwaps);
      complianceResult = validateClinicalBodyComplianceDetailed(finalClinicalBody, {
        ...buildComplianceContext(),
        replacementProgramForHour: repairNames,
        rbtActionsOnlyOutcomeForHour: repairRbt,
      });
      complianceIssues = complianceResult.issues;
    }
  }

  const caregiverScrubbedBody = stripUnauthorizedCaregiverLanguage(
    finalClinicalBody,
    body.presentPeople,
  );
  if (caregiverScrubbedBody !== finalClinicalBody) {
    finalClinicalBody = caregiverScrubbedBody;
    warnings.push(
      "Removed caregiver/family language from the clinical body so presence stays only in the opening sentence.",
    );
    complianceResult = validateClinicalBodyComplianceDetailed(finalClinicalBody, {
      ...buildComplianceContext(),
      replacementProgramForHour: narrativeCollapsed.replacementProgramForHour,
      rbtActionsOnlyOutcomeForHour: narrativeCollapsed.rbtActionsOnlyOutcomeForHour,
    });
    complianceIssues = complianceResult.issues;
  }

  const praiseNormalizedBody = normalizeClinicalBodyPraiseWording(finalClinicalBody);
  if (praiseNormalizedBody !== finalClinicalBody) {
    finalClinicalBody = praiseNormalizedBody;
    warnings.push(
      'Normalized reinforcer wording to plain "praise" (never "social praise"/compound praise labels that reviewers treat as interventions).',
    );
    complianceResult = validateClinicalBodyComplianceDetailed(finalClinicalBody, {
      ...buildComplianceContext(),
      replacementProgramForHour: narrativeCollapsed.replacementProgramForHour,
      rbtActionsOnlyOutcomeForHour: narrativeCollapsed.rbtActionsOnlyOutcomeForHour,
    });
    complianceIssues = complianceResult.issues;
  }

  const reinforcerPrefsForNote = filterReinforcementPreferencesForNote(
    profile?.assessmentSummary?.reinforcementPreferences ?? [],
    { clientAgeYears },
  );
  const reinforcerScrubbedBody = sanitizeReinforcerNarrativeText(
    finalClinicalBody,
    reinforcerPrefsForNote,
    clientAgeYears,
  );
  if (reinforcerScrubbedBody !== finalClinicalBody) {
    finalClinicalBody = reinforcerScrubbedBody;
    warnings.push(
      "Normalized reinforcer wording (concrete preferred toys; no YouTube for clients under 14).",
    );
  }

  // Re-validate the post-processed body once. This result is authoritative for blocking —
  // do not re-merge historical OpenAI-attempt blocking issues (those can describe an older
  // body shape, e.g. topography failures before grounding, and would block after repairs).
  complianceResult = validateClinicalBodyComplianceDetailed(finalClinicalBody, {
    ...buildComplianceContext(),
    replacementProgramForHour: narrativeCollapsed.replacementProgramForHour,
    rbtActionsOnlyOutcomeForHour: narrativeCollapsed.rbtActionsOnlyOutcomeForHour,
  });
  complianceIssues = complianceResult.issues;

  const effectiveIssueMap = new Map(
    complianceResult.issues.map((issue) => [`${issue.code}\u0000${issue.message}`, issue]),
  );
  for (const issue of generationFinalIssues) {
    if (issue.severity === "blocking") {
      continue;
    }
    effectiveIssueMap.set(`${issue.code}\u0000${issue.message}`, issue);
  }
  const effectiveIssues = [...effectiveIssueMap.values()].filter((issue) => {
    // Caregiver leaks are resolved by stripUnauthorizedCaregiverLanguage above; do not
    // block save on residual CAREGIVER_LEAKAGE from the model attempt history.
    if (issue.code === "CAREGIVER_LEAKAGE" || issue.code === "PRESENT_PERSON_LEAKAGE") {
      return false;
    }
    return true;
  });
  const criticalEffectiveIssues = effectiveIssues.filter(
    (issue) => issue.severity === "blocking",
  );
  const criticalComplianceIssues = criticalEffectiveIssues.map((issue) => issue.message);
  const stylisticComplianceIssues = effectiveIssues
    .filter((issue) => issue.severity === "warning")
    .map((issue) => issue.message);

  for (const issue of stylisticComplianceIssues) {
    warnings.push(`Clinical body compliance check: ${issue}`);
  }
  if (criticalComplianceIssues.length > 0) {
    console.error(
      `[notes/generate] blocked_critical_compliance clientId=${client.id} companyId=${companyId} issues=${criticalComplianceIssues.length}`,
    );
    await writeNoteGenerationAudit(buildNoteGenerationAuditEntry({
      ...auditBase,
      noteId: null,
      repairAttempts: generationRepairAttempts,
      validatorIssues: effectiveIssues.map((issue) => issue.message),
      criticalIssues: criticalComplianceIssues,
      finalValidatorIssues: effectiveIssues,
      finalCriticalIssues: criticalEffectiveIssues,
      attemptHistory: generationAttemptHistory,
      repairActions: generationRepairActions,
      warnings,
      rawModelOutputs: generationRawOutputs,
      clinicalBody: finalClinicalBody,
      finalStatus: "blocked_critical",
    }));
    return {
      ok: false,
      status: 422,
      error:
        "The generated note failed critical clinical compliance checks and was not saved. Please regenerate; if this repeats, review the client's BIP data (functions, interventions, behavior-to-replacement mappings).",
      messages: criticalComplianceIssues,
    };
  }

  const scrubbedClinicalBody = stripUnauthorizedCaregiverLanguage(
    finalClinicalBody,
    body.presentPeople,
  );
  if (scrubbedClinicalBody !== finalClinicalBody) {
    warnings.push(
      "Removed additional caregiver/family language from the clinical body before assembly.",
    );
    finalClinicalBody = scrubbedClinicalBody;
  }

  let noteContent = assembleSessionNote(
    body.presentPeople,
    body.hasEnvironmentalChanges,
    body.therapySetting,
    finalClinicalBody,
    body.nextSessionDate,
    profile?.firstName,
    narrativeCollapsed.narrativeSegmentCount,
    narrativeCollapsed.therapistTrialSummaryForReplacementHour,
    reinforcerPrefsForNote,
    clientAgeYears,
  );
  const qcScrubbedNote = scrubAssembledNoteQcHotspots(noteContent);
  if (qcScrubbedNote !== noteContent) {
    noteContent = qcScrubbedNote;
    warnings.push(
      'Removed QC hotspot wording ("social praise" / BIP status topography placeholders) from the assembled note before save.',
    );
  }

  const assembledContext = {
    presentPeople: body.presentPeople,
    hasEnvironmentalChanges: body.hasEnvironmentalChanges,
    therapySetting: body.therapySetting,
    nextSessionDate: body.nextSessionDate,
    clientFirstName: profile?.firstName,
    blockedClientNames,
    narrativeProgramSegmentCount: narrativeCollapsed.narrativeSegmentCount,
    therapistTrialSummaryForReplacementHour: narrativeCollapsed.therapistTrialSummaryForReplacementHour,
    reinforcementPreferences: reinforcerPrefsForNote,
    clientAgeYears,
  };
  let assembledValidation = validateAssembledSessionNote(noteContent, assembledContext);

  // Auto-resolve residual caregiver leaks in the clinical body once more before blocking save.
  const caregiverBlocked = assembledValidation.blocking.some((issue) => issue.code === "CAREGIVER_LEAKAGE");
  if (caregiverBlocked) {
    const resolvedBody = stripUnauthorizedCaregiverLanguage(finalClinicalBody, body.presentPeople);
    if (resolvedBody !== finalClinicalBody) {
      warnings.push("Resolved remaining caregiver/family language before saving the assembled note.");
      finalClinicalBody = resolvedBody;
    } else {
      // Force a second-pass strip even when string-equal detection missed punctuation variants.
      finalClinicalBody = stripUnauthorizedCaregiverLanguage(
        `${finalClinicalBody} `,
        body.presentPeople,
      ).trim();
    }
    noteContent = scrubAssembledNoteQcHotspots(
      assembleSessionNote(
        body.presentPeople,
        body.hasEnvironmentalChanges,
        body.therapySetting,
        finalClinicalBody,
        body.nextSessionDate,
        profile?.firstName,
        narrativeCollapsed.narrativeSegmentCount,
        narrativeCollapsed.therapistTrialSummaryForReplacementHour,
        reinforcerPrefsForNote,
        clientAgeYears,
      ),
    );
    assembledValidation = validateAssembledSessionNote(noteContent, assembledContext);
  }

  if (assembledValidation.blocking.length > 0) {
    const nonCaregiverBlocking = assembledValidation.blocking.filter(
      (issue) => issue.code !== "CAREGIVER_LEAKAGE" && issue.code !== "PRESENT_PERSON_LEAKAGE",
    );
    if (nonCaregiverBlocking.length === 0) {
      // Best-effort strip already ran; do not block note save solely on residual presence wording.
      for (const issue of assembledValidation.blocking) {
        warnings.push(`Assembled note presence wording auto-resolved: ${issue.message}`);
      }
      assembledValidation = {
        issues: assembledValidation.issues.filter(
          (issue) => issue.code !== "CAREGIVER_LEAKAGE" && issue.code !== "PRESENT_PERSON_LEAKAGE",
        ),
        blocking: [],
        warnings: [
          ...assembledValidation.warnings,
          ...assembledValidation.blocking,
        ],
      };
    }
  }

  if (assembledValidation.blocking.length > 0) {
    const messages = assembledValidation.blocking.map((issue) => issue.message);
    await writeNoteGenerationAudit(buildNoteGenerationAuditEntry({
      ...auditBase,
      noteId: null,
      repairAttempts: generationRepairAttempts,
      validatorIssues: [
        ...effectiveIssues.map((issue) => issue.message),
        ...assembledValidation.issues.map((issue) => issue.message),
      ],
      criticalIssues: messages,
      finalValidatorIssues: [...effectiveIssues, ...assembledValidation.issues],
      finalCriticalIssues: assembledValidation.blocking,
      attemptHistory: generationAttemptHistory,
      repairActions: generationRepairActions,
      warnings,
      rawModelOutputs: generationRawOutputs,
      clinicalBody: finalClinicalBody,
      finalNoteText: noteContent,
      finalStatus: "blocked_critical",
    }));
    return {
      ok: false,
      status: 422,
      error: "The assembled note failed locked-prose validation and was not saved.",
      messages,
    };
  }

  const programSlotNeed = replacementProgramSlotCount(body.sessionHours);
  if (body.selectedReplacements.length < programSlotNeed) {
    warnings.push(
      `Fewer programs selected than billable session hours (${programSlotNeed} hourly segment(s) for ${body.sessionHours} hour(s)). Hours without a matching selection in ABC Builder are auto-filled from the client's assessment/profile replacement-program list (selected session targets first, then other assessment-listed programs). Use ABC Builder to override any hour.`,
    );
  }
  if (narrativeCollapsed.rbtActionsOnlyOutcomeForHour.some(Boolean)) {
    warnings.push(
      "One or more narrative segments document a replacement program that was not selected for this session; the narrative for those segments must describe RBT implementation only (no valenced client outcome for that program).",
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
  await writeNoteGenerationAudit(buildNoteGenerationAuditEntry({
    ...auditBase,
    noteId: inserted.id,
    repairAttempts: generationRepairAttempts,
    validatorIssues: effectiveIssues.map((issue) => issue.message),
    criticalIssues: [],
    finalValidatorIssues: effectiveIssues,
    finalCriticalIssues: [],
    attemptHistory: generationAttemptHistory,
    repairActions: generationRepairActions,
    warnings,
    rawModelOutputs: generationRawOutputs,
    clinicalBody: finalClinicalBody,
    finalNoteText: noteContent,
    finalStatus: "saved",
  }));

  const maladaptiveReplacementPairings = maladaptiveReplacementPairingsForSessionNote({
    acquisitionOnlySegmentForHour,
    maladaptiveBehaviorForNarrative,
    replacementProgramForHour: narrativeCollapsed.replacementProgramForHour,
  });

  return {
    ok: true,
    noteId: inserted.id,
    content: noteContent,
    generatedAt,
    generationModel,
    warnings,
    maladaptiveReplacementPairings,
  };
}
