/**
 * Per-user "unsaved draft" quota — caps the number of OpenAI note generations a single user can
 * pile up without ever saving. Prevents API-cost abuse from endless regenerate clicks.
 *
 * Contract (server-side, authoritative):
 *  - POST /notes/generate: call `tryConsumeDraftSlot()` BEFORE the OpenAI call. If it returns
 *    `ok: false`, return 429 with the friendly message in `draftCapMessage()`. If `ok: true`,
 *    the slot is reserved; if the OpenAI call subsequently fails we still hold the slot — that
 *    is acceptable because (a) the user got an error response so we want them to think before
 *    retrying, and (b) discard or save will free it. This is intentionally conservative.
 *  - POST /notes/:noteId/save: call `resetDraftQuotaForUser()` after a successful save. Saving
 *    *any* draft frees the entire pool.
 *  - POST /notes/drafts/discard: call `resetDraftQuotaForUser()`. Same behaviour.
 *  - GET /notes/draft-quota: call `readDraftQuotaForUser()` (read-only).
 *
 * The drafts themselves are NEVER persisted server-side. The frontend keeps the generated note
 * bodies in component state; the server only tracks the counter. That is why "discard" is a
 * pure counter reset — there is nothing else to clean up.
 *
 * Future extensibility (do not implement yet, but the shape is ready):
 *  - `getMaxUnsavedDraftsForCompany(company)` is where per-plan caps will live
 *    (Starter 3 / Growth 5 / High Volume 10, etc.). Today it returns the env default for all
 *    callers so behaviour is uniform across plans.
 *  - Env override `MAX_UNSAVED_DRAFTS=N` lets ops bump or lower the global cap at runtime
 *    without redeploys.
 */
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import type { Company } from "@workspace/db/schema";

/** Hard floor on the cap. 1 means "at least one regenerate ever allowed". */
const MIN_CAP = 1;
/** Hard ceiling on the cap so a misconfigured env var can't accidentally disable the guardrail. */
const MAX_CAP = 100;
/** Product default when no env override is set. */
const DEFAULT_MAX_UNSAVED_DRAFTS = 3;

export type DraftQuota = {
  used: number;
  max: number;
};

/**
 * Resolve the per-user cap for unsaved drafts. Today this is plan-agnostic (every plan gets the
 * same cap from env / default). The signature takes a `Company` so we can later branch on
 * `company.billing_mode` or the company's active plan without changing call sites.
 */
export function getMaxUnsavedDraftsForCompany(_company: Company | null | undefined): number {
  const raw = process.env.MAX_UNSAVED_DRAFTS;
  if (typeof raw === "string" && raw.trim().length > 0) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= MIN_CAP && n <= MAX_CAP) return Math.floor(n);
  }
  return DEFAULT_MAX_UNSAVED_DRAFTS;
}

/**
 * Read the current quota snapshot for this user. Used by `GET /notes/draft-quota` so the SPA can
 * decide on page load whether the Generate button should be disabled.
 */
export async function readDraftQuotaForUser(
  userId: number,
  max: number,
): Promise<DraftQuota> {
  const [row] = await db
    .select({ used: usersTable.unsavedDraftCount })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const used = row?.used ?? 0;
  return { used: Math.min(used, max), max };
}

/**
 * Atomically reserve a slot. Returns `{ ok: true, used }` when the slot was taken; `{ ok: false,
 * used: max }` when the user is already at the cap. The single UPDATE … WHERE count < max … is
 * race-safe: two concurrent requests from two tabs cannot both succeed past the limit because
 * Postgres serialises the row write.
 */
export async function tryConsumeDraftSlot(
  userId: number,
  max: number,
): Promise<{ ok: true; used: number; max: number } | { ok: false; used: number; max: number }> {
  const updated = await db
    .update(usersTable)
    .set({
      unsavedDraftCount: sql`${usersTable.unsavedDraftCount} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(usersTable.id, userId), lt(usersTable.unsavedDraftCount, max)))
    .returning({ used: usersTable.unsavedDraftCount });
  if (updated.length > 0) {
    return { ok: true, used: updated[0].used, max };
  }
  const current = await readDraftQuotaForUser(userId, max);
  return { ok: false, used: current.used, max };
}

/**
 * Reset the user's slot pool to 0. Called by save (any save frees the entire pool) and by the
 * explicit discard endpoint. Returns the post-reset snapshot for the route handler to echo back.
 */
export async function resetDraftQuotaForUser(
  userId: number,
  max: number,
): Promise<DraftQuota> {
  await db
    .update(usersTable)
    .set({ unsavedDraftCount: 0, updatedAt: new Date() })
    .where(eq(usersTable.id, userId));
  return { used: 0, max };
}

/**
 * Calm SaaS copy the route returns in the 429 body. The frontend must surface this verbatim
 * (per product spec — "no technical wording about tokens / API costs / OpenAI"). Keep it short.
 */
export function draftCapMessage(max: number): string {
  return `You've reached the maximum of ${max} generated drafts. Save your preferred draft or discard the drafts to continue.`;
}
