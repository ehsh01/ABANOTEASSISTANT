import {
  NotePlanSchema,
  SessionContextSchema,
  type NotePlan,
  type SessionContext,
} from "./note-plan-schema";

export type NotePlanIssueCode = string;

export type NotePlanIssue = {
  code: NotePlanIssueCode;
  message: string;
  segmentIndex?: number;
};

export function buildFrozenSessionContext(ctx: SessionContext): SessionContext {
  return SessionContextSchema.parse(ctx);
}

export function toModelFacingSessionContext(ctx: SessionContext): SessionContext {
  return buildFrozenSessionContext(ctx);
}

function percentagePattern(percentage: number): RegExp {
  return new RegExp(`(^|[^0-9])${percentage}\\s*%(?![0-9])`);
}

export function validateNotePlan(
  plan: NotePlan,
  ctx: SessionContext,
): NotePlanIssue[] {
  const issues: NotePlanIssue[] = [];
  if (plan.segments.length !== ctx.sessionHours) {
    issues.push({
      code: "SEGMENT_COUNT",
      message: `Expected ${ctx.sessionHours} ABC paragraphs; received ${plan.segments.length}.`,
    });
  }

  for (const assignment of ctx.hourlyAssignments) {
    const segment = plan.segments.find((candidate) => candidate.segmentIndex === assignment.segmentIndex);
    if (!segment) {
      issues.push({
        code: "SEGMENT_INDEX",
        segmentIndex: assignment.segmentIndex,
        message: `Missing segmentIndex ${assignment.segmentIndex}.`,
      });
      continue;
    }
    if (!segment.paragraph.includes(assignment.programName)) {
      issues.push({
        code: "PROGRAM_MISSING",
        segmentIndex: assignment.segmentIndex,
        message: `Hour ${assignment.segmentIndex + 1} must include exact program "${assignment.programName}".`,
      });
    }
    if (!percentagePattern(assignment.criterionPercentage).test(segment.paragraph)) {
      issues.push({
        code: "PERCENTAGE_MISSING",
        segmentIndex: assignment.segmentIndex,
        message: `Hour ${assignment.segmentIndex + 1} must include exact percentage ${assignment.criterionPercentage}%.`,
      });
    }
  }
  return issues;
}

export function parseAndValidateNotePlan(
  raw: string,
  ctx: SessionContext,
): { plan: NotePlan | null; issues: NotePlanIssue[] } {
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return {
      plan: null,
      issues: [{ code: "INVALID_JSON", message: "Model output was not valid JSON." }],
    };
  }
  const parsed = NotePlanSchema.safeParse(decoded);
  if (!parsed.success) {
    return {
      plan: null,
      issues: [{ code: "INVALID_JSON", message: parsed.error.message }],
    };
  }
  return { plan: parsed.data, issues: validateNotePlan(parsed.data, ctx) };
}
