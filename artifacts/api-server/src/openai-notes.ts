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
  normalizeClinicalBodyParallelPastTense,
  normalizeClinicalBodySentenceInitialPronouns,
  scrubOrphanedGerundSentenceFragments,
  scrubStrayPunctuationClusters,
} from "./note-normalization";
import {
  buildFrozenSessionContext,
  groundNotePlanWithFrozenContext,
  toModelFacingSessionContext,
  validateNotePlan,
  type NotePlanIssue,
} from "./note-plan-validation";
import type { SessionContext } from "./note-plan-schema";

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

/**
 * Stable system prompt kept as message[0] so OpenAI automatic prompt caching can reuse the prefix.
 * Session-specific JSON is always placed last in the user message.
 * Scrubber-enforced rules (medication, first-then, social praise, marked play space, bare He/She,
 * punctuation clusters) are enforced server-side — do not rely on the model alone for those.
 */
const SYSTEM_PROMPT = `You draft a structured ABA NotePlan. Return JSON only.

The server-provided SessionContext is frozen and authoritative:
- Return exactly one segment for every context segment, in the same order and with the same segmentIndex.
- Copy acquisitionOnly, behaviorLabel, replacementLabel, and intervention labels exactly from context (the server already assigned and function-matched them). Never add, remove, reorder, rename, or paraphrase labels. Write teaching/prompting for the program given in that segment only.
- Use straight quotes only. Never emit escaped quotes (\\" or \\') inside string values.
- Acquisition-only segments must use an empty behaviorLabel and empty interventions array.
- Write only bounded, observable details in antecedent, topography, intervention application, response, teaching/prompting, and result fields.
- Do not use learner names, initials, caregivers/relatives, subjective/emotional language, diagnoses, inferred intent, or unsupported clinical facts. Present people belong only in the server opening sentence.
- Do not begin antecedent (or any narrative field) with the word "During". Vary openings (e.g. "The RBT presented…", "Later, the RBT arranged…").
- When behaviorTopography is present, treat it as an action bank only: paraphrase into natural session topography. Use **exactly one** concrete action per segment. Never paste BIP definition text, scoring language, "defined as," "any instance," "Status:", "To be initiated," or catalog labels alone.
- For **Task Refusal**, topography must describe observable refusal (not initiating within 10 seconds, pushing materials away)—never the appropriate activity itself.
- For **Wandering Away / elopement**, topography must be a concrete leaving-boundary action—never the BIP operational definition.
- Topography must be a COMPLETE observable action. Never truncate or end with "(e.g." / a dangling "(". Never use interpretation-only phrases without an observable action ("refusing to comply", "was noncompliant").
- Never describe a safety response (moving out of reach, blocking contact) as if it were the behavioral intervention: describe the RBT's assigned-intervention actions; safety may follow separately.
- Do NOT invent environmental details not in context (no "marked play space" / "visual boundary"). Use neutral locations ("the designated activity area", "the work table").
- Do NOT fabricate reinforcement/extinction/blocking procedures or praise schedules not supported by the assigned intervention or context.
- Reinforcers must come from reinforcementPreferences or plain "praise" only (never "social/verbal/behavior-specific praise"; never bare "preferred toys"—name the specific preference). Under age 14, never mention YouTube.
- If activityAntecedent is non-null, include that exact text in antecedent.
- Do not write opening/closing prose, headings, markdown, counts, fractions, percentages, trial totals, durations, or invented metrics. The server owns metrics and final prose.
- Each intervention application must describe what the RBT did (restate contingency, re-present demand, redirect, arrange materials)—not only a thin contingency phrase. For Physical Aggression / Property Destruction after Premack/demand interventions, include restating/re-presenting the demand (and for Property Destruction, redirecting to retrieve the item).
- For Premack, describe demand-before-reinforcer in plain prose only (never "first-then" labels).
- Teaching/prompting and topography clauses must be gerund phrases suitable after "by" — do not start those fields with "the RBT" or "the client".
- For every non-acquisition segment, responseToIntervention must begin with "The client" and state at least one observable client action; RBT actions alone are not an outcome. resultSummary must also remain observable and add NEW detail beyond responseToIntervention (not a near-copy).
- For DRA/DRI, the application must name the specific alternative/incompatible behavior being reinforced.
- Write like an experienced RBT documenting from memory: elaborate client actions with fresh wording; avoid boilerplate that every hour ends "returned to the task."
- Server will rewrite medication references, first-then labels, social-praise compounds, invented environment phrases, stray punctuation, and sentence-initial He/She — still avoid emitting them.
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
            segmentIndex: {
              type: "integer",
              minimum: 0,
              description:
                "Zero-based index of the context segment; return one segment per context segment in the same order.",
            },
            acquisitionOnly: {
              type: "boolean",
              description:
                "Copy from context. When true, this is a skill-acquisition segment: behaviorLabel must be empty and interventions must be an empty array.",
            },
            behaviorLabel: {
              type: "string",
              description:
                "Exact maladaptive behavior label from context for this segment (empty string for acquisition-only segments). Never rename or paraphrase.",
            },
            antecedent: {
              type: "string",
              minLength: 1,
              description:
                "One concise observable setup/context sentence. Do not begin with 'During'; vary openings. If activityAntecedent is provided, include that exact text.",
            },
                topography: {
                    type: "string",
                    minLength: 1,
                    description:
                      "Exactly ONE concrete observable maladaptive action the client did this hour (e.g. 'making open-hand contact with the RBT's arm', 'not initiating the handwashing routine within 10 seconds', 'walking toward the hallway without permission'). Never paste BIP definitions, scoring text, 'Status:', or the bare behavior label. For Task Refusal never name the appropriate activity itself.",
                  },
                  interventions: {
                    type: "array",
                    description:
                      "The exact assigned intervention(s) for this segment, copied verbatim from context. Do not add, drop, or reorder. Empty for acquisition-only segments.",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: ["label", "application"],
                      properties: {
                        label: {
                          type: "string",
                          minLength: 1,
                          description: "Exact intervention label from context (verbatim, no paraphrase).",
                        },
                        application: {
                          type: "string",
                          minLength: 1,
                          description:
                            "Gerund phrase describing what the RBT did to apply this intervention (restate contingency, re-present demand, redirect, block, arrange). For Premack include demand-before-reinforcer detail; never write 'first-then'. For Physical Aggression / Property Destruction, include restating/re-presenting the demand (and retrieving redirected materials when relevant).",
                        },
                      },
                    },
                  },
            responseToIntervention: {
              type: "string",
              minLength: 1,
              description:
                "Must begin with 'The client' and state at least one observable client action after the intervention, in fresh wording that elaborates rather than echoing the antecedent/topography phrasing. RBT actions alone are not an outcome. No subjective/emotional words, no metrics.",
            },
            replacementLabel: {
              type: "string",
              minLength: 1,
              description:
                "Exact replacement program label from context for this segment, verbatim. Each ABC should use a distinct replacement program where the context provides distinct ones.",
            },
            teachingOrPromptingSummary: {
              type: "string",
              minLength: 1,
              description:
                "Gerund phrase (suitable after 'by') describing how the replacement program was taught/prompted this hour. Do not start with 'the RBT' or 'the client'.",
            },
            resultSummary: {
              type: "string",
              minLength: 1,
              description:
                "One observable closing result for this segment that adds new detail beyond responseToIntervention (a different concrete action, completion, or re-engagement) — not a near-copy of it or of the topography. No mastery/progress claims beyond supplied facts, no invented metrics, no subjective language.",
            },
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
  /** Model that actually produced this output (may differ from the primary when fallback engaged). */
  model?: string | undefined;
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

export const CLINICAL_BODY_PROMPT_VERSION = "2026-07-19.opt-compact-label-lock-v1";
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
  /** Model that produced this attempt (records fallback engagement). */
  model?: string | null;
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
  /** Model that produced the final (passed or best-effort) attempt; reflects fallback engagement. */
  modelUsed: string | null;
};

function isGpt5FamilyNoteModel(modelId: string): boolean {
  return modelId.toLowerCase().includes("gpt-5");
}

/**
 * Reasoning effort for the gpt-5 family (env `OPENAI_REASONING_EFFORT`, default `medium`). `medium`
 * measurably improves label fidelity and observable-outcome quality on this bounded JSON task; async
 * jobs carry a larger time budget so the extra latency is absorbed. Set `OPENAI_REASONING_EFFORT=low`
 * to prioritize latency. `none`/`off`/`default` omit the parameter (falls back to the model default).
 */
function resolveReasoningEffort(): "low" | "medium" | "high" | null {
  const raw = process.env.OPENAI_REASONING_EFFORT?.trim().toLowerCase();
  if (raw === undefined || raw === "") return "medium";
  if (raw === "low" || raw === "medium" || raw === "high") return raw;
  return null;
}

/**
 * Faster/cheaper model used only when the primary times out or errors (env `OPENAI_FALLBACK_MODEL`,
 * default `gpt-4.1`). Set to `none`/`off`/`disabled` to turn fallback off.
 */
export function resolvedFallbackOpenAIModel(): string | null {
  const raw = process.env.OPENAI_FALLBACK_MODEL?.trim();
  if (raw === undefined) return "gpt-4.1";
  if (raw === "" || /^(?:none|off|disabled)$/i.test(raw)) return null;
  return raw;
}

/** gpt-5 reasoning output needs headroom (reasoning tokens count); non-reasoning JSON is compact. */
const GPT5_MAX_COMPLETION_TOKENS = 8000;
const FALLBACK_MAX_TOKENS = 4000;

/** A 400 that names an unsupported sampling/reasoning parameter → safe to retry without those params. */
function isUnsupportedParamError(error: unknown): boolean {
  if (error instanceof OpenAI.APIError && error.status === 400) {
    const msg = (error.message ?? "").toLowerCase();
    return /reasoning_effort|temperature|unsupported|unrecognized|not supported|invalid.*param/.test(
      msg,
    );
  }
  return false;
}

/** Transient failures (timeout, connection, 429, 5xx, empty content) are eligible for model fallback. */
function isFallbackEligibleError(error: unknown): boolean {
  if (error instanceof OpenAI.APIConnectionTimeoutError) return true;
  if (error instanceof OpenAI.APIConnectionError) return true;
  if (error instanceof OpenAI.APIError) {
    const status = error.status ?? 0;
    return status === 429 || status >= 500;
  }
  if (error instanceof Error && /timed out|timeout|empty message content/i.test(error.message)) {
    return true;
  }
  return false;
}

/**
 * One tuned chat completion. gpt-5 family gets `reasoning_effort` (latency) + a completion-token cap;
 * non-reasoning fallback models get `temperature: 0.2` (determinism) + a token cap. If the API rejects
 * the tuned params, retry once with only the required base params so tuning can never break generation.
 */
async function createTunedChatCompletion(
  client: OpenAI,
  model: string,
  messages: ChatCompletionMessageParam[],
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const base = {
    model,
    messages,
    response_format: { type: "json_schema" as const, json_schema: NOTE_PLAN_JSON_SCHEMA },
  };
  const isGpt5 = isGpt5FamilyNoteModel(model);
  const baseWithCap = isGpt5
    ? { ...base, max_completion_tokens: GPT5_MAX_COMPLETION_TOKENS }
    : { ...base, max_tokens: FALLBACK_MAX_TOKENS };
  const reasoningEffort = resolveReasoningEffort();
  const tuned = isGpt5
    ? { ...baseWithCap, ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}) }
    : { ...baseWithCap, temperature: 0.2 };
  try {
    return await client.chat.completions.create(tuned);
  } catch (error) {
    if (isUnsupportedParamError(error)) {
      return await client.chat.completions.create(baseWithCap);
    }
    throw error;
  }
}

/**
 * Build the production model call. Bounds each completion with a per-request timeout so one hung call
 * cannot consume the whole budget, and (when configured) retries a transient failure once on the
 * fallback model before rethrowing. Records which model produced the output for telemetry/audit.
 */
export function createDefaultModelCall(config?: {
  requestTimeoutMs?: number | undefined;
  primaryModel?: string | undefined;
  fallbackModel?: string | null | undefined;
}): NotePlanModelCall {
  return async ({ messages }) => {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
    const primaryModel = config?.primaryModel ?? resolvedOpenAIModel();
    const fallbackModel =
      config?.fallbackModel === undefined ? resolvedFallbackOpenAIModel() : config.fallbackModel;
    const client = new OpenAI({
      apiKey,
      timeout: config?.requestTimeoutMs ?? resolveOpenAIRequestTimeoutMs(),
      maxRetries: 1,
    });

    const attemptOnModel = async (model: string) => {
      const completion = await createTunedChatCompletion(client, model, messages);
      const text = completion.choices[0]?.message?.content?.trim();
      if (!text) throw new Error("OpenAI returned empty message content");
      return { completion, text, model };
    };

    let result: { completion: OpenAI.Chat.Completions.ChatCompletion; text: string; model: string };
    try {
      result = await attemptOnModel(primaryModel);
    } catch (primaryError) {
      if (
        fallbackModel &&
        fallbackModel !== primaryModel &&
        isFallbackEligibleError(primaryError)
      ) {
        result = await attemptOnModel(fallbackModel);
      } else {
        throw primaryError;
      }
    }

    return {
      output: result.text,
      model: result.model,
      completionId: result.completion.id,
      usage: result.completion.usage
        ? {
            promptTokens: result.completion.usage.prompt_tokens,
            completionTokens: result.completion.usage.completion_tokens,
            totalTokens: result.completion.usage.total_tokens,
          }
        : undefined,
    };
  };
}

const defaultModelCall: NotePlanModelCall = createDefaultModelCall();

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
    reinforcementPreferences: ctx.reinforcementPreferences,
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

/** Per-request OpenAI timeout (ms). Keeps a single hung completion from consuming the whole budget. */
function resolveOpenAIRequestTimeoutMs(): number {
  const raw = Number(process.env.OPENAI_REQUEST_TIMEOUT_MS ?? "");
  return Number.isFinite(raw) && raw >= 5_000 ? Math.floor(raw) : 60_000;
}

/**
 * Overall wall-clock budget for the generate + repair loop (ms). The synchronous `POST /notes/generate`
 * endpoint sits behind Cloudflare, which returns a raw HTML **524** if the origin takes longer than
 * ~100s. When repairs cannot converge, stop issuing further model calls once this budget is spent and
 * return the current best-effort result so the client receives a clean JSON compliance error (which it
 * can surface and retry) instead of an opaque 524. Additional calls only resume when there is enough
 * budget left for another bounded call.
 */
function resolveNoteGenerationTimeBudgetMs(): number {
  const raw = Number(process.env.NOTE_GENERATION_TIME_BUDGET_MS ?? "");
  return Number.isFinite(raw) && raw >= 15_000 ? Math.floor(raw) : 80_000;
}

/**
 * Background (async job) generation runs behind the job poller (up to ~20 min), not Cloudflare, so it
 * gets a larger per-request timeout and overall budget to let repairs converge into a more compliant
 * note. Configurable via env; safe defaults of 180s per call / 240s overall.
 */
export function resolveBackgroundOpenAIRequestTimeoutMs(): number {
  const raw = Number(process.env.OPENAI_BACKGROUND_REQUEST_TIMEOUT_MS ?? "");
  return Number.isFinite(raw) && raw >= 5_000 ? Math.floor(raw) : 180_000;
}

export function resolveBackgroundNoteGenerationTimeBudgetMs(): number {
  const raw = Number(process.env.NOTE_GENERATION_BACKGROUND_TIME_BUDGET_MS ?? "");
  return Number.isFinite(raw) && raw >= 15_000 ? Math.floor(raw) : 240_000;
}

/**
 * Build a compact repair user message: only failing segments (+ their frozen locks) when possible,
 * so repairs do not re-pay the full session context every attempt. Still asks for a complete NotePlan
 * so merge/validate stays simple.
 */
export function buildScopedRepairUserMessage(params: {
  frozen: SessionContext;
  planIssues: NotePlanIssue[];
  priorRaw: string;
  priorPlan: NotePlan | null;
}): string {
  const failingIndexes = [
    ...new Set(
      params.planIssues
        .map((issue) => issue.segmentIndex)
        .filter((idx): idx is number => typeof idx === "number" && idx >= 0),
    ),
  ].sort((a, b) => a - b);

  const modelFacing = toModelFacingSessionContext(params.frozen);
  const scopedContext =
    failingIndexes.length > 0 && failingIndexes.length < params.frozen.segments.length
      ? {
          ...modelFacing,
          segments: (modelFacing.segments as unknown[]).filter((seg) => {
            const index = (seg as { segmentIndex?: number }).segmentIndex;
            return typeof index === "number" && failingIndexes.includes(index);
          }),
          assessmentGrounding: (
            modelFacing.assessmentGrounding as { segmentIndex?: number }[]
          ).filter(
            (seg) => typeof seg.segmentIndex === "number" && failingIndexes.includes(seg.segmentIndex),
          ),
          repairFocusSegmentIndexes: failingIndexes,
        }
      : modelFacing;

  let priorSegmentJson: unknown = params.priorRaw;
  if (params.priorPlan && failingIndexes.length > 0) {
    priorSegmentJson = {
      segments: params.priorPlan.segments.filter((s) => failingIndexes.includes(s.segmentIndex)),
    };
  } else if (params.priorPlan) {
    priorSegmentJson = params.priorPlan;
  }

  return `Correct only the invalid JSON fields. Return the complete corrected NotePlan as JSON only (all segments, in order).

Structured violations:
${JSON.stringify(params.planIssues)}

Frozen SessionContext (authoritative; never change assignments; scoped to failing segments when listed):
${JSON.stringify(scopedContext)}

Prior model JSON/output (scoped when possible):
${typeof priorSegmentJson === "string" ? priorSegmentJson : JSON.stringify(priorSegmentJson)}`;
}

export async function generateClinicalBodyOpenAI(
  ctx: NoteGenerationContext,
  validationOptions?: {
    blockedClientNames?: string[] | undefined;
    modelCall?: NotePlanModelCall | undefined;
    /** Larger per-request timeout for background jobs (sync endpoint keeps the conservative default). */
    requestTimeoutMs?: number | undefined;
    /** Larger overall generate+repair budget for background jobs (sync endpoint stays under Cloudflare). */
    timeBudgetMs?: number | undefined;
    /** Explicit fallback model override; `null` disables fallback. Falls back to env when undefined. */
    fallbackModel?: string | null | undefined;
  },
): Promise<GenerateClinicalBodyResult> {
  const frozen = buildFrozenSessionContext(ctx, {
    blockedClientNames: validationOptions?.blockedClientNames,
  });
  const modelCall =
    validationOptions?.modelCall ??
    createDefaultModelCall({
      requestTimeoutMs: validationOptions?.requestTimeoutMs,
      fallbackModel: validationOptions?.fallbackModel,
    });
  const rawModelOutputs: string[] = [];
  const warnings: string[] = [];
  const attemptHistory: NoteGenerationAttemptTelemetry[] = [];
  const repairActions: string[] = [];
  const generationStartedAt = Date.now();
  const timeBudgetMs = validationOptions?.timeBudgetMs ?? resolveNoteGenerationTimeBudgetMs();
  let lastModelUsed: string | null = null;

  const callModel = async (
    params: Parameters<NotePlanModelCall>[0],
  ): Promise<{ raw: string; telemetry: NoteGenerationAttemptTelemetry }> => {
    const started = Date.now();
    try {
      const result = await modelCall(params);
      const normalized = typeof result === "string" ? { output: result } : result;
      lastModelUsed = normalized.model ?? lastModelUsed;
      return {
        raw: normalized.output,
        telemetry: {
          attempt: params.attempt,
          latencyMs: Math.max(0, Date.now() - started),
          completionId: normalized.completionId ?? null,
          usage: normalized.usage ?? null,
          model: normalized.model ?? null,
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
        model: null,
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

  const modelFacing = toModelFacingSessionContext(frozen);
  const initialUser = `Frozen SessionContext JSON:\n${JSON.stringify(modelFacing)}\n\nReturn the NotePlan JSON now.`;
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
            presentPeople: ctx.presentPeople,
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
    // Soft-fail: always assemble from a schema-valid grounded plan so trial % / locked labels ship
    // even when soft field issues remain. Previously soft plan issues left body="" and the service
    // fell back to a thin template that omitted percentages and used vague topography.
    if (plan) {
      body = assembleClinicalBodyFromNotePlan(plan, frozen);
      body = scrubOrphanedGerundSentenceFragments(
        normalizeClinicalBodyParallelPastTense(
          normalizeClinicalBodySentenceInitialPronouns(scrubStrayPunctuationClusters(body)),
        ),
      );
      if (planIssues.length === 0) {
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
    }
    currentTelemetry.planIssues = structuredIssuesForAttempt;
    currentTelemetry.proseIssues = [...finalProseIssues];
    currentTelemetry.passed =
      structuredIssuesForAttempt.length === 0 && blockingProseIssues.length === 0;
    attemptHistory.push(currentTelemetry);
    if (currentTelemetry.passed) break;

    // Stop issuing further model calls when we are out of repair attempts OR when there is not enough
    // wall-clock budget left for another bounded call. The latter keeps the synchronous endpoint from
    // exceeding Cloudflare's ~100s origin timeout (raw 524); the client instead gets a clean JSON error.
    const elapsedMs = Date.now() - generationStartedAt;
    const observedMaxLatencyMs = attemptHistory.reduce((max, a) => Math.max(max, a.latencyMs), 0);
    const estimatedNextCallMs = observedMaxLatencyMs > 0 ? observedMaxLatencyMs : 30_000;
    const outOfTimeBudget = elapsedMs + estimatedNextCallMs >= timeBudgetMs;
    if (repairAttempts >= MAX_NOTE_PLAN_REPAIR_ATTEMPTS || outOfTimeBudget) {
      warnings.push(
        outOfTimeBudget
          ? `Stopped after ${repairAttempts} repair attempt(s): note generation time budget (${timeBudgetMs}ms) reached before compliance converged.`
          : blockingProseIssues.length > 0
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
        modelUsed: lastModelUsed,
      };
    }

    repairAttempts += 1;
    repairActions.push(
      `${blockingProseIssues.length > 0 ? "prose" : "plan"}_json_repair_attempt_${repairAttempts}`,
    );
    warnings.push(
      `${blockingProseIssues.length > 0 ? "Assembled clinical body compliance validation" : "Structured NotePlan validation"} failed; attempting JSON-only repair (${repairAttempts}/${MAX_NOTE_PLAN_REPAIR_ATTEMPTS}).`,
    );
    const repairUser = buildScopedRepairUserMessage({
      frozen,
      planIssues,
      priorRaw: raw,
      priorPlan: plan,
    });
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
    modelUsed: lastModelUsed,
  };
}

export function openaiNoteGenerationLabel(): string {
  return `openai:${resolvedOpenAIModel()}:structured-note-plan`;
}
