import { createHash } from "node:crypto";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { assembleClinicalBodyFromNotePlan } from "./note-plan-assembly";
import type { NotePlan, SessionContext } from "./note-plan-schema";
import {
  blockingNotePlanIssues,
  buildFrozenSessionContext,
  parseAndValidateNotePlan,
  validateNotePlan,
  type NotePlanIssue,
} from "./note-plan-validation";

export const DEFAULT_OPENAI_NOTE_MODEL = "gpt-5.5";
export type NoteGenerationContext = SessionContext;

const SYSTEM_PROMPT = `You write flexible ABA session-note ABC paragraphs. Return JSON only.

Output {"segments":[{"segmentIndex":0,"behaviorLabel":"...","interventionLabels":["..."],"paragraph":"..."}]} with exactly one segment per hourlyAssignments row.

For each hour:
- Write one cohesive, natural paragraph in past tense.
- Use the exact programName and exact criterionPercentage from that hour. State the percentage with a % sign.
- Never use a program from another hour and never rename the locked program.
- Place every activity inside the client's home (for example, a living room, kitchen, play area, or table). Never place therapy in a street, sidewalk, roadway, neighborhood, park, yard, driveway, porch, school, clinic, store, restaurant, vehicle, or any other off-property setting.
- Begin with a concrete antecedent: name materials moved, the instruction delivered, or access delayed with specific items. Do not use vague antecedents such as "during a transition activity", "during play", "when access was denied", "after intervention", or "following the previous activity".
- behaviorLabel must be copied exactly from profileBehaviors. If behaviorHint is supplied, use that exact behaviorLabel.
- For the behavior sentence, use one complete observable action from the matching profileBehaviorTargets topography when one is present. Preserve its measurable qualifiers (duration, count, direction, body part, or boundary) and do not substitute an unsupported action. Assessment text may add context but cannot authorize a new behavior or intervention.
- interventionLabels must contain one or more exact strings copied only from profileInterventions. Never rename, vary capitalization, abbreviate, or add an intervention from assessmentExcerpt.
- Name every intervention in its own exact sentence: "The RBT implemented [Exact Label]." Then write one brief sentence describing what the RBT visibly did (application). Do not start that application sentence with "Following this intervention".
- After each intervention's application, write a client outcome that starts with "Following this intervention, the client ..." and states an observable result (behavior stopped or decreased, replacement response used, returned to the activity, or completed part of the task). Never write the outcome as the next intervention step, only what the RBT delivered, or only a reinforcement contingency.
- Do not use intervention labels as verbs or modified phrases (for example "prompting," "Pivot Praise," or "Priming Interventions"). Do not introduce cue types as additional interventions.
- When reinforcementPreferences lists preferred items or activities, name a concrete reinforcer from that list (or behavior-specific praise) instead of writing only "documented reinforcement". The server-authored closing also lists approved reinforcers.
- In the replacement-program sentence, explain the skill practiced in a way that matches the assigned program (for example: FCT teaches a request; Request help involves needing assistance; walk/safety skill involves staying near an adult; transition programs involve movement between locations; time on task involves remaining engaged with materials).
- Follow the style sequence shown in the examples: concrete antecedent; observable behavior with topography; for each intervention: naming, RBT application, client outcome; replacement-program teaching; exact percentage.
- Use assessmentExcerpt as client-specific grounding. Do not copy names from it.
- Never mention, recommend, administer, change, or discuss medicine, medication, prescriptions, or dosages, even if assessment text mentions them.
- Use only observable actions and outcomes. Do not write "frustrated," "visibly," "avoidance," "appeared," "seemed," or infer emotions, intent, comfort, or other internal states.
- Do not compare with baseline, previous sessions, or trends; no historical trend data is supplied.
- Do not write the note opening, closing, performance line, headings, bullets, or markdown.
- Do not invent trial percentages or alter the server-provided percentage.

STYLE EXAMPLE 1:
At the dining table, the RBT placed a worksheet and pencil in front of the client and delivered a direct instruction to begin. The client turned his head away, said "no," and pushed the materials off the table without initiating the task. The client manifested Task refusal. The RBT implemented Premack Principle. The RBT presented one simplified problem and made access to a preferred snack contingent on completion. Following this intervention, the client completed one problem with a prompt and returned to the worksheet. The RBT implemented the replacement program "Compliance Training" by prompting single-step instruction following and providing praise after each completed step; approximately 20% of discrete trials met criterion.

STYLE EXAMPLE 2:
At the kitchen counter, the RBT placed a preferred snack out of reach and offered two alternatives. The client manifested Physical Aggression by pushing the RBT's forearm and hitting with an open hand. The RBT implemented Response blocking. The RBT blocked further contact with an open palm. Following this intervention, the client stopped pushing and kept both hands away from the RBT. The RBT implemented Differential Reinforcement of Alternative Behavior (DRA). The RBT delivered behavior-specific praise when the client selected an alternative item. Following this intervention, the client completed the choice response and a cleaning step on two of three opportunities. The RBT implemented the replacement program "Accepting alternatives and making choices" by presenting two clear options and prompting one selection; criterion was met on approximately 10% of discrete trials.

STYLE EXAMPLE 3:
The RBT placed a homework worksheet and pencil on the dining table and instructed the client to remain in the chair. The client manifested Elopement by leaving the supervised area and moving into the hallway. The RBT implemented Response blocking. The RBT stepped to the doorway and stopped further movement into the hall. Following this intervention, the client stopped advancing and turned back toward the table. The RBT implemented Escape independent response delivery. The RBT re-presented a smaller amount of work and offered a brief break after completion. Following this intervention, the client returned to the chair in two of three opportunities. The RBT implemented the replacement program "Request permission to leave the unsupervised area" by prompting an appropriate request before stepping away. Criterion was met on approximately 30% of discrete trials.

STYLE EXAMPLE 4:
Near the sofa, the RBT arranged a card game for a turn-taking activity. The client manifested Self-injury behavior (SIB) by striking his face with an open hand and scratching his forearm. The RBT implemented Response blocking. The RBT prevented further contact with the client's face and arm. Following this intervention, the client stopped striking his face. The RBT implemented Differential Reinforcement of Alternative Behavior (DRA). The RBT provided brief access to a preferred toy when both hands remained away from the face. Following this intervention, the client returned to the card activity across two of four opportunities. The RBT implemented the replacement program "Express and accept opinion, agreement and disagreement" through modeled game-related statements and prompted exchanges, with criterion met on approximately 20% of discrete trials.`;

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
          required: ["segmentIndex", "behaviorLabel", "interventionLabels", "paragraph"],
          properties: {
            segmentIndex: { type: "integer", minimum: 0 },
            behaviorLabel: { type: "string", minLength: 1 },
            interventionLabels: {
              type: "array",
              minItems: 1,
              items: { type: "string", minLength: 1 },
            },
            paragraph: { type: "string", minLength: 1 },
          },
        },
      },
    },
  },
} as const;

export const CLINICAL_BODY_PROMPT_VERSION = "2026-07-23.audit-abc-prose-v1";

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
  finalPlanIssues: NotePlanIssue[];
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
  if (raw === undefined) return "gpt-4.1";
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

function constrainedNotePlanJsonSchema(ctx: SessionContext): typeof NOTE_PLAN_JSON_SCHEMA {
  const schema = structuredClone(NOTE_PLAN_JSON_SCHEMA) as unknown as {
    name: string;
    strict: true;
    schema: {
      properties: {
        segments: {
          items: {
            properties: {
              behaviorLabel: { type: string; minLength: number; enum?: string[] };
              interventionLabels: {
                type: string;
                minItems: number;
                items: { type: string; minLength: number; enum?: string[] };
              };
            };
          };
        };
      };
    };
  };
  schema.schema.properties.segments.items.properties.behaviorLabel.enum =
    ctx.profileBehaviors;
  schema.schema.properties.segments.items.properties.interventionLabels.items.enum =
    ctx.profileInterventions;
  return schema as unknown as typeof NOTE_PLAN_JSON_SCHEMA;
}

export function buildScopedRepairUserMessage(params: {
  frozen: SessionContext;
  planIssues: NotePlanIssue[];
  priorRaw: string;
  priorPlan: NotePlan | null;
}): string {
  const failingIndexes = [
    ...new Set(
      params.planIssues.flatMap((issue) =>
        issue.segmentIndex === undefined ? [] : [issue.segmentIndex],
      ),
    ),
  ];
  return `Repair only the contract failures listed below. Return the complete JSON object.
Only rewrite segment indexes ${JSON.stringify(failingIndexes)}. Do not change any other hourly paragraph.
Every hour must include its exact programName and criterionPercentage.
behaviorLabel must be copied from profileBehaviors. interventionLabels must be copied exactly from profileInterventions.
Every intervention must be named in its own sentence: "The RBT implemented [Exact Label]."
After the naming sentence, describe RBT application without starting with "Following this intervention".
Then write "Following this intervention, the client ..." with an observable client outcome (stopped/decreased topography, used a replacement response, returned to the activity, or completed part of the task).
Use a concrete antecedent; do not use vague phrases such as "during play" or "when access was denied".
Use one complete registered topography action with its measurable qualifiers.
When reinforcementPreferences are present, name a concrete reinforcer instead of only "documented reinforcement".
Explain the replacement skill practiced in a way that matches the assigned program.
Use observable wording only and do not make baseline, previous-session, or trend claims.
Keep all activities inside the client's home and omit all medicine or medication content.

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
  jsonSchema: typeof NOTE_PLAN_JSON_SCHEMA;
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
      json_schema: params.jsonSchema,
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
  const preservedSegments = new Map<number, NotePlan["segments"][number]>();
  let modelUsed = primaryModel;

  for (let attempt = 0; attempt < 4; attempt++) {
    if (Date.now() - startedAt >= timeBudgetMs) break;
    if (attempt === 3) {
      messages.push({
        role: "user",
        content: `FINAL CONSTRAINED FALLBACK:
Regenerate the complete JSON plan. Copy behaviorLabel only from profileBehaviors and interventionLabels only from profileInterventions.
Use each intervention in the exact sentence "The RBT implemented [Exact Label]."
Use one complete action from registered profileBehaviorTargets, including measurable qualifiers. Do not use internal-state language or historical trend claims.
Keep all activities inside the client's home. Do not mention medicine or medication.
All program names and percentages remain locked by hourlyAssignments.`,
      });
      repairActions.push("Started final constrained-AI fallback.");
    }
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
            jsonSchema: constrainedNotePlanJsonSchema(frozen),
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
    priorPlan = validated.plan
      ? {
          segments: validated.plan.segments.map(
            (segment) => preservedSegments.get(segment.segmentIndex) ?? segment,
          ),
        }
      : null;
    lastIssues = priorPlan ? validateNotePlan(priorPlan, frozen) : validated.issues;
    if (priorPlan && !lastIssues.some((issue) => issue.segmentIndex === undefined)) {
      for (const segment of priorPlan.segments) {
        if (!lastIssues.some((issue) => issue.segmentIndex === segment.segmentIndex)) {
          preservedSegments.set(segment.segmentIndex, segment);
        }
      }
    }
    const blockingIssues = blockingNotePlanIssues(lastIssues);
    attemptHistory.push({
      attempt,
      latencyMs: Date.now() - attemptStarted,
      completionId: normalized.completionId ?? null,
      usage: normalized.usage ?? null,
      model: modelUsed,
      planIssues: lastIssues,
      proseIssues: [],
      passed: blockingIssues.length === 0,
    });

    if (
      priorPlan &&
      (lastIssues.length === 0 || (blockingIssues.length === 0 && attempt === 3))
    ) {
      const finalAdvisories = lastIssues.filter((issue) => issue.severity === "advisory");
      return {
        body: assembleClinicalBodyFromNotePlan(priorPlan, frozen),
        notePlan: priorPlan,
        warnings: [],
        repairAttempts: attempt,
        finalIssues: [],
        finalPlanIssues: finalAdvisories,
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

  if (priorPlan && blockingNotePlanIssues(lastIssues).length === 0) {
    const finalAdvisories = lastIssues.filter((issue) => issue.severity === "advisory");
    return {
      body: assembleClinicalBodyFromNotePlan(priorPlan, frozen),
      notePlan: priorPlan,
      warnings: [],
      repairAttempts: Math.max(0, attemptHistory.length - 1),
      finalIssues: [],
      finalPlanIssues: finalAdvisories,
      attemptHistory,
      rawModelOutputs,
      repairActions,
      modelUsed,
    };
  }

  const error = new Error(
    `AI note generation did not satisfy the hourly contract: ${blockingNotePlanIssues(lastIssues).map((issue) => issue.message).join(" ")}`,
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
