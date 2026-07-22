import {
  NotePlanSchema,
  SessionContextSchema,
  type NotePlan,
  type SessionContext,
} from "./note-plan-schema";
import {
  paragraphReflectsStoredTopography,
  splitTopographyActionAlternatives,
} from "./maladaptive-behavior-topography";

export type NotePlanIssueCode = string;

export type NotePlanIssue = {
  code: NotePlanIssueCode;
  message: string;
  severity: "blocking" | "advisory";
  segmentIndex?: number;
};

export function blockingNotePlanIssues(issues: NotePlanIssue[]): NotePlanIssue[] {
  return issues.filter((issue) => issue.severity === "blocking");
}

export function buildFrozenSessionContext(ctx: SessionContext): SessionContext {
  return SessionContextSchema.parse(ctx);
}

export function toModelFacingSessionContext(ctx: SessionContext): SessionContext {
  return buildFrozenSessionContext(ctx);
}

function percentagePattern(percentage: number): RegExp {
  return new RegExp(`(^|[^0-9])${percentage}\\s*%(?![0-9])`);
}

const MENTALISTIC_PATTERN =
  /\b(?:frustrat(?:ed|ion)|anxious|anxiety|upset|angry|happy|sad|overwhelmed|comfortable|uncomfortable|avoidance|appeared|seemed|visibly)\b/i;
const UNSUPPORTED_TREND_PATTERN =
  /\b(?:baseline|previous session|prior session|improving|regressing|regression|maintaining|trend data)\b/i;
const OUTSIDE_HOME_SETTING_PATTERN =
  /\b(?:(?:in|into|near|along|toward|towards|at)\s+(?:the\s+)?(?:street|sidewalk|roadway|road|parking lot|neighborhood|park|playground|yard|backyard|front yard|driveway|porch|store|restaurant|school|clinic)|outside\s+(?:of\s+)?the\s+home|left\s+the\s+home)\b/i;
const MEDICATION_PATTERN =
  /\b(?:medicine|medicines|medication|medications|medicate|medicated|prescription|prescriptions|dosage|dosages|pharmaceutical|pharmaceuticals)\b/i;

export function validateNotePlan(
  plan: NotePlan,
  ctx: SessionContext,
): NotePlanIssue[] {
  const issues: NotePlanIssue[] = [];
  if (plan.segments.length !== ctx.sessionHours) {
    issues.push({
      code: "SEGMENT_COUNT",
      severity: "blocking",
      message: `Expected ${ctx.sessionHours} ABC paragraphs; received ${plan.segments.length}.`,
    });
  }

  for (const assignment of ctx.hourlyAssignments) {
    const segment = plan.segments.find((candidate) => candidate.segmentIndex === assignment.segmentIndex);
    if (!segment) {
      issues.push({
        code: "SEGMENT_INDEX",
        severity: "blocking",
        segmentIndex: assignment.segmentIndex,
        message: `Missing segmentIndex ${assignment.segmentIndex}.`,
      });
      continue;
    }
    if (!segment.paragraph.includes(assignment.programName)) {
      issues.push({
        code: "PROGRAM_MISSING",
        severity: "blocking",
        segmentIndex: assignment.segmentIndex,
        message: `Hour ${assignment.segmentIndex + 1} must include exact program "${assignment.programName}".`,
      });
    }
    if (!percentagePattern(assignment.criterionPercentage).test(segment.paragraph)) {
      issues.push({
        code: "PERCENTAGE_MISSING",
        severity: "blocking",
        segmentIndex: assignment.segmentIndex,
        message: `Hour ${assignment.segmentIndex + 1} must include exact percentage ${assignment.criterionPercentage}%.`,
      });
    }
    if (!ctx.profileBehaviors.includes(segment.behaviorLabel)) {
      issues.push({
        code: "BEHAVIOR_NOT_APPROVED",
        severity: "advisory",
        segmentIndex: assignment.segmentIndex,
        message: `Hour ${assignment.segmentIndex + 1} uses behavior "${segment.behaviorLabel}", which is not in the client's profile behavior list.`,
      });
    }
    if (assignment.behaviorHint && segment.behaviorLabel !== assignment.behaviorHint) {
      issues.push({
        code: "BEHAVIOR_HINT_MISMATCH",
        severity: "advisory",
        segmentIndex: assignment.segmentIndex,
        message: `Hour ${assignment.segmentIndex + 1} must use exact behavior hint "${assignment.behaviorHint}".`,
      });
    }
    if (!segment.paragraph.includes(segment.behaviorLabel)) {
      issues.push({
        code: "BEHAVIOR_LABEL_MISSING",
        severity: "advisory",
        segmentIndex: assignment.segmentIndex,
        message: `Hour ${assignment.segmentIndex + 1} must state exact behavior label "${segment.behaviorLabel}".`,
      });
    }
    const uniqueInterventions = new Set(segment.interventionLabels);
    if (segment.interventionLabels.length === 0) {
      issues.push({
        code: "INTERVENTION_REQUIRED",
        severity: "advisory",
        segmentIndex: assignment.segmentIndex,
        message: `Hour ${assignment.segmentIndex + 1} must use at least one approved intervention.`,
      });
    }
    if (uniqueInterventions.size !== segment.interventionLabels.length) {
      issues.push({
        code: "INTERVENTION_DUPLICATE",
        severity: "advisory",
        segmentIndex: assignment.segmentIndex,
        message: `Hour ${assignment.segmentIndex + 1} repeats an intervention label.`,
      });
    }
    for (const label of uniqueInterventions) {
      if (!ctx.profileInterventions.includes(label)) {
        issues.push({
          code: "INTERVENTION_NOT_APPROVED",
          severity: "advisory",
          segmentIndex: assignment.segmentIndex,
          message: `Hour ${assignment.segmentIndex + 1} uses unapproved intervention "${label}".`,
        });
        continue;
      }
      const namingSentence = `The RBT implemented ${label}.`;
      if (!segment.paragraph.includes(namingSentence)) {
        issues.push({
          code: "INTERVENTION_NAMING",
          severity: "advisory",
          segmentIndex: assignment.segmentIndex,
          message: `Hour ${assignment.segmentIndex + 1} must name "${label}" exactly as: "${namingSentence}"`,
        });
      }
    }
    if (MENTALISTIC_PATTERN.test(segment.paragraph)) {
      issues.push({
        code: "MENTALISTIC_LANGUAGE",
        severity: "advisory",
        segmentIndex: assignment.segmentIndex,
        message: `Hour ${assignment.segmentIndex + 1} contains inferred emotional or internal-state wording.`,
      });
    }
    if (UNSUPPORTED_TREND_PATTERN.test(segment.paragraph)) {
      issues.push({
        code: "UNSUPPORTED_TREND",
        severity: "advisory",
        segmentIndex: assignment.segmentIndex,
        message: `Hour ${assignment.segmentIndex + 1} makes an unsupported cross-session or baseline claim.`,
      });
    }
    if (OUTSIDE_HOME_SETTING_PATTERN.test(segment.paragraph)) {
      issues.push({
        code: "SETTING_OUTSIDE_HOME",
        severity: "advisory",
        segmentIndex: assignment.segmentIndex,
        message: `Hour ${assignment.segmentIndex + 1} places therapy outside the client's home.`,
      });
    }
    if (MEDICATION_PATTERN.test(segment.paragraph)) {
      issues.push({
        code: "MEDICATION_CONTENT",
        severity: "advisory",
        segmentIndex: assignment.segmentIndex,
        message: `Hour ${assignment.segmentIndex + 1} contains prohibited medicine or medication content.`,
      });
    }
    const target = ctx.profileBehaviorTargets.find(
      (candidate) => candidate.name === segment.behaviorLabel,
    );
    if (target?.topography) {
      const alternatives = splitTopographyActionAlternatives(target.topography);
      const registeredActions =
        alternatives.length > 0 ? alternatives : [target.topography];
      const behaviorSentence =
        segment.paragraph
          .split(/(?<=[.!?])\s+/)
          .find((sentence) => sentence.includes(segment.behaviorLabel)) ?? "";
      if (
        !registeredActions.some((action) =>
          paragraphReflectsStoredTopography(behaviorSentence, action, 3),
        )
      ) {
        issues.push({
          code: "TOPOGRAPHY_NOT_GROUNDED",
          severity: "advisory",
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
      issues: [
        {
          code: "INVALID_JSON",
          severity: "blocking",
          message: "Model output was not valid JSON.",
        },
      ],
    };
  }
  const parsed = NotePlanSchema.safeParse(decoded);
  if (!parsed.success) {
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
  }
  return { plan: parsed.data, issues: validateNotePlan(parsed.data, ctx) };
}
