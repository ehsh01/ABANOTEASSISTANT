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

export type AiUsageRecord = AiUsageIdentity & {
  feature: AiFeature;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  estimatedCostUsd?: number;
};

type DailyUsageRow = {
  feature: string;
  userId: number | null;
  companyId: number | null;
  estimatedCostUsd: string;
};

export type AiUsageStore = {
  listSince(since: Date): Promise<DailyUsageRow[]>;
  insert(record: AiUsageRecord & { estimatedCostUsd: number }): Promise<void>;
};

export const databaseAiUsageStore: AiUsageStore = {
  async listSince(since) {
    const [{ gte }, { db }, { aiUsageTable }] = await Promise.all([
      import("drizzle-orm"),
      import("@workspace/db"),
      import("@workspace/db/schema"),
    ]);
    return db
      .select({
        feature: aiUsageTable.feature,
        userId: aiUsageTable.userId,
        companyId: aiUsageTable.companyId,
        estimatedCostUsd: aiUsageTable.estimatedCostUsd,
      })
      .from(aiUsageTable)
      .where(gte(aiUsageTable.createdAt, since));
  },
  async insert(record) {
    const [{ db }, { aiUsageTable }] = await Promise.all([
      import("@workspace/db"),
      import("@workspace/db/schema"),
    ]);
    await db.insert(aiUsageTable).values({
      feature: record.feature,
      userId: record.userId,
      companyId: record.companyId,
      model: record.model,
      promptTokens: Math.max(0, Math.floor(record.promptTokens ?? 0)),
      completionTokens: Math.max(0, Math.floor(record.completionTokens ?? 0)),
      estimatedCostUsd: record.estimatedCostUsd.toFixed(6),
    });
  },
};

function startOfUtcDay(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function featureLimit(feature: AiFeature): {
  env: string;
  fallback: number;
  scope: "user" | "company";
} {
  switch (feature) {
    case "note":
      return {
        env: "NOTE_AI_DAILY_LIMIT_PER_USER",
        fallback: 30,
        scope: "user",
      };
    case "assessment":
      return {
        env: "ASSESSMENT_AI_DAILY_LIMIT_PER_COMPANY",
        fallback: 10,
        scope: "company",
      };
    case "avatar":
      return {
        env: "AVATAR_AI_DAILY_LIMIT_PER_COMPANY",
        fallback: 5,
        scope: "company",
      };
  }
}

/**
 * Fail-closed feature/provider check plus pre-call daily spend checks.
 * Cache lookups should happen after `assertAiProviderConfigured` but before this function,
 * because cache hits spend no provider budget.
 */
export async function assertAiUsageAllowed(
  feature: AiFeature,
  identity: AiUsageIdentity,
  store: AiUsageStore = databaseAiUsageStore,
  now = new Date(),
): Promise<void> {
  assertAiProviderConfigured(feature);
  const rows = await store.listSince(startOfUtcDay(now));
  const budget = readPositiveNumberEnv("AI_DAILY_BUDGET_USD", 10);
  const spent = rows.reduce(
    (sum, row) => sum + (Number(row.estimatedCostUsd) || 0),
    0,
  );
  if (spent >= budget) {
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
  const userSpent = rows
    .filter((row) => row.userId === identity.userId)
    .reduce(
      (sum, row) => sum + (Number(row.estimatedCostUsd) || 0),
      0,
    );
  if (userSpent >= userBudget) {
    throw new AiLimitExceededError(
      "Your daily AI budget has been reached. Please try again tomorrow.",
    );
  }

  const limitConfig = featureLimit(feature);
  const limit = readPositiveIntEnv(limitConfig.env, limitConfig.fallback);
  const used = rows.filter((row) => {
    if (row.feature !== feature) return false;
    return limitConfig.scope === "user"
      ? row.userId === identity.userId
      : row.companyId === identity.companyId;
  }).length;
  if (used >= limit) {
    throw new AiLimitExceededError();
  }
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

export function estimateImageCostUsd(
  quality: "low" | "medium" | "high",
): number {
  return quality === "high" ? 0.167 : quality === "medium" ? 0.042 : 0.011;
}

export async function recordAiUsage(
  record: AiUsageRecord,
  store: AiUsageStore = databaseAiUsageStore,
): Promise<void> {
  const promptTokens = Math.max(0, Math.floor(record.promptTokens ?? 0));
  const completionTokens = Math.max(
    0,
    Math.floor(record.completionTokens ?? 0),
  );
  const estimatedCostUsd =
    record.estimatedCostUsd ??
    estimateTokenCostUsd(record.model, promptTokens, completionTokens);
  await store.insert({
    ...record,
    promptTokens,
    completionTokens,
    estimatedCostUsd,
  });
}
