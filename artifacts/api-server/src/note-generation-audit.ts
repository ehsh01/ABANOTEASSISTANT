import { createHash } from "node:crypto";
import type { InsertNoteGenerationAudit } from "@workspace/db/schema";
import type { NoteGenerationAttemptTelemetry } from "./openai-notes";

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashAuditArtifact(value: unknown): string {
  const serialized = typeof value === "string" ? value : stableJson(value);
  return createHash("sha256").update(serialized).digest("hex");
}

/** Stable SHA-256 of the generation context so identical inputs are traceable across attempts. */
export function hashNoteGenerationContext(ctx: unknown): string {
  return hashAuditArtifact(ctx);
}

function contentStorageEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NOTE_AUDIT_STORE_CONTENT?.trim().toLowerCase() === "true";
}

function parseRawOutput(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export type BuildNoteGenerationAuditEntryInput = Pick<
  InsertNoteGenerationAudit,
  | "companyId"
  | "clientId"
  | "noteId"
  | "model"
  | "promptVersion"
  | "contextHash"
  | "promptHash"
  | "sessionDate"
  | "sessionHours"
  | "repairAttempts"
  | "validatorIssues"
  | "criticalIssues"
  | "finalStatus"
> & {
  assessmentFilename?: string | null;
  assessmentText?: string | null;
  assessmentExcerptLength?: number | null;
  assessmentExcerptTruncated?: boolean;
  attemptHistory?: NoteGenerationAttemptTelemetry[];
  finalValidatorIssues?: AuditIssueDescriptor[];
  finalCriticalIssues?: AuditIssueDescriptor[];
  repairActions?: string[];
  warnings?: string[];
  rawModelOutputs?: string[];
  clinicalBody?: string | null;
  finalNoteText?: string | null;
  accuracyReport?: NoteAccuracyReportSummary | null;
  env?: NodeJS.ProcessEnv;
};

/** Minimal shape needed for audit persistence; mirrors `NoteAccuracyReport` in note-accuracy-report.ts. */
export type NoteAccuracyReportSummary = {
  confidence: string;
  selectionHonored: boolean;
  assessmentGrounded: boolean;
  alteredSelections: unknown[];
};

export type AuditIssueDescriptor = {
  code: string;
  severity?: string | undefined;
  paragraphIndex?: number | undefined;
  segmentIndex?: number | undefined;
};

function uniqueIssueCodes(issues: AuditIssueDescriptor[] | undefined): string[] {
  return [...new Set((issues ?? []).map((issue) => issue.code).filter(Boolean))];
}

function redactedPlanIssue(issue: NoteGenerationAttemptTelemetry["planIssues"][number]) {
  return {
    code: issue.code,
    ...(issue.segmentIndex === undefined ? {} : { segmentIndex: issue.segmentIndex }),
  };
}

function redactedProseIssue(issue: NoteGenerationAttemptTelemetry["proseIssues"][number]) {
  return {
    code: issue.code,
    severity: issue.severity,
    ...(issue.paragraphIndex === undefined ? {} : { paragraphIndex: issue.paragraphIndex }),
  };
}

/** Pure builder shared by saved, blocked, and model-failed audit paths. */
export function buildNoteGenerationAuditEntry(
  input: BuildNoteGenerationAuditEntryInput,
): InsertNoteGenerationAudit {
  const attempts = input.attemptHistory ?? [];
  const usageRows = attempts.flatMap((attempt) => (attempt.usage ? [attempt.usage] : []));
  const sum = (key: keyof (typeof usageRows)[number]): number | null =>
    usageRows.length > 0
      ? usageRows.reduce((total, usage) => total + usage[key], 0)
      : null;
  const storeContent = contentStorageEnabled(input.env);
  const finalValidatorIssueCodes = uniqueIssueCodes(input.finalValidatorIssues);
  const finalCriticalIssueCodes = uniqueIssueCodes(input.finalCriticalIssues);
  const validatorIssues = input.validatorIssues ?? [];
  const criticalIssues = input.criticalIssues ?? [];

  return {
    companyId: input.companyId,
    clientId: input.clientId,
    noteId: input.noteId,
    model: input.model,
    promptVersion: input.promptVersion,
    contextHash: input.contextHash,
    promptHash: input.promptHash,
    assessmentFilename: storeContent ? (input.assessmentFilename ?? null) : null,
    assessmentHash: input.assessmentText ? hashAuditArtifact(input.assessmentText) : null,
    assessmentExcerptLength: input.assessmentExcerptLength ?? null,
    assessmentExcerptTruncated: input.assessmentExcerptTruncated ?? false,
    sessionDate: input.sessionDate,
    sessionHours: input.sessionHours,
    repairAttempts: input.repairAttempts,
    validatorIssues: storeContent ? validatorIssues : [],
    criticalIssues: storeContent ? criticalIssues : [],
    finalValidatorIssueCodes,
    finalCriticalIssueCodes,
    validatorIssueCount:
      input.finalValidatorIssues?.length ?? validatorIssues.length,
    criticalIssueCount:
      input.finalCriticalIssues?.length ?? criticalIssues.length,
    warningCount: (input.warnings ?? []).length,
    structuredPlanHistory: attempts.map((attempt) => ({
      attempt: attempt.attempt,
      passed: attempt.passed && attempt.planIssues.length === 0,
      issues: storeContent
        ? attempt.planIssues
        : attempt.planIssues.map(redactedPlanIssue),
    })),
    proseIssueHistory: attempts.map((attempt) => ({
      attempt: attempt.attempt,
      passed: attempt.passed && attempt.proseIssues.every((issue) => issue.severity !== "blocking"),
      issues: storeContent
        ? attempt.proseIssues
        : attempt.proseIssues.map(redactedProseIssue),
    })),
    repairActions: storeContent ? (input.repairActions ?? []) : [],
    warnings: storeContent ? (input.warnings ?? []) : [],
    latencyMs: attempts.reduce((total, attempt) => total + attempt.latencyMs, 0),
    promptTokens: sum("promptTokens"),
    completionTokens: sum("completionTokens"),
    totalTokens: sum("totalTokens"),
    completionIds: attempts.flatMap((attempt) =>
      attempt.completionId ? [attempt.completionId] : [],
    ),
    clinicalBodyHash: input.clinicalBody ? hashAuditArtifact(input.clinicalBody) : null,
    finalNoteHash: input.finalNoteText ? hashAuditArtifact(input.finalNoteText) : null,
    accuracyConfidence: input.accuracyReport?.confidence ?? null,
    accuracySelectionHonored: input.accuracyReport?.selectionHonored ?? null,
    accuracyAssessmentGrounded: input.accuracyReport?.assessmentGrounded ?? null,
    accuracyAlteredCount: input.accuracyReport
      ? input.accuracyReport.alteredSelections.length
      : null,
    accuracyReport: storeContent ? (input.accuracyReport ?? null) : null,
    rawModelJson: storeContent
      ? (input.rawModelOutputs ?? []).map(parseRawOutput)
      : null,
    finalNoteText: storeContent ? (input.finalNoteText ?? null) : null,
    finalStatus: input.finalStatus,
  };
}

/**
 * Best-effort append to `note_generation_audit`. Audit persistence must never block or fail the
 * note-generation response, so all errors are logged and swallowed.
 */
export async function writeNoteGenerationAudit(entry: InsertNoteGenerationAudit): Promise<void> {
  try {
    const [{ db }, { noteGenerationAuditTable }] = await Promise.all([
      import("@workspace/db"),
      import("@workspace/db/schema"),
    ]);
    await db
      .insert(noteGenerationAuditTable)
      .values(entry as typeof noteGenerationAuditTable.$inferInsert);
  } catch (err) {
    console.error(
      `[notes/generate] audit write failed (status=${entry.finalStatus} clientId=${entry.clientId}):`,
      err,
    );
  }
}
