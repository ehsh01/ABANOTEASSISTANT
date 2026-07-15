/**
 * Structured OpenAI note planning.
 *
 * The model drafts bounded JSON fields only. The server freezes assignments, validates the
 * NotePlan, repairs JSON only, deterministically assembles the clinical body, and then runs the
 * existing prose validator as defense-in-depth.
 */
import { createHash } from "node:crypto";
import type { ClinicalFunction, MaladaptiveBehaviorProfileEntry } from "@workspace/db/schema";
import type { TherapySetting } from "@workspace/therapy-settings";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {
  validateClinicalBodyComplianceDetailed,
  type NoteComplianceContext,
  type NoteValidationIssue,
} from "./note-validation";
import { assembleClinicalBodyFromNotePlan } from "./note-plan-assembly";
import { NotePlanSchema, type NotePlan } from "./note-plan-schema";
import {
  buildFrozenSessionContext,
  groundNotePlanWithFrozenContext,
  validateNotePlan,
  type NotePlanIssue,
} from "./note-plan-validation";

export const DEFAULT_OPENAI_NOTE_MODEL = "gpt-5.5";

/** Existing caller input retained as the runtime SessionContext source. */
export type NoteGenerationContext = {
  clientName: string;
  firstName: string;
  gender: string | null | undefined;
  sessionHours: number;
  narrativeSegmentCount: number;
  sessionDate: string;
  therapySetting: TherapySetting;
  presentPeople: string[];
  hasEnvironmentalChanges: boolean;
  environmentalChanges: string;
  maladaptiveBehaviors: string[];
  maladaptiveBehaviorTargets: MaladaptiveBehaviorProfileEntry[];
  maladaptiveBehaviorForHour: string[];
  interventions: string[];
  replacementProgramsInOrder: string[];
  replacementProgramForHour: string[];
  rbtActionsOnlyOutcomeForHour: boolean[];
  requestNonce: string;
  clientAgeYears: number | null;
  ageBand: string | null | undefined;
  clientAssessmentTextExcerpt: string;
  assessmentReferenceFileName: string | null;
  reinforcementPreferences: string[];
  activityAntecedentForHour: (string | null)[];
  languageMaladaptiveEpisodeForHour: boolean[];
  therapistTrialSummaryForReplacementHour: ({
    totalTrials: number;
    successfulTrialNumbers: number[];
  } | null)[];
  acquisitionOnlySegmentForHour: boolean[];
  maladaptiveBehaviorFunctionsForHour: (ClinicalFunction[] | null)[];
  maladaptiveBehaviorTopographyForHour: (string | null)[];
  behaviorReplacementCandidatesForHour: string[][];
  interventionCandidatesForHour: string[][];
  behaviorToReplacementsMap?: Record<string, string[]> | undefined;
};

const SYSTEM_PROMPT = `You draft a structured ABA NotePlan. Return JSON only.

The server-provided SessionContext is frozen and authoritative:
- Return exactly one segment for every context segment, in the same order and with the same segmentIndex.
- Copy acquisitionOnly, behaviorLabel, replacementLabel, and intervention labels exactly. Never add, remove, reorder, rename, or paraphrase labels.
- Acquisition-only segments must use an empty behaviorLabel and empty interventions array.
- Write only bounded, observable details in antecedent, topography, intervention application, response, teaching/prompting, and result fields.
- Do not use learner names, initials, caregivers, parents, guardians, subjective/emotional language, diagnoses, inferred intent, or unsupported clinical facts.
- When behaviorTopography is present, treat it as an assessment action bank only: paraphrase those observable actions into natural session-episode topography (what the client did in this hour). Never paste BIP/VIP/assessment definition text, scoring language, "defined as," "any instance," or catalog labels alone. Never return only the behavior label or a generic phrase such as "motor behavior" or "elopement."
- Keep all narrative fields sounding like a written session note: concise, concrete client/RBT actions—not copied plan language.
- If activityAntecedent is non-null, include that exact text in antecedent.
- Do not write prose opening/closing text, headings, markdown, counts, fractions, percentages, trial totals, durations, or invented metrics. The server owns all metrics and final prose.
- Each intervention application describes only how the exact assigned intervention was applied.
- For every non-acquisition segment, responseToIntervention must begin with "The client" and state at least one observable client action after intervention; RBT actions alone are not an outcome. resultSummary must also remain observable. Do not claim mastery or progress beyond supplied facts.
- The output shape is {"segments":[{"segmentIndex":0,"acquisitionOnly":false,"behaviorLabel":"...","antecedent":"...","topography":"...","interventions":[{"label":"...","application":"..."}],"responseToIntervention":"...","replacementLabel":"...","teachingOrPromptingSummary":"...","resultSummary":"..."}]}.`;

const NOTE_PLAN_JSON_SCHEMA = {
  name: "aba_note_plan",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["segments"],
    properties: {
      segments: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "segmentIndex",
            "acquisitionOnly",
            "behaviorLabel",
            "antecedent",
            "topography",
            "interventions",
            "responseToIntervention",
            "replacementLabel",
            "teachingOrPromptingSummary",
            "resultSummary",
          ],
          properties: {
            segmentIndex: { type: "integer", minimum: 0 },
            acquisitionOnly: { type: "boolean" },
            behaviorLabel: { type: "string" },
            antecedent: { type: "string", minLength: 1 },
            topography: { type: "string", minLength: 1 },
            interventions: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["label", "application"],
                properties: {
                  label: { type: "string", minLength: 1 },
                  application: { type: "string", minLength: 1 },
                },
              },
            },
            responseToIntervention: { type: "string", minLength: 1 },
            replacementLabel: { type: "string", minLength: 1 },
            teachingOrPromptingSummary: { type: "string", minLength: 1 },
            resultSummary: { type: "string", minLength: 1 },
          },
        },
      },
    },
  },
} as const;

export type NoteModelUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type NotePlanModelCallOutput = {
  output: string;
  completionId?: string | undefined;
  usage?: NoteModelUsage | undefined;
};

/** String return remains supported for existing tests/custom adapters. */
export type NotePlanModelCall = (params: {
  messages: ChatCompletionMessageParam[];
  attempt: number;
}) => Promise<string | NotePlanModelCallOutput>;

export function resolvedOpenAIModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_NOTE_MODEL;
}

export function isOpenAINoteGenerationConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export const CLINICAL_BODY_PROMPT_VERSION = "2026-07-14.phase4-grounded-v2";
export const CLINICAL_BODY_PROMPT_HASH = createHash("sha256")
  .update(SYSTEM_PROMPT)
  .update("\u0000")
  .update(JSON.stringify(NOTE_PLAN_JSON_SCHEMA))
  .digest("hex");

export type NoteGenerationAttemptTelemetry = {
  attempt: number;
  latencyMs: number;
  completionId: string | null;
  usage: NoteModelUsage | null;
  planIssues: NotePlanIssue[];
  proseIssues: NoteValidationIssue[];
  passed: boolean;
};

export type GenerateClinicalBodyResult = {
  body: string;
  warnings: string[];
  repairAttempts: number;
  finalIssues: NoteValidationIssue[];
  /** Internal Phase 4 audit metadata; not exposed through the HTTP response. */
  notePlan: NotePlan | null;
  rawModelOutputs: string[];
  planIssues: NotePlanIssue[];
  attemptHistory: NoteGenerationAttemptTelemetry[];
  repairActions: string[];
};

function isGpt5FamilyNoteModel(modelId: string): boolean {
  return modelId.toLowerCase().includes("gpt-5");
}

const defaultModelCall: NotePlanModelCall = async ({ messages }) => {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  const model = resolvedOpenAIModel();
  const client = new OpenAI({ apiKey });
  const common = {
    model,
    messages,
    response_format: { type: "json_schema" as const, json_schema: NOTE_PLAN_JSON_SCHEMA },
  };
  const completion = isGpt5FamilyNoteModel(model)
    ? await client.chat.completions.create({ ...common, max_completion_tokens: 12000 })
    : await client.chat.completions.create({ ...common, max_tokens: 12000 });
  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI returned empty message content");
  return {
    output: text,
    completionId: completion.id,
    usage: completion.usage
      ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        }
      : undefined,
  };
};

function toComplianceCtx(
  ctx: NoteGenerationContext,
  blockedClientNames?: string[],
): NoteComplianceContext {
  return {
    sessionHours: ctx.sessionHours,
    therapySetting: ctx.therapySetting,
    narrativeSegmentCount: ctx.narrativeSegmentCount,
    replacementProgramsInOrder: ctx.replacementProgramsInOrder,
    replacementProgramForHour: ctx.replacementProgramForHour,
    rbtActionsOnlyOutcomeForHour: ctx.rbtActionsOnlyOutcomeForHour,
    maladaptiveBehaviors: ctx.maladaptiveBehaviors,
    maladaptiveBehaviorForHour: ctx.maladaptiveBehaviorForHour,
    activityAntecedentForHour: ctx.activityAntecedentForHour,
    languageMaladaptiveEpisodeForHour: ctx.languageMaladaptiveEpisodeForHour,
    interventions: ctx.interventions,
    therapistTrialSummaryForReplacementHour: ctx.therapistTrialSummaryForReplacementHour,
    clientAgeYears: ctx.clientAgeYears,
    presentPeople: ctx.presentPeople,
    acquisitionOnlySegmentForHour: ctx.acquisitionOnlySegmentForHour,
    maladaptiveBehaviorFunctionsForHour: ctx.maladaptiveBehaviorFunctionsForHour,
    maladaptiveBehaviorTopographyForHour: ctx.maladaptiveBehaviorTopographyForHour,
    behaviorToReplacementsMap: ctx.behaviorToReplacementsMap,
    blockedClientNames,
  };
}

function parseJson(raw: string): { value: unknown; issue: NotePlanIssue | null } {
  try {
    return { value: JSON.parse(raw), issue: null };
  } catch (error) {
    return {
      value: null,
      issue: {
        code: "SCHEMA_INVALID",
        message: `Model output was not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }
}

function mapPlanIssuesToCompatibilityIssues(issues: NotePlanIssue[]): NoteValidationIssue[] {
  return issues.map((issue) => ({
    code:
      issue.code === "BEHAVIOR_ASSIGNMENT" || issue.code === "ACQUISITION_ONLY"
        ? "BEHAVIOR_ASSIGNMENT"
        : issue.code === "PROGRAM_ASSIGNMENT"
          ? "PROGRAM_ASSIGNMENT"
          : issue.code === "INTERVENTION_ASSIGNMENT" || issue.code === "CATALOG_MEMBERSHIP"
            ? "INTERVENTION_CATALOG"
            : issue.code === "CLIENT_NAME_LEAKAGE"
              ? "CLIENT_NAME_LEAKAGE"
              : issue.code === "CAREGIVER_LEAKAGE"
                ? "CAREGIVER_LEAKAGE"
                : issue.code === "TOPOGRAPHY_REQUIRED" ||
                    issue.code === "TOPOGRAPHY_ASSESSMENT_MISMATCH"
                  ? "BEHAVIOR_TOPOGRAPHY"
                  : issue.code === "FABRICATED_METRIC"
                    ? "TRIAL_DATA"
                    : issue.code === "POST_INTERVENTION_OUTCOME"
                      ? "POST_INTERVENTION_OUTCOME"
                    : issue.code === "SUBJECTIVE_LANGUAGE"
                      ? "LANGUAGE_OBJECTIVITY"
                      : "PARAGRAPH_COUNT",
    severity: "blocking",
    message: `[${issue.code}] ${issue.message}`,
    paragraphIndex: issue.segmentIndex,
  }));
}

const MAX_NOTE_PLAN_REPAIR_ATTEMPTS = 4;

export async function generateClinicalBodyOpenAI(
  ctx: NoteGenerationContext,
  validationOptions?: {
    blockedClientNames?: string[] | undefined;
    modelCall?: NotePlanModelCall | undefined;
  },
): Promise<GenerateClinicalBodyResult> {
  const frozen = buildFrozenSessionContext(ctx, {
    blockedClientNames: validationOptions?.blockedClientNames,
  });
  const modelCall = validationOptions?.modelCall ?? defaultModelCall;
  const rawModelOutputs: string[] = [];
  const warnings: string[] = [];
  const attemptHistory: NoteGenerationAttemptTelemetry[] = [];
  const repairActions: string[] = [];

  const callModel = async (
    params: Parameters<NotePlanModelCall>[0],
  ): Promise<{ raw: string; telemetry: NoteGenerationAttemptTelemetry }> => {
    const started = Date.now();
    try {
      const result = await modelCall(params);
      const normalized = typeof result === "string" ? { output: result } : result;
      return {
        raw: normalized.output,
        telemetry: {
          attempt: params.attempt,
          latencyMs: Math.max(0, Date.now() - started),
          completionId: normalized.completionId ?? null,
          usage: normalized.usage ?? null,
          planIssues: [],
          proseIssues: [],
          passed: false,
        },
      };
    } catch (error) {
      const telemetry: NoteGenerationAttemptTelemetry = {
        attempt: params.attempt,
        latencyMs: Math.max(0, Date.now() - started),
        completionId: null,
        usage: null,
        planIssues: [],
        proseIssues: [],
        passed: false,
      };
      attemptHistory.push(telemetry);
      if (error && typeof error === "object") {
        Object.assign(error, {
          noteGenerationAttemptHistory: [...attemptHistory],
          noteGenerationRawModelOutputs: [...rawModelOutputs],
          noteGenerationRepairActions: [...repairActions],
        });
      }
      throw error;
    }
  };

  const initialUser = `Frozen SessionContext JSON:\n${JSON.stringify(frozen, null, 2)}\n\nReturn the NotePlan JSON now.`;
  let modelResponse = await callModel({
    attempt: 0,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: initialUser },
    ],
  });
  let raw = modelResponse.raw;
  let currentTelemetry = modelResponse.telemetry;
  rawModelOutputs.push(raw);

  let repairAttempts = 0;
  let plan: NotePlan | null = null;
  let planIssues: NotePlanIssue[] = [];
  let body = "";
  let finalProseIssues: NoteValidationIssue[] = [];
  let blockingProseIssues: NoteValidationIssue[] = [];

  while (true) {
    const parsed = parseJson(raw);
    if (parsed.issue) {
      plan = null;
      planIssues = [parsed.issue];
    } else {
      const parsedPlan = NotePlanSchema.safeParse(parsed.value);
      const groundedCandidate = parsedPlan.success
        ? groundNotePlanWithFrozenContext(parsedPlan.data, frozen, {
            blockedClientNames: validationOptions?.blockedClientNames,
          })
        : parsed.value;
      const result = validateNotePlan(groundedCandidate, frozen, {
        blockedClientNames: validationOptions?.blockedClientNames,
        presentPeople: ctx.presentPeople,
      });
      plan = result.plan;
      planIssues = result.issues;
    }
    const structuredIssuesForAttempt = [...planIssues];

    body = "";
    finalProseIssues = [];
    blockingProseIssues = [];
    if (plan && planIssues.length === 0) {
      body = assembleClinicalBodyFromNotePlan(plan, frozen);
      const proseValidation = validateClinicalBodyComplianceDetailed(
        body,
        toComplianceCtx(ctx, validationOptions?.blockedClientNames),
      );
      finalProseIssues = proseValidation.issues;
      blockingProseIssues = proseValidation.blocking;
      if (blockingProseIssues.length > 0) {
        planIssues = blockingProseIssues.map((issue) => ({
          code: `PROSE_${issue.code}`,
          message: issue.message,
          segmentIndex: issue.paragraphIndex,
        }));
      }
    }
    currentTelemetry.planIssues = structuredIssuesForAttempt;
    currentTelemetry.proseIssues = [...finalProseIssues];
    currentTelemetry.passed = planIssues.length === 0 && blockingProseIssues.length === 0;
    attemptHistory.push(currentTelemetry);
    if (currentTelemetry.passed) break;

    if (repairAttempts >= MAX_NOTE_PLAN_REPAIR_ATTEMPTS) {
      warnings.push(
        blockingProseIssues.length > 0
          ? "Deterministically assembled clinical body remained noncompliant after bounded JSON repair."
          : "Structured NotePlan remained invalid after bounded JSON repair.",
      );
      return {
        body,
        warnings,
        repairAttempts,
        finalIssues:
          blockingProseIssues.length > 0
            ? blockingProseIssues
            : mapPlanIssuesToCompatibilityIssues(planIssues),
        notePlan: plan,
        rawModelOutputs,
        planIssues,
        attemptHistory,
        repairActions,
      };
    }

    repairAttempts += 1;
    repairActions.push(
      `${blockingProseIssues.length > 0 ? "prose" : "plan"}_json_repair_attempt_${repairAttempts}`,
    );
    warnings.push(
      `${blockingProseIssues.length > 0 ? "Assembled clinical body compliance validation" : "Structured NotePlan validation"} failed; attempting JSON-only repair (${repairAttempts}/${MAX_NOTE_PLAN_REPAIR_ATTEMPTS}).`,
    );
    const repairUser = `Correct only the invalid JSON fields. Return the complete corrected NotePlan as JSON only.

Structured violations:
${JSON.stringify(planIssues, null, 2)}

Frozen SessionContext (authoritative; never change assignments):
${JSON.stringify(frozen, null, 2)}

Prior model JSON/output:
${raw}`;
    modelResponse = await callModel({
      attempt: repairAttempts,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: repairUser },
      ],
    });
    raw = modelResponse.raw;
    currentTelemetry = modelResponse.telemetry;
    rawModelOutputs.push(raw);
  }

  return {
    body,
    warnings,
    repairAttempts,
    finalIssues: finalProseIssues,
    notePlan: plan,
    rawModelOutputs,
    planIssues: [],
    attemptHistory,
    repairActions,
  };
}

export function openaiNoteGenerationLabel(): string {
  return `openai:${resolvedOpenAIModel()}:structured-note-plan`;
}
