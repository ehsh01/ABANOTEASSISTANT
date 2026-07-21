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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const MENTALISTIC_PATTERN =
  /\b(?:frustrat(?:ed|ion)|anxious|anxiety|upset|angry|happy|sad|overwhelmed|comfortable|uncomfortable)\b/i;
const UNSUPPORTED_TREND_PATTERN =
  /\b(?:baseline|previous session|prior session|improving|regressing|regression|maintaining|trend data)\b/i;
const INTERVENTION_CLAIM_PATTERN =
  /\b(?:implemented|applied|applying|used|utilized|incorporated)\s+([^.;,]+)/gi;
const TOPOGRAPHY_STOP_WORDS = new Set([
  "about", "after", "before", "behavior", "client", "during", "includes", "include",
  "instance", "more", "moving", "other", "seconds", "than", "their", "things", "with",
]);

function topographyTokens(topography: string): string[] {
  return [...new Set(
    topography
      .toLowerCase()
      .match(/[a-z]{5,}/g)
      ?.filter((token) => !TOPOGRAPHY_STOP_WORDS.has(token)) ?? [],
  )];
}

function exactApprovedLabelAtClaimStart(
  claim: string,
  approvedLabels: string[],
): string | null {
  if (/^(?:the\s+)?replacement program\b/i.test(claim.trim()) || /^["“]/.test(claim.trim())) {
    return "";
  }
  return approvedLabels.find((label) =>
    new RegExp(`^${escapeRegExp(label)}(?:\\b|\\s|\\(|$)`).test(claim.trim()),
  ) ?? null;
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
    if (!ctx.profileBehaviors.includes(segment.behaviorLabel)) {
      issues.push({
        code: "BEHAVIOR_NOT_APPROVED",
        segmentIndex: assignment.segmentIndex,
        message: `Hour ${assignment.segmentIndex + 1} uses behavior "${segment.behaviorLabel}", which is not in the client's profile behavior list.`,
      });
    }
    if (assignment.behaviorHint && segment.behaviorLabel !== assignment.behaviorHint) {
      issues.push({
        code: "BEHAVIOR_HINT_MISMATCH",
        segmentIndex: assignment.segmentIndex,
        message: `Hour ${assignment.segmentIndex + 1} must use exact behavior hint "${assignment.behaviorHint}".`,
      });
    }
    if (!segment.paragraph.includes(segment.behaviorLabel)) {
      issues.push({
        code: "BEHAVIOR_LABEL_MISSING",
        segmentIndex: assignment.segmentIndex,
        message: `Hour ${assignment.segmentIndex + 1} must state exact behavior label "${segment.behaviorLabel}".`,
      });
    }
    const uniqueInterventions = new Set(segment.interventionLabels);
    if (segment.interventionLabels.length === 0) {
      issues.push({
        code: "INTERVENTION_REQUIRED",
        segmentIndex: assignment.segmentIndex,
        message: `Hour ${assignment.segmentIndex + 1} must use at least one approved intervention.`,
      });
    }
    if (uniqueInterventions.size !== segment.interventionLabels.length) {
      issues.push({
        code: "INTERVENTION_DUPLICATE",
        segmentIndex: assignment.segmentIndex,
        message: `Hour ${assignment.segmentIndex + 1} repeats an intervention label.`,
      });
    }
    for (const label of uniqueInterventions) {
      if (!ctx.profileInterventions.includes(label)) {
        issues.push({
          code: "INTERVENTION_NOT_APPROVED",
          segmentIndex: assignment.segmentIndex,
          message: `Hour ${assignment.segmentIndex + 1} uses unapproved intervention "${label}".`,
        });
        continue;
      }
      const namingSentence = `The RBT implemented ${label}.`;
      if (!segment.paragraph.includes(namingSentence)) {
        issues.push({
          code: "INTERVENTION_NAMING",
          segmentIndex: assignment.segmentIndex,
          message: `Hour ${assignment.segmentIndex + 1} must name "${label}" exactly as: "${namingSentence}"`,
        });
      }
    }
    INTERVENTION_CLAIM_PATTERN.lastIndex = 0;
    for (const match of segment.paragraph.matchAll(INTERVENTION_CLAIM_PATTERN)) {
      const claim = match[1]?.trim() ?? "";
      const approvedLabel = exactApprovedLabelAtClaimStart(claim, ctx.profileInterventions);
      if (approvedLabel === null) {
        issues.push({
          code: "UNAPPROVED_INTERVENTION_CLAIM",
          segmentIndex: assignment.segmentIndex,
          message: `Hour ${assignment.segmentIndex + 1} contains an intervention-like claim not beginning with an exact approved label: "${claim}".`,
        });
      } else if (approvedLabel && !uniqueInterventions.has(approvedLabel)) {
        issues.push({
          code: "INTERVENTION_NOT_DECLARED",
          segmentIndex: assignment.segmentIndex,
          message: `Hour ${assignment.segmentIndex + 1} names approved intervention "${approvedLabel}" in prose but omits it from interventionLabels.`,
        });
      }
    }
    if (MENTALISTIC_PATTERN.test(segment.paragraph)) {
      issues.push({
        code: "MENTALISTIC_LANGUAGE",
        segmentIndex: assignment.segmentIndex,
        message: `Hour ${assignment.segmentIndex + 1} contains inferred emotional or internal-state wording.`,
      });
    }
    if (UNSUPPORTED_TREND_PATTERN.test(segment.paragraph)) {
      issues.push({
        code: "UNSUPPORTED_TREND",
        segmentIndex: assignment.segmentIndex,
        message: `Hour ${assignment.segmentIndex + 1} makes an unsupported cross-session or baseline claim.`,
      });
    }
    const target = ctx.profileBehaviorTargets.find(
      (candidate) => candidate.name === segment.behaviorLabel,
    );
    if (target?.topography) {
      const tokens = topographyTokens(target.topography);
      const behaviorSentence =
        segment.paragraph
          .split(/(?<=[.!?])\s+/)
          .find((sentence) => sentence.includes(segment.behaviorLabel)) ?? "";
      const lowerBehaviorSentence = behaviorSentence.toLowerCase();
      if (
        tokens.length > 0 &&
        !tokens.some((token) => lowerBehaviorSentence.includes(token))
      ) {
        issues.push({
          code: "TOPOGRAPHY_NOT_GROUNDED",
          segmentIndex: assignment.segmentIndex,
          message: `Hour ${assignment.segmentIndex + 1} must ground observable topography in the registered description for "${segment.behaviorLabel}".`,
        });
      }
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
