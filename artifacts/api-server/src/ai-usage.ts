import {
  AiLimitExceededError,
  assertAiProviderConfigured,
  readPositiveIntEnv,
  readPositiveNumberEnv,
  type AiFeature,
} from "./ai-config";

export type AiUsageIdentity = {
  userId: number;
  companyId: number;
};

export type AiUsageReservationInput = AiUsageIdentity & {
  feature: AiFeature;
  operationId: string;
  model: string;
  reservedCostUsd: number;
};

export type DailyUsageRow = {
  id: number;
  feature: string;
  operationId: string;
  status: string;
  userId: number | null;
  companyId: number | null;
  estimatedCostUsd: string;
};

export type AiUsageReservation = {
  id: number;
  feature: AiFeature;
  operationId: string;
  model: string;
};

export type AiUsageStore = {
  reserve(
    input: AiUsageReservationInput,
    now?: Date,
  ): Promise<AiUsageReservation>;
  complete(
    reservation: AiUsageReservation,
    usage: {
      promptTokens: number;
      completionTokens: number;
      estimatedCostUsd: number;
    },
  ): Promise<void>;
  fail(
    reservation: AiUsageReservation,
    options?: { preserveReservedCost?: boolean },
  ): Promise<void>;
  release(reservation: AiUsageReservation): Promise<void>;
};

export const databaseAiUsageStore: AiUsageStore = {
  async reserve(input, now = new Date()) {
    const [{ gte, sql }, { db }, { aiUsageTable }] = await Promise.all([
      import("drizzle-orm"),
      import("@workspace/db"),
      import("@workspace/db/schema"),
    ]);
    return db.transaction(async (tx) => {
      // Serialize the short read-check-insert critical section across processes.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext('abanote_ai_daily_budget'))`,
      );
      const rows = await tx
        .select({
          id: aiUsageTable.id,
          feature: aiUsageTable.feature,
          operationId: aiUsageTable.operationId,
          status: aiUsageTable.status,
          userId: aiUsageTable.userId,
          companyId: aiUsageTable.companyId,
          estimatedCostUsd: aiUsageTable.estimatedCostUsd,
        })
        .from(aiUsageTable)
        .where(gte(aiUsageTable.createdAt, startOfUtcDay(now)));
      enforceAiUsageLimits(rows, input);
      const [inserted] = await tx
        .insert(aiUsageTable)
        .values({
          feature: input.feature,
          operationId: input.operationId,
          status: "reserved",
          providerCalled: false,
          userId: input.userId,
          companyId: input.companyId,
          model: input.model,
          promptTokens: 0,
          completionTokens: 0,
          estimatedCostUsd: Math.max(0, input.reservedCostUsd).toFixed(6),
          createdAt: now,
        })
        .returning({ id: aiUsageTable.id });
      if (!inserted) throw new Error("Failed to reserve AI usage");
      return {
        id: inserted.id,
        feature: input.feature,
        operationId: input.operationId,
        model: input.model,
      };
    });
  },
  async complete(reservation, usage) {
    const [{ eq }, { db }, { aiUsageTable }] = await Promise.all([
      import("drizzle-orm"),
      import("@workspace/db"),
      import("@workspace/db/schema"),
    ]);
    await db
      .update(aiUsageTable)
      .set({
        status: "completed",
        providerCalled: true,
        promptTokens: Math.max(0, Math.floor(usage.promptTokens)),
        completionTokens: Math.max(0, Math.floor(usage.completionTokens)),
        estimatedCostUsd: Math.max(0, usage.estimatedCostUsd).toFixed(6),
      })
      .where(eq(aiUsageTable.id, reservation.id));
  },
  async fail(reservation, options) {
    const [{ eq }, { db }, { aiUsageTable }] = await Promise.all([
      import("drizzle-orm"),
      import("@workspace/db"),
      import("@workspace/db/schema"),
    ]);
    await db
      .update(aiUsageTable)
      .set({
        status: "failed",
        providerCalled: true,
        promptTokens: 0,
        completionTokens: 0,
        ...(options?.preserveReservedCost
          ? {}
          : { estimatedCostUsd: "0" }),
      })
      .where(eq(aiUsageTable.id, reservation.id));
  },
  async release(reservation) {
    const [{ and, eq }, { db }, { aiUsageTable }] = await Promise.all([
      import("drizzle-orm"),
      import("@workspace/db"),
      import("@workspace/db/schema"),
    ]);
    await db
      .delete(aiUsageTable)
      .where(
        and(
          eq(aiUsageTable.id, reservation.id),
          eq(aiUsageTable.status, "reserved"),
          eq(aiUsageTable.providerCalled, false),
        ),
      );
  },
};

function startOfUtcDay(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function distinctOperations(rows: DailyUsageRow[]): number {
  return new Set(rows.map((row) => row.operationId)).size;
}

export function enforceAiUsageLimits(
  rows: DailyUsageRow[],
  input: AiUsageReservationInput,
): void {
  const activeRows = rows.filter(
    (row) => row.status === "reserved" || row.status === "completed",
  );
  const budget = readPositiveNumberEnv("AI_DAILY_BUDGET_USD", 10);
  const spent = activeRows.reduce(
    (sum, row) => sum + (Number(row.estimatedCostUsd) || 0),
    0,
  );
  if (spent + input.reservedCostUsd > budget) {
    throw new AiLimitExceededError(
      "The daily AI budget has been reached. Please try again tomorrow.",
    );
  }
  const configuredUserBudget = readPositiveNumberEnv(
    "AI_DAILY_BUDGET_USD_PER_USER",
    2,
  );
  // Keep at least half of the global budget available to other users, even if the
  // per-user env value is accidentally configured above the shared ceiling.
  const userBudget = Math.min(configuredUserBudget, budget / 2);
  const userSpent = activeRows
    .filter((row) => row.userId === input.userId)
    .reduce(
      (sum, row) => sum + (Number(row.estimatedCostUsd) || 0),
      0,
    );
  if (userSpent + input.reservedCostUsd > userBudget) {
    throw new AiLimitExceededError(
      "Your daily AI budget has been reached. Please try again tomorrow.",
    );
  }

  const sameOperationAlreadyReserved = activeRows.some(
    (row) =>
      row.feature === input.feature &&
      row.operationId === input.operationId,
  );
  if (input.feature === "note") {
    if (!sameOperationAlreadyReserved) {
      const userNotes = distinctOperations(
        activeRows.filter(
          (row) => row.feature === "note" && row.userId === input.userId,
        ),
      );
      if (
        userNotes >= readPositiveIntEnv("NOTE_AI_DAILY_LIMIT_PER_USER", 30)
      ) {
        throw new AiLimitExceededError();
      }
      const companyNotes = distinctOperations(
        activeRows.filter(
          (row) =>
            row.feature === "note" && row.companyId === input.companyId,
        ),
      );
      if (
        companyNotes >=
        readPositiveIntEnv("NOTE_AI_DAILY_LIMIT_PER_COMPANY", 100)
      ) {
        throw new AiLimitExceededError(
          "The company daily note AI limit has been reached. Please try again tomorrow.",
        );
      }
    }
    return;
  }

  const featureCompanyOperations = distinctOperations(
    activeRows.filter(
      (row) =>
        row.feature === input.feature &&
        row.companyId === input.companyId,
    ),
  );
  const featureLimit =
    input.feature === "assessment"
      ? readPositiveIntEnv("ASSESSMENT_AI_DAILY_LIMIT_PER_COMPANY", 10)
      : readPositiveIntEnv("AVATAR_AI_DAILY_LIMIT_PER_COMPANY", 5);
  if (!sameOperationAlreadyReserved && featureCompanyOperations >= featureLimit) {
    throw new AiLimitExceededError();
  }
}

export async function reserveAiUsage(
  input: AiUsageReservationInput,
  store: AiUsageStore = databaseAiUsageStore,
  now = new Date(),
): Promise<AiUsageReservation> {
  assertAiProviderConfigured(input.feature);
  return store.reserve(input, now);
}

const TOKEN_PRICES_PER_MILLION: Record<
  string,
  { input: number; output: number }
> = {
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-5": { input: 1.25, output: 10 },
  "gpt-5.5": { input: 1.25, output: 10 },
};

export function estimateTokenCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const key = Object.keys(TOKEN_PRICES_PER_MILLION).find(
    (candidate) =>
      model.toLowerCase() === candidate ||
      model.toLowerCase().startsWith(`${candidate}-`),
  );
  // Unknown models use a conservative estimate rather than being recorded as free.
  const prices = key
    ? TOKEN_PRICES_PER_MILLION[key]!
    : { input: 5, output: 15 };
  return (
    (Math.max(0, promptTokens) * prices.input +
      Math.max(0, completionTokens) * prices.output) /
    1_000_000
  );
}

export function estimateTextReservationCostUsd(
  model: string,
  promptCharacters: number,
  maxCompletionTokens: number,
): number {
  // Three characters per token is deliberately conservative for JSON and clinical prose.
  return estimateTokenCostUsd(
    model,
    Math.ceil(Math.max(0, promptCharacters) / 3),
    Math.max(0, maxCompletionTokens),
  );
}

export function estimateImageCostUsd(
  quality: "low" | "medium" | "high",
): number {
  return quality === "high" ? 0.167 : quality === "medium" ? 0.042 : 0.011;
}

export async function completeAiUsageBestEffort(
  reservation: AiUsageReservation,
  usage: {
    promptTokens: number;
    completionTokens: number;
    estimatedCostUsd: number;
  },
  store: AiUsageStore = databaseAiUsageStore,
): Promise<void> {
  try {
    await store.complete(reservation, usage);
  } catch (error) {
    // The provider has already returned a billable result. Preserve that result;
    // the original reservation remains as conservative budget accounting.
    console.error("[ai-usage] failed to finalize billed usage", error);
  }
}

export async function failAiUsageBestEffort(
  reservation: AiUsageReservation,
  options: { preserveReservedCost?: boolean },
  store: AiUsageStore = databaseAiUsageStore,
): Promise<void> {
  try {
    await store.fail(reservation, options);
  } catch (error) {
    console.error("[ai-usage] failed to mark provider failure", error);
  }
}

export function isProviderTimeoutAfterSend(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const candidate = error as Error & { status?: number; code?: string };
  return (
    candidate.name === "AbortError" ||
    candidate.code === "ETIMEDOUT" ||
    candidate.status === 408 ||
    candidate.status === 504 ||
    /timed?\s*out|timeout/i.test(candidate.message)
  );
}

export async function releaseAiUsageBestEffort(
  reservation: AiUsageReservation,
  store: AiUsageStore = databaseAiUsageStore,
): Promise<void> {
  try {
    await store.release(reservation);
  } catch (error) {
    console.error("[ai-usage] failed to release pre-call reservation", error);
  }
}
