import { createHash } from "node:crypto";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { assembleClinicalBodyFromNotePlan } from "./note-plan-assembly";
import {
  NotePlanSchema,
  type NotePlan,
  type SessionContext,
} from "./note-plan-schema";
import {
  blockingNotePlanIssues,
  buildFrozenSessionContext,
  parseAndValidateNotePlan,
  validateNotePlan,
  type NotePlanIssue,
} from "./note-plan-validation";
import {
  assertAiUsageAllowed,
  recordAiUsage,
  type AiUsageIdentity,
  type AiUsageStore,
} from "./ai-usage";
import { assertAiProviderConfigured, readPositiveIntEnv } from "./ai-config";

export const DEFAULT_OPENAI_NOTE_MODEL = "gpt-4.1-mini";
export type NoteGenerationContext = SessionContext;

const SYSTEM_PROMPT = `You write flexible ABA session-note ABC paragraphs. Return JSON only.

Output {"segments":[{"segmentIndex":0,"behaviorLabel":"...","interventionLabels":["..."],"paragraph":"..."}]} with exactly one segment per hourlyAssignments row.

For each hour:
- Write one cohesive, natural paragraph in past tense.
- Use the exact programName and exact criterionPercentage from that hour. State the percentage with a % sign.
- When criterionPercentage is 0, state plainly that criterion was not met (for example: "criterion was not met; 0% of discrete trials met criterion"). Do not use harsh or judgmental wording about the client failing, doing it wrong, or being unsuccessful.
- Never use a program from another hour and never rename the locked program.
- Place every ABC activity in a specific indoor area consistent with therapySetting (for Home: living room, kitchen, play area, dining table, or similar). The locked opening already names the overall setting; each ABC paragraph should still name the specific place where that hour's activity occurred. Never place therapy in a street, sidewalk, roadway, neighborhood, park, yard, driveway, porch, school, clinic, store, restaurant, vehicle, or any other off-property setting.
- Begin with a concrete antecedent: name the specific place, materials moved, the instruction delivered, or access delayed with specific items. Do not use vague antecedents such as "during a transition activity", "during play", "when access was denied", "after intervention", or "following the previous activity".
- behaviorLabel must be copied exactly from profileBehaviors. If behaviorHint is supplied, use that exact behaviorLabel.
- State the exact behavior label and copy one complete registered action from profileBehaviorTargets topography, including every measurable qualifier (duration, count, volume, direction, body part, force, or boundary). Never leave topography implied from an earlier hour. Surrounding wording may vary (for example "manifested X by…", "X occurred as…", or "the client showed X when…").
- Do not use bare definitional wording alone (for example only "failing to appropriately respond", "non-compliance", or "refusing to comply"). Always add what the client physically did in this hour (for example: left materials untouched, turned the body away, kept hands off the materials, cried with tears, yelled above conversational level, stomped feet, pushed with both hands with enough force to move the RBT's arm).
- Use exactly one intervention from profileInterventions for each hour. Do not stack multiple interventions in the same ABC paragraph; auditors count each intervention sequence as a separate chain.
- interventionLabels must contain exactly one exact string copied only from profileInterventions. Never rename, vary capitalization, abbreviate, or add an intervention from assessmentExcerpt.
- Name that exact intervention label in the paragraph, then write one brief sentence describing what the technician visibly did (application). Do not write the outcome as only the next technician step or only a reinforcement contingency.
- After the intervention application, write an observable client outcome (behavior stopped or decreased, replacement response used, returned to the activity, or completed part of the task). Vary the connector; do not start every hour with "Following this intervention, the client".
- Across hours, vary sentence frames and connectors so the note reads as a person recounting the session. Registered program, behavior, topography, and intervention names stay exact; everything around them can vary. Do not repeat the same three templates in every ABC paragraph ("the client manifested [label] by…"; "following this intervention, the client…"; "the RBT implemented the replacement…").
- Do not use intervention labels as verbs or modified phrases (for example "prompting," "Pivot Praise," or "Priming Interventions"). Do not introduce cue types as additional interventions.
- When reinforcementPreferences lists preferred items or activities, name a concrete reinforcer from that list (or behavior-specific praise) instead of writing only "documented reinforcement". Ground optional leisure activities and preferred materials in that documented list; do not invent client preferences based on age or gender. In particular, never use dolls or doll play unless reinforcementPreferences explicitly documents dolls. The server-authored closing also lists approved reinforcers.
- Every toy, material, and leisure activity must suit clientAgeYears. When clientAgeYears is 13 or older, do not use young-child materials (bubbles, building blocks, shape sorters, stacking rings, playdough, coloring books, crayons, action figures, toy cars) unless reinforcementPreferences documents that exact item. Prefer the documented preferences and age-appropriate work materials (for example a keyboard, tablet, worksheets, index cards, a task list, household chores, or a board or card game). When clientAgeYears is null, still choose materials that match the assessment rather than assuming a young child.
- Dolls, doll play, stuffed animals, plush toys, teddy bears, rattles, and baby or toddler toys are never acceptable for a client 13 or older, even if reinforcementPreferences or assessmentExcerpt lists them. An outdated assessment list does not make an activity age-appropriate.
- In the replacement-program sentence, keep the exact programName and explain the skill practiced in a way that matches the assigned program (for example: FCT teaches a request; Request help involves needing assistance; walk/safety skill involves staying near an adult; transition programs involve movement between locations; time on task involves remaining engaged with materials). The connector around that name may vary.
- Follow the clinical sequence shown in the examples: concrete antecedent; observable behavior with restated topography; one intervention (exact name, application, client outcome); replacement-program teaching; exact percentage. Vary the wording of that sequence from hour to hour.
- Use assessmentExcerpt as client-specific grounding. Do not copy names from it.
- Never mention, recommend, administer, change, or discuss medicine, medication, prescriptions, or dosages, even if assessment text mentions them.
- Use only observable actions and outcomes. Do not write "frustrated," "visibly," "avoidance," "appeared," "seemed," "calm," "calmly," "wanted," or infer emotions, intent, comfort, or other internal states.
- Never state what the client wanted, liked, preferred, tried, or intended. "Want," "wanted," "wants," and "wanting" are opinion wording. Write the observable event instead (for example: instead of "the client wanted the tablet," write "the client reached for the tablet" or "the client pointed to the tablet"). Reproduce these words only when they appear inside a registered name or the supplied activityHint.
- "Calm" and "calmly" are never allowed as your own wording. Write the observable action instead (for example: "kept both hands on the table," "remained seated," "used a quiet voice," "stopped crying"). The only exception is a word that appears inside a registered program, behavior, topography, or intervention name, which you must reproduce exactly.
- Never describe the session as supervision. Do not write "supervised" or "supervision". This visit is clinical direction. Prefer "clinical direction", "guidance", "feedback", "the directing analyst", or "the technician". Copy "supervised" or "supervision" only when those words appear inside a registered program, behavior, topography, or intervention name.
- Do not use em dashes (—), en dashes (–), or standalone hyphens as punctuation. Use commas or normal sentence breaks instead. Hyphens that are part of an exact registered name must remain exact.
- Do not compare with baseline, previous sessions, or trends; no historical trend data is supplied.
- Do not write the note opening, closing, performance line, headings, bullets, or markdown.
- Do not invent trial percentages or alter the server-provided percentage.

STYLE EXAMPLE 1:
At the dining table, the technician placed a worksheet and pencil in front of the client and delivered a direct instruction to begin. The client manifested Task refusal by failing to appropriately respond to the given instruction, turning his body away from the worksheet, and leaving the materials untouched. Premack Principle was used: the technician presented one simplified problem and made access to a preferred snack contingent on completion. After that guidance, the client completed one problem with a prompt and returned to the worksheet. Compliance Training was practiced by prompting single-step instruction following and providing praise after each completed step; approximately 20% of discrete trials met criterion.

STYLE EXAMPLE 2:
At the kitchen counter, the technician placed a preferred snack out of reach and offered two alternatives. Physical Aggression occurred as pushing the RBT's forearm with both hands with enough force to move the RBT's arm. The technician applied Response blocking with an open palm to stop further contact. The client then stopped pushing and kept both hands away from the technician. Work on "Accepting alternatives and making choices" continued by presenting two clear options and prompting one selection; criterion was met on approximately 10% of discrete trials.

STYLE EXAMPLE 3:
The technician placed a homework worksheet and pencil on the dining table and instructed the client to remain in the chair. Elopement occurred when the client left the designated work area and moved into the hallway. Response blocking followed: the technician stepped to the doorway and stopped further movement into the hall. With that clinical direction, the client stopped advancing and turned back toward the table. The directing analyst's target "Request permission to leave the unsupervised area" was taught by prompting an appropriate request before stepping away. Criterion was met on approximately 30% of discrete trials.

STYLE EXAMPLE 4:
Near the sofa, the technician arranged a card game for a turn-taking activity. The client showed Self-injury behavior (SIB) by striking his face with an open hand and scratching his forearm. Differential Reinforcement of Alternative Behavior (DRA) was delivered as brief access to a preferred toy when both hands remained away from the face. After that feedback, the client returned to the card activity across two of four opportunities. "Express and accept opinion, agreement and disagreement" was modeled through game-related statements and prompted exchanges, with criterion met on approximately 20% of discrete trials.`;

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
          required: [
            "segmentIndex",
            "behaviorLabel",
            "interventionLabels",
            "paragraph",
          ],
          properties: {
            segmentIndex: { type: "integer", minimum: 0 },
            behaviorLabel: { type: "string", minLength: 1 },
            interventionLabels: {
              type: "array",
              minItems: 1,
              maxItems: 1,
              items: { type: "string", minLength: 1 },
            },
            paragraph: { type: "string", minLength: 1 },
          },
        },
      },
    },
  },
} as const;

export const CLINICAL_BODY_PROMPT_VERSION = "2026-10-15.no-dash-punctuation-v1";

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
  finishReason?: string | null;
};

export type NotePlanModelCall = (params: {
  messages: ChatCompletionMessageParam[];
  attempt: number;
  model: string;
  maxCompletionTokens: number;
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
  if (!raw || /^(?:none|off|disabled)$/i.test(raw)) return null;
  return raw;
}

export function isOpenAINoteGenerationConfigured(): boolean {
  try {
    assertAiProviderConfigured("note");
    return true;
  } catch {
    return false;
  }
}

export function openaiNoteGenerationLabel(): string {
  return `OpenAI ${resolvedOpenAIModel()}`;
}

export function resolveBackgroundOpenAIRequestTimeoutMs(): number {
  const raw = Number(process.env.OPENAI_BACKGROUND_REQUEST_TIMEOUT_MS ?? "");
  return Number.isFinite(raw) && raw >= 5_000 ? Math.floor(raw) : 180_000;
}

export function resolveBackgroundNoteGenerationTimeBudgetMs(): number {
  const raw = Number(
    process.env.NOTE_GENERATION_BACKGROUND_TIME_BUDGET_MS ?? "",
  );
  return Number.isFinite(raw) && raw >= 15_000 ? Math.floor(raw) : 240_000;
}

export function resolveNoteAiMaxAttempts(): number {
  return Math.min(2, readPositiveIntEnv("NOTE_AI_MAX_ATTEMPTS", 2));
}

export function resolveNoteMaxCompletionTokens(): number {
  return readPositiveIntEnv("NOTE_AI_MAX_COMPLETION_TOKENS", 3_000);
}

function contextMessage(ctx: SessionContext): string {
  return `Write the hourly ABC paragraphs from this frozen context:\n${JSON.stringify(ctx)}`;
}

function constrainedNotePlanJsonSchema(
  ctx: SessionContext,
): typeof NOTE_PLAN_JSON_SCHEMA {
  const schema = structuredClone(NOTE_PLAN_JSON_SCHEMA) as unknown as {
    name: string;
    strict: true;
    schema: {
      properties: {
        segments: {
          items: {
            properties: {
              behaviorLabel: {
                type: string;
                minLength: number;
                enum?: string[];
              };
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
  let failingIndexes = [
    ...new Set(
      params.planIssues.flatMap((issue) =>
        issue.segmentIndex === undefined ? [] : [issue.segmentIndex],
      ),
    ),
  ];
  if (failingIndexes.length === 0) {
    failingIndexes = params.frozen.hourlyAssignments.map(
      (assignment) => assignment.segmentIndex,
    );
  }
  const failingIndexSet = new Set(failingIndexes);
  const minimalContext = {
    sessionHours: failingIndexes.length,
    therapySetting: params.frozen.therapySetting,
    clientAgeYears: params.frozen.clientAgeYears,
    profileBehaviors: params.frozen.profileBehaviors,
    profileBehaviorTargets: params.frozen.profileBehaviorTargets,
    profileInterventions: params.frozen.profileInterventions,
    reinforcementPreferences: params.frozen.reinforcementPreferences,
    hourlyAssignments: params.frozen.hourlyAssignments.filter((assignment) =>
      failingIndexSet.has(assignment.segmentIndex),
    ),
  };
  const failingPriorSegments =
    params.priorPlan?.segments.filter((segment) =>
      failingIndexSet.has(segment.segmentIndex),
    ) ?? [];
  return `Repair only the contract failures listed below.
Return {"segments":[...]} containing only segment indexes ${JSON.stringify(failingIndexes)}.
Every hour must include its exact programName and criterionPercentage.
behaviorLabel must be copied from profileBehaviors. interventionLabels must contain exactly one label copied exactly from profileInterventions.
Name each intervention with its exact catalog string; surrounding wording may vary.
After naming it, describe technician application, then an observable client outcome. Vary connectors across hours; do not reuse the same "Following this intervention, the client" frame in every paragraph.
Restate observable topography with measurable qualifiers; do not rely on earlier hours. Never use only "failing to appropriately respond" or "non-compliance" without physical actions.
Use a concrete antecedent; do not use vague phrases such as "during play" or "when access was denied".
When reinforcementPreferences are present, name a concrete reinforcer from that list instead of only "documented reinforcement". Do not invent dolls, doll play, or other optional leisure preferences absent from that list.
Keep every toy, material, and activity consistent with clientAgeYears. For a client 13 or older, do not use young-child materials (bubbles, blocks, playdough, crayons, toy cars, and similar) unless that exact item is documented, and never use dolls, stuffed animals, or baby toys even when they are documented.
Keep the exact programName and explain the replacement skill practiced in a way that matches the assigned program.
Use observable wording only and do not make baseline, previous-session, or trend claims. Never use "calm", "calmly", or "wanted" as your own wording; state the observable action instead (for example "reached for" or "pointed to" rather than "wanted").
Never write "supervised" or "supervision" unless those words are inside a registered name. Prefer clinical direction, guidance, feedback, the directing analyst, or the technician.
Do not use em dashes, en dashes, or standalone dash punctuation; use commas or sentence breaks instead.
Keep all activities inside the client's home with a specific indoor place named, and omit all medicine or medication content.

FAILURES:
${JSON.stringify(params.planIssues)}

MINIMAL LOCKED FIELDS:
${JSON.stringify(minimalContext)}

FAILING PRIOR SEGMENTS:
${JSON.stringify(failingPriorSegments)}`;
}

async function defaultModelCall(params: {
  messages: ChatCompletionMessageParam[];
  attempt: number;
  requestTimeoutMs?: number;
  model: string;
  jsonSchema: typeof NOTE_PLAN_JSON_SCHEMA;
  usageIdentity: AiUsageIdentity;
  usageStore?: AiUsageStore;
  maxCompletionTokens: number;
}): Promise<NotePlanModelCallOutput> {
  await assertAiUsageAllowed("note", params.usageIdentity, params.usageStore);
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: params.requestTimeoutMs ?? 90_000,
  });
  let promptTokens = 0;
  let completionTokens = 0;
  try {
  const completion = await client.chat.completions.create({
    model: params.model,
    messages: params.messages,
    response_format: {
      type: "json_schema",
      json_schema: params.jsonSchema,
    },
      max_completion_tokens: params.maxCompletionTokens,
  });
    promptTokens = completion.usage?.prompt_tokens ?? 0;
    completionTokens = completion.usage?.completion_tokens ?? 0;
  return {
    output: completion.choices[0]?.message?.content ?? "",
    completionId: completion.id,
    model: completion.model,
      finishReason: completion.choices[0]?.finish_reason ?? null,
    usage: completion.usage
      ? {
            promptTokens,
            completionTokens,
          totalTokens: completion.usage.total_tokens,
        }
      : undefined,
  };
  } finally {
    await recordAiUsage(
      {
        feature: "note",
        ...params.usageIdentity,
        model: params.model,
        promptTokens,
        completionTokens,
      },
      params.usageStore,
    );
  }
}

export async function generateClinicalBodyOpenAI(
  ctx: NoteGenerationContext,
  options?: {
    blockedClientNames?: string[];
    modelCall?: NotePlanModelCall;
    requestTimeoutMs?: number;
    timeBudgetMs?: number;
    fallbackModel?: string | null;
    usageIdentity?: AiUsageIdentity;
    usageStore?: AiUsageStore;
  },
): Promise<GenerateClinicalBodyResult> {
  const frozen = buildFrozenSessionContext(ctx);
  const startedAt = Date.now();
  const timeBudgetMs = options?.timeBudgetMs ?? 120_000;
  const primaryModel = resolvedOpenAIModel();
  const fallbackModel =
    options?.fallbackModel === undefined
      ? resolvedFallbackOpenAIModel()
      : options.fallbackModel;
  const maxAttempts = resolveNoteAiMaxAttempts();
  const maxCompletionTokens = resolveNoteMaxCompletionTokens();
  let messages: ChatCompletionMessageParam[] = [
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
  let nextModel = primaryModel;
  let repairAttempts = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (Date.now() - startedAt >= timeBudgetMs) break;
    const attemptStarted = Date.now();
    let result: string | NotePlanModelCallOutput;
    try {
      result = options?.modelCall
        ? await options.modelCall({
            messages,
            attempt,
            model: nextModel,
            maxCompletionTokens,
          })
        : options?.usageIdentity
          ? await defaultModelCall({
            messages,
            attempt,
            requestTimeoutMs: options?.requestTimeoutMs,
              model: nextModel,
            jsonSchema: constrainedNotePlanJsonSchema(frozen),
              usageIdentity: options.usageIdentity,
              usageStore: options.usageStore,
              maxCompletionTokens,
            })
          : (() => {
              throw new Error("AI usage identity is required");
            })();
    } catch (error) {
      if (attempt + 1 < maxAttempts && isRetryableProviderError(error)) {
        const delayMs =
          readPositiveIntEnv("NOTE_AI_RETRY_BASE_DELAY_MS", 500) * 2 ** attempt;
        nextModel = fallbackModel ?? nextModel;
        repairActions.push(
          `Transient provider failure; retrying after ${delayMs}ms with ${nextModel}.`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw error;
    }

    const normalized =
      typeof result === "string"
        ? {
            output: result,
            completionId: undefined,
            usage: undefined,
            model: nextModel,
            finishReason: undefined,
          }
        : result;
    if (normalized.finishReason === "length") {
      throw new Error(
        "AI note generation was truncated at the completion-token limit.",
      );
    }
    priorRaw = normalized.output;
    rawModelOutputs.push(priorRaw);
    modelUsed = normalized.model ?? modelUsed;
    if (attempt === 0 || !priorPlan) {
    const validated = parseAndValidateNotePlan(priorRaw, frozen);
      priorPlan = validated.plan;
      lastIssues = validated.issues;
    } else {
      const repair = parsePartialNotePlan(priorRaw);
      if (!repair.plan) {
        lastIssues = repair.issues;
      } else {
        const repairedByIndex = new Map(
          repair.plan.segments.map((segment) => [
            segment.segmentIndex,
            segment,
          ]),
        );
        const repairsEveryExpectedSegment = frozen.hourlyAssignments.every(
          (assignment) => repairedByIndex.has(assignment.segmentIndex),
        );
        if (repairsEveryExpectedSegment) {
          priorPlan = repair.plan;
        } else {
          priorPlan = {
            segments: priorPlan.segments.map(
              (segment) => repairedByIndex.get(segment.segmentIndex) ?? segment,
          ),
          };
          for (const segment of repair.plan.segments) {
            if (
              !priorPlan.segments.some(
                (candidate) => candidate.segmentIndex === segment.segmentIndex,
              )
            ) {
              priorPlan.segments.push(segment);
            }
        }
        }
        priorPlan.segments.sort((a, b) => a.segmentIndex - b.segmentIndex);
        lastIssues = validateNotePlan(priorPlan, frozen);
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

    if (priorPlan && blockingIssues.length === 0) {
      const finalAdvisories = lastIssues.filter(
        (issue) => issue.severity === "advisory",
      );
      return {
        body: assembleClinicalBodyFromNotePlan(priorPlan, frozen),
        notePlan: priorPlan,
        warnings: [],
        repairAttempts,
        finalIssues: [],
        finalPlanIssues: finalAdvisories,
        attemptHistory,
        rawModelOutputs,
        repairActions,
        modelUsed,
      };
    }

    if (attempt + 1 < maxAttempts) {
      repairAttempts += 1;
    repairActions.push(
        `Repair attempt ${repairAttempts}: ${lastIssues.map((issue) => issue.code).join(", ")}.`,
    );
      messages = [
        { role: "system", content: SYSTEM_PROMPT },
        {
      role: "user",
      content: buildScopedRepairUserMessage({
        frozen,
        planIssues: lastIssues,
        priorRaw,
        priorPlan,
      }),
        },
      ];
    }
  }

  if (priorPlan && blockingNotePlanIssues(lastIssues).length === 0) {
    const finalAdvisories = lastIssues.filter(
      (issue) => issue.severity === "advisory",
    );
    return {
      body: assembleClinicalBodyFromNotePlan(priorPlan, frozen),
      notePlan: priorPlan,
      warnings: [],
      repairAttempts,
      finalIssues: [],
      finalPlanIssues: finalAdvisories,
      attemptHistory,
      rawModelOutputs,
      repairActions,
      modelUsed,
    };
  }

  const error = new Error(
    `AI note generation did not satisfy the hourly contract: ${blockingNotePlanIssues(
      lastIssues,
    )
      .map((issue) => issue.message)
      .join(" ")}`,
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

function parsePartialNotePlan(raw: string): {
  plan: NotePlan | null;
  issues: NotePlanIssue[];
} {
  try {
    const parsed = NotePlanSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return { plan: parsed.data, issues: [] };
    return {
      plan: null,
      issues: [
        {
          code: "INVALID_JSON",
          severity: "blocking",
          message: parsed.error.message,
        },
      ],
    };
  } catch {
    return {
      plan: null,
      issues: [
        {
          code: "INVALID_JSON",
          severity: "blocking",
          message: "Model output was not valid JSON.",
        },
      ],
    };
  }
}

function isRetryableProviderError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const candidate = error as Error & { status?: number; code?: string };
  if (candidate.status !== undefined) {
    return candidate.status >= 500 && candidate.status <= 599;
  }
  return (
    candidate.name === "AbortError" ||
    candidate.code === "ETIMEDOUT" ||
    candidate.code === "ECONNRESET" ||
    /timed?\s*out|timeout/i.test(candidate.message)
  );
}
