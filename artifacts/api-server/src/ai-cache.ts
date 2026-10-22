import { createHash } from "node:crypto";
import { readNonNegativeIntEnv, type AiFeature } from "./ai-config";

type AiCacheEntry = {
  model: string;
  response: unknown;
  expiresAt: Date | null;
};

export type AiCacheStore = {
  get(
    feature: AiFeature,
    companyId: number,
    cacheKey: string,
  ): Promise<AiCacheEntry | null>;
  put(params: {
    feature: AiFeature;
    companyId: number;
    cacheKey: string;
    model: string;
    response: unknown;
    expiresAt: Date | null;
  }): Promise<void>;
};

export const databaseAiCacheStore: AiCacheStore = {
  async get(feature, companyId, cacheKey) {
    const [{ and, eq }, { db }, { aiResponseCacheTable }] = await Promise.all([
      import("drizzle-orm"),
      import("@workspace/db"),
      import("@workspace/db/schema"),
    ]);
    const [row] = await db
      .select({
        model: aiResponseCacheTable.model,
        response: aiResponseCacheTable.response,
        expiresAt: aiResponseCacheTable.expiresAt,
      })
      .from(aiResponseCacheTable)
      .where(
        and(
          eq(aiResponseCacheTable.feature, feature),
          eq(aiResponseCacheTable.companyId, companyId),
          eq(aiResponseCacheTable.cacheKey, cacheKey),
        ),
      )
      .limit(1);
    return row ?? null;
  },
  async put(params) {
    const [{ db }, { aiResponseCacheTable }] = await Promise.all([
      import("@workspace/db"),
      import("@workspace/db/schema"),
    ]);
    const now = new Date();
    await db
      .insert(aiResponseCacheTable)
      .values({ ...params, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [
          aiResponseCacheTable.feature,
          aiResponseCacheTable.companyId,
          aiResponseCacheTable.cacheKey,
        ],
        set: {
          model: params.model,
          response: params.response,
          expiresAt: params.expiresAt,
          updatedAt: now,
        },
      });
  },
};

export function sha256CacheKey(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function readAiCache<T>(params: {
  feature: AiFeature;
  companyId: number;
  cacheKey: string;
  model: string;
  matchModel?: boolean;
  parse: (value: unknown) => T | null;
  store?: AiCacheStore;
  now?: Date;
}): Promise<T | null> {
  const store = params.store ?? databaseAiCacheStore;
  const entry = await store.get(
    params.feature,
    params.companyId,
    params.cacheKey,
  );
  if (!entry || (params.matchModel !== false && entry.model !== params.model)) {
    return null;
  }
  const now = params.now ?? new Date();
  if (entry.expiresAt && entry.expiresAt.getTime() <= now.getTime())
    return null;
  return params.parse(entry.response);
}

export async function writeAiCache(params: {
  feature: AiFeature;
  companyId: number;
  cacheKey: string;
  model: string;
  response: unknown;
  ttlSecondsEnv: string;
  defaultTtlSeconds: number;
  store?: AiCacheStore;
  now?: Date;
}): Promise<void> {
  const store = params.store ?? databaseAiCacheStore;
  const ttlSeconds = readNonNegativeIntEnv(
    params.ttlSecondsEnv,
    params.defaultTtlSeconds,
  );
  const now = params.now ?? new Date();
  await store.put({
    feature: params.feature,
    companyId: params.companyId,
    cacheKey: params.cacheKey,
    model: params.model,
    response: params.response,
    // Zero remains available for an explicitly configured non-expiring cache.
    expiresAt:
      ttlSeconds === 0 ? null : new Date(now.getTime() + ttlSeconds * 1000),
  });
}

export async function writeAiCacheBestEffort(
  params: Parameters<typeof writeAiCache>[0],
): Promise<boolean> {
  try {
    await writeAiCache(params);
    return true;
  } catch (error) {
    // The provider result is already billable and valid. Cache availability must
    // never change the API result returned to the user.
    console.error("[ai-cache] failed to store provider result", error);
    return false;
  }
}
