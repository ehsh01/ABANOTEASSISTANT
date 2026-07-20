import { createHash } from "node:crypto";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { assembleClinicalBodyFromNotePlan } from "./note-plan-assembly";
import type { NotePlan, SessionContext } from "./note-plan-schema";
import {
  buildFrozenSessionContext,
  parseAndValidateNotePlan,
  type NotePlanIssue,
} from "./note-plan-validation";

export const DEFAULT_OPENAI_NOTE_MODEL = "gpt-4.1";
export type NoteGenerationContext = SessionContext;

const SYSTEM_PROMPT = `You write flexible ABA session-note ABC paragraphs. Return JSON only.

Output {"segments":[{"segmentIndex":0,"paragraph":"..."}]} with exactly one segment per hourlyAssignments row.

For each hour:
- Write one cohesive, natural paragraph in past tense.
- Use the exact programName and exact criterionPercentage from that hour. State the percentage with a % sign.
- Never use a program from another hour and never rename the locked program.
- Use activityHint and behaviorHint when supplied. Otherwise choose a concrete activity and observable behavior supported by profileBehaviors and assessmentExcerpt.
- Choose one or more interventions supported by profileInterventions or assessmentExcerpt and explain naturally how the RBT applied them.
- Follow the style sequence shown in the examples: concrete material/demand; observable behavior; intervention application; observable response; replacement-program teaching; exact percentage.
- Use assessmentExcerpt as client-specific grounding. Do not copy names from it.
- Do not write the note opening, closing, performance line, headings, bullets, or markdown.
- Do not invent trial percentages or alter the server-provided percentage.

STYLE EXAMPLE 1:
At the dining table, the RBT placed a worksheet and pencil in front of the client and delivered a direct instruction to begin. The client turned his head away, said "no," and pushed the materials off the table without initiating the task. The client manifested Task refusal. The RBT implemented Premack Principle by presenting one simplified problem and making preferred-item access contingent on completion. The client completed one problem with a prompt and additional problems with fewer prompts. Additionally, the RBT implemented the replacement program "Compliance Training" by prompting single-step instruction following and reinforcing each completed step; approximately 20% of discrete trials met criterion.

STYLE EXAMPLE 2:
At the kitchen counter, the RBT placed a preferred snack out of reach and offered two alternatives. The client manifested Physical Aggression by pushing the RBT's forearm and hitting with an open hand. The RBT used Response blocking to prevent further contact and Differential Reinforcement of Alternative Behavior (DRA) to reinforce keeping hands to self and choosing appropriately. The client completed the choice response and cleaning step on two of three opportunities. The RBT implemented the replacement program "Accepting alternatives and making choices" by presenting two clear options and prompting one appropriate selection; criterion was met on approximately 10% of discrete trials.

STYLE EXAMPLE 3:
The RBT placed a homework worksheet and pencil on the dining table and instructed the client to remain in the chair. The client manifested Elopement by leaving the supervised area and moving into the hallway. The RBT used Response blocking to stop further movement and Escape independent response delivery to re-present a smaller amount of work and provide a brief break after completion. The client returned to the chair in two of three opportunities. The RBT implemented the replacement program "Request permission to leave the unsupervised area" by prompting an appropriate request before stepping away. Criterion was met on approximately 30% of discrete trials.

STYLE EXAMPLE 4:
Near the sofa, the RBT arranged a card game for a turn-taking activity. The client manifested Self-injury behavior (SIB) by striking his face with an open hand and scratching his forearm. The RBT used Response blocking, Differential Reinforcement of Alternative Behavior (DRA), and Non-contingent reinforcement (attention and escape), describing how each was applied. The client returned to the card activity across two of four opportunities. The RBT implemented the replacement program "Express and accept opinion, agreement and disagreement" through modeled game-related statements and prompted exchanges, with criterion met on approximately 20% of discrete trials.`;

const NOTE_PLAN_JSON_SCHEMA = {
  name: "flexible_aba_note_plan",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["segments"],
    properties: {
      segments: {
        type: "array",
        minItems: 1,
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["segmentIndex", "paragraph"],
          properties: {
            segmentIndex: { type: "integer", minimum: 0 },
            paragraph: { type: "string", minLength: 1 },
          },
        },
      },
    },
  },
} as const;

export const CLINICAL_BODY_PROMPT_VERSION = "2026-07-20.flexible-abc-v1";
export const CLINICAL_BODY_PROMPT_HASH = createHash("sha256")
  .update(SYSTEM_PROMPT)
  .update("\u0000")
  .update(JSON.stringify(NOTE_PLAN_JSON_SCHEMA))
  .digest("hex");

type NoteModelUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

type ProseIssue = {
  code: string;
  message: string;
  severity: "blocking" | "warning";
  paragraphIndex?: number;
};

export type NoteGenerationAttemptTelemetry = {
  attempt: number;
  latencyMs: number;
  completionId: string | null;
  usage: NoteModelUsage | null;
  model?: string | null;
  planIssues: NotePlanIssue[];
  proseIssues: ProseIssue[];
  passed: boolean;
};

export type NotePlanModelCallOutput = {
  output: string;
  completionId?: string;
  usage?: NoteModelUsage;
  model?: string;
};

export type NotePlanModelCall = (params: {
  messages: ChatCompletionMessageParam[];
  attempt: number;
}) => Promise<string | NotePlanModelCallOutput>;

export type GenerateClinicalBodyResult = {
  body: string;
  notePlan: NotePlan;
  warnings: string[];
  repairAttempts: number;
  finalIssues: ProseIssue[];
  attemptHistory: NoteGenerationAttemptTelemetry[];
  rawModelOutputs: string[];
  repairActions: string[];
  modelUsed: string;
};

export function resolvedOpenAIModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_NOTE_MODEL;
}

export function resolvedFallbackOpenAIModel(): string | null {
  const raw = process.env.OPENAI_FALLBACK_MODEL?.trim();
  if (raw === undefined) return "gpt-5.5";
  if (raw === "" || /^(?:none|off|disabled)$/i.test(raw)) return null;
  return raw;
}

export function isOpenAINoteGenerationConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function openaiNoteGenerationLabel(): string {
  return `OpenAI ${resolvedOpenAIModel()}`;
}

export function resolveBackgroundOpenAIRequestTimeoutMs(): number {
  const raw = Number(process.env.OPENAI_BACKGROUND_REQUEST_TIMEOUT_MS ?? "");
  return Number.isFinite(raw) && raw >= 5_000 ? Math.floor(raw) : 180_000;
}

export function resolveBackgroundNoteGenerationTimeBudgetMs(): number {
  const raw = Number(process.env.NOTE_GENERATION_BACKGROUND_TIME_BUDGET_MS ?? "");
  return Number.isFinite(raw) && raw >= 15_000 ? Math.floor(raw) : 240_000;
}

function contextMessage(ctx: SessionContext): string {
  return `Write the hourly ABC paragraphs from this frozen context:\n${JSON.stringify(ctx)}`;
}

export function buildScopedRepairUserMessage(params: {
  frozen: SessionContext;
  planIssues: NotePlanIssue[];
  priorRaw: string;
  priorPlan: NotePlan | null;
}): string {
  return `Repair only the structural failures listed below. Return the complete JSON object.
Do not change any correct hourly paragraph. Every hour must include its exact programName and criterionPercentage.

FAILURES:
${JSON.stringify(params.planIssues)}

FROZEN CONTEXT:
${JSON.stringify(params.frozen)}

PRIOR OUTPUT:
${params.priorRaw}`;
}

async function defaultModelCall(params: {
  messages: ChatCompletionMessageParam[];
  attempt: number;
  requestTimeoutMs?: number;
  model: string;
}): Promise<NotePlanModelCallOutput> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: params.requestTimeoutMs ?? 90_000,
  });
  const completion = await client.chat.completions.create({
    model: params.model,
    messages: params.messages,
    response_format: {
      type: "json_schema",
      json_schema: NOTE_PLAN_JSON_SCHEMA,
    },
    max_completion_tokens: 6_000,
  });
  return {
    output: completion.choices[0]?.message?.content ?? "",
    completionId: completion.id,
    model: completion.model,
    usage: completion.usage
      ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        }
      : undefined,
  };
}

export async function generateClinicalBodyOpenAI(
  ctx: NoteGenerationContext,
  options?: {
    blockedClientNames?: string[];
    modelCall?: NotePlanModelCall;
    requestTimeoutMs?: number;
    timeBudgetMs?: number;
    fallbackModel?: string | null;
  },
): Promise<GenerateClinicalBodyResult> {
  const frozen = buildFrozenSessionContext(ctx);
  const startedAt = Date.now();
  const timeBudgetMs = options?.timeBudgetMs ?? 120_000;
  const primaryModel = resolvedOpenAIModel();
  const fallbackModel =
    options?.fallbackModel === undefined ? resolvedFallbackOpenAIModel() : options.fallbackModel;
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: contextMessage(frozen) },
  ];
  const attemptHistory: NoteGenerationAttemptTelemetry[] = [];
  const rawModelOutputs: string[] = [];
  const repairActions: string[] = [];
  let priorPlan: NotePlan | null = null;
  let priorRaw = "";
  let lastIssues: NotePlanIssue[] = [];
  let modelUsed = primaryModel;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (Date.now() - startedAt >= timeBudgetMs) break;
    const attemptStarted = Date.now();
    let result: string | NotePlanModelCallOutput;
    try {
      result = options?.modelCall
        ? await options.modelCall({ messages, attempt })
        : await defaultModelCall({
            messages,
            attempt,
            requestTimeoutMs: options?.requestTimeoutMs,
            model: attempt > 0 && fallbackModel ? fallbackModel : primaryModel,
          });
    } catch (error) {
      if (attempt === 0 && fallbackModel && !options?.modelCall) {
        repairActions.push(`Primary model failed; retried with ${fallbackModel}.`);
        continue;
      }
      throw error;
    }

    const normalized =
      typeof result === "string"
        ? { output: result, completionId: undefined, usage: undefined, model: primaryModel }
        : result;
    priorRaw = normalized.output;
    rawModelOutputs.push(priorRaw);
    modelUsed = normalized.model ?? modelUsed;
    const validated = parseAndValidateNotePlan(priorRaw, frozen);
    priorPlan = validated.plan;
    lastIssues = validated.issues;
    attemptHistory.push({
      attempt,
      latencyMs: Date.now() - attemptStarted,
      completionId: normalized.completionId ?? null,
      usage: normalized.usage ?? null,
      model: modelUsed,
      planIssues: lastIssues,
      proseIssues: [],
      passed: lastIssues.length === 0,
    });

    if (priorPlan && lastIssues.length === 0) {
      return {
        body: assembleClinicalBodyFromNotePlan(priorPlan, frozen),
        notePlan: priorPlan,
        warnings: [],
        repairAttempts: attempt,
        finalIssues: [],
        attemptHistory,
        rawModelOutputs,
        repairActions,
        modelUsed,
      };
    }

    repairActions.push(
      `Repair attempt ${attempt + 1}: ${lastIssues.map((issue) => issue.code).join(", ")}.`,
    );
    messages.push({ role: "assistant", content: priorRaw });
    messages.push({
      role: "user",
      content: buildScopedRepairUserMessage({
        frozen,
        planIssues: lastIssues,
        priorRaw,
        priorPlan,
      }),
    });
  }

  const error = new Error(
    `AI note generation did not satisfy the hourly contract: ${lastIssues.map((issue) => issue.message).join(" ")}`,
  ) as Error & {
    noteGenerationAttemptHistory?: NoteGenerationAttemptTelemetry[];
    noteGenerationRawModelOutputs?: string[];
    noteGenerationRepairActions?: string[];
  };
  error.noteGenerationAttemptHistory = attemptHistory;
  error.noteGenerationRawModelOutputs = rawModelOutputs;
  error.noteGenerationRepairActions = repairActions;
  throw error;
}
