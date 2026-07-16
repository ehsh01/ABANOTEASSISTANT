/**
 * Summarize historical note-generation quality by model from the `abanote.note_generation_audit`
 * table. Groups every recorded generation by model + prompt version and reports average issue
 * counts, repair passes, saved/blocked rates, latency, and tokens — plus the most frequent
 * validator issue codes per model.
 *
 * This only reflects models that have actually run in production. If you have only ever run one
 * model, use scripts/model-eval.mts for a controlled A/B against fixtures instead.
 *
 * Usage (from artifacts/api-server):
 *   DATABASE_URL=postgres://... npx tsx scripts/model-audit-summary.mts
 *   DATABASE_URL=postgres://... npx tsx scripts/model-audit-summary.mts --since=2026-06-01
 *
 * Flags:
 *   --since=YYYY-MM-DD   Only include audit rows created on/after this date (default: all rows)
 */
import { pool } from "@workspace/db";

function getArg(name: string): string | undefined {
  return process.argv
    .slice(2)
    .find((a) => a.startsWith(`--${name}=`))
    ?.split("=")
    .slice(1)
    .join("=");
}

async function main(): Promise<void> {
  const since = getArg("since");
  const params: unknown[] = [];
  let where = "";
  if (since) {
    params.push(since);
    where = `WHERE created_at >= $1`;
  }

  const summary = await pool.query(
    `
    SELECT
      model,
      prompt_version,
      count(*)                                       AS notes,
      round(avg(critical_issue_count)::numeric, 2)   AS avg_critical,
      round(avg(validator_issue_count)::numeric, 2)  AS avg_validator,
      round(avg(warning_count)::numeric, 2)          AS avg_warnings,
      round(avg(repair_attempts)::numeric, 2)        AS avg_repairs,
      round(avg(latency_ms)::numeric, 0)             AS avg_latency_ms,
      round(avg(total_tokens)::numeric, 0)           AS avg_tokens,
      round(100.0 * sum((final_status = 'saved')::int) / count(*), 1)            AS saved_pct,
      round(100.0 * sum((final_status = 'blocked_critical')::int) / count(*), 1) AS blocked_pct,
      round(100.0 * sum((final_status = 'model_failed')::int) / count(*), 1)     AS model_failed_pct
    FROM abanote.note_generation_audit
    ${where}
    GROUP BY model, prompt_version
    ORDER BY model, prompt_version
    `,
    params,
  );

  if (summary.rows.length === 0) {
    console.log("No audit rows found for the given filter.");
    await pool.end();
    return;
  }

  console.log("\n=== Note-generation quality by model (from audit history) ===");
  console.table(summary.rows);

  const codes = await pool.query(
    `
    SELECT model, code, count(*) AS hits
    FROM abanote.note_generation_audit,
         jsonb_array_elements_text(final_validator_issue_codes) AS code
    ${where}
    GROUP BY model, code
    ORDER BY model, hits DESC
    `,
    params,
  );

  console.log("\n=== Top validator issue codes per model ===");
  const byModel = new Map<string, { code: string; hits: number }[]>();
  for (const row of codes.rows as { model: string; code: string; hits: string }[]) {
    const list = byModel.get(row.model) ?? [];
    list.push({ code: row.code, hits: Number(row.hits) });
    byModel.set(row.model, list);
  }
  for (const [model, list] of byModel) {
    const top = list
      .slice(0, 10)
      .map((r) => `${r.code}:${r.hits}`)
      .join(", ");
    console.log(`${model}: ${top}`);
  }

  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
