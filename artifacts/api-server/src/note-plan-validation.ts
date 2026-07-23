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
const VAGUE_ANTECEDENT_PATTERN =
  /\b(?:during a transition activity|during play|when access was denied|after intervention|following the previous activity)\b/i;
const GENERIC_REINFORCEMENT_PATTERN = /\bdocumented reinforcement\b/i;
const FOLLOWING_INTERVENTION_RBT_PATTERN =
  /\bFollowing this intervention,\s+the RBT\b/i;
const FOLLOWING_INTERVENTION_CLIENT_PATTERN =
  /\bFollowing this intervention,\s+the client\b/i;
const CLIENT_OUTCOME_PATTERN =
  /\bthe client\b.{0,160}\b(?:stopp(?:ed|ing)|decreas(?:ed|ing)|return(?:ed|ing)|complet(?:ed|ing)|engag(?:ed|ing)|us(?:ed|ing)|select(?:ed|ing)|request(?:ed|ing)|walk(?:ed|ing)|sat|kept|remain(?:ed|ing)|approached|moved)\b/i;
const REINFORCEMENT_DELIVERY_ONLY_PATTERN =
  /\bFollowing this intervention,\s+(?:the RBT\s+)?(?:delivered|provided|gave|reinforced)\b/i;

function splitSentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function interventionFollowUpWindow(
  sentences: string[],
  namingIndex: number,
  interventionLabels: string[],
): string[] {
  const window: string[] = [];
  for (let i = namingIndex + 1; i < sentences.length; i += 1) {
    const sentence = sentences[i]!;
    if (
      interventionLabels.some((label) => sentence.includes(`The RBT implemented ${label}.`))
    ) {
      break;
    }
    if (/\b(?:replacement program|implemented the replacement)\b/i.test(sentence)) {
      break;
    }
    window.push(sentence);
    if (window.length >= 3) break;
  }
  return window;
}

function hasClientFocusedOutcome(followUp: string[]): boolean {
  const joined = followUp.join(" ");
  if (FOLLOWING_INTERVENTION_CLIENT_PATTERN.test(joined)) return true;
  return followUp.some((sentence) => CLIENT_OUTCOME_PATTERN.test(sentence));
}

function hasRbtOnlyOrReinforcementOnlyOutcome(followUp: string[]): boolean {
  const joined = followUp.join(" ");
  if (FOLLOWING_INTERVENTION_RBT_PATTERN.test(joined)) return true;
  if (
    REINFORCEMENT_DELIVERY_ONLY_PATTERN.test(joined) &&
    !FOLLOWING_INTERVENTION_CLIENT_PATTERN.test(joined)
  ) {
    return true;
  }
  return false;
}

type ReplacementSkillClass =
  | "fct_request"
  | "request_help"
  | "walk_safety"
  | "transition"
  | "time_on_task";

function replacementSkillClass(programName: string): ReplacementSkillClass | null {
  const name = programName.toLowerCase();
  if (/\brequest help\b|\basking for help\b|\bhelp\b/.test(name) && !/\bfct\b/.test(name)) {
    if (/\bhelp\b/.test(name)) return "request_help";
  }
  if (
    /\bfct\b|functional communication|request (?:a |for )?(?:break|item|attention|access)|requesting\b/.test(
      name,
    )
  ) {
    return "fct_request";
  }
  if (/\bwalk\b|close distance|safety skill|near (?:an? )?adult|caregiver\b/.test(name)) {
    return "walk_safety";
  }
  if (/\btransition\b|ablls-?r\s*code\s*n4\b/.test(name)) {
    return "transition";
  }
  if (/\btime on task\b|on[- ]task\b|remain(?:ing)? (?:seated|engaged)\b/.test(name)) {
    return "time_on_task";
  }
  return null;
}

function replacementSentenceReflectsSkill(
  paragraph: string,
  programName: string,
  skillClass: ReplacementSkillClass,
): boolean {
  const sentences = splitSentences(paragraph);
  const replacementSentence =
    sentences.find(
      (sentence) =>
        sentence.includes(programName) &&
        /\b(?:replacement program|implemented)\b/i.test(sentence),
    ) ??
    sentences.find((sentence) => sentence.includes(programName)) ??
    "";
  const programIndex = replacementSentence.indexOf(programName);
  const descriptive =
    programIndex >= 0
      ? replacementSentence.slice(programIndex + programName.length)
      : replacementSentence;
  switch (skillClass) {
    case "fct_request":
      return /\b(?:request|exchange|card|phrase|communicat)/i.test(descriptive);
    case "request_help":
      return /\b(?:help|assistance|assist)/i.test(descriptive);
    case "walk_safety":
      return /\b(?:walk|near|close|distance|adult|caregiver|stay(?:ed|ing)?)\b/i.test(
        descriptive,
      );
    case "transition":
      return /\b(?:transition|moved|walked|from|to the|between)\b/i.test(descriptive);
    case "time_on_task":
      return /\b(?:engaged|remain(?:ed|ing)|on task|materials|seated|work interval)/i.test(
        descriptive,
      );
    default:
      return true;
  }
}

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

    const sentences = splitSentences(segment.paragraph);
    for (const label of uniqueInterventions) {
      if (!ctx.profileInterventions.includes(label)) continue;
      const namingSentence = `The RBT implemented ${label}.`;
      const namingIndex = sentences.findIndex((sentence) => sentence.includes(namingSentence));
      if (namingIndex < 0) continue;
      const followUp = interventionFollowUpWindow(
        sentences,
        namingIndex,
        segment.interventionLabels,
      );
      if (
        followUp.length === 0 ||
        hasRbtOnlyOrReinforcementOnlyOutcome(followUp) ||
        !hasClientFocusedOutcome(followUp)
      ) {
        issues.push({
          code: "OUTCOME_NOT_CLIENT_FOCUSED",
          severity: "advisory",
          segmentIndex: assignment.segmentIndex,
          message: `Hour ${assignment.segmentIndex + 1} must document a client-observable outcome after "${label}" (not only the next RBT step or reinforcement delivery).`,
        });
      }
    }

    if (VAGUE_ANTECEDENT_PATTERN.test(segment.paragraph)) {
      issues.push({
        code: "VAGUE_ANTECEDENT",
        severity: "advisory",
        segmentIndex: assignment.segmentIndex,
        message: `Hour ${assignment.segmentIndex + 1} uses a vague antecedent; describe the concrete environmental trigger.`,
      });
    }
    if (
      ctx.reinforcementPreferences.length > 0 &&
      GENERIC_REINFORCEMENT_PATTERN.test(segment.paragraph)
    ) {
      issues.push({
        code: "GENERIC_REINFORCEMENT",
        severity: "advisory",
        segmentIndex: assignment.segmentIndex,
        message: `Hour ${assignment.segmentIndex + 1} should name a concrete reinforcer from the client's preferences instead of only "documented reinforcement".`,
      });
    }
    const skillClass = replacementSkillClass(assignment.programName);
    if (
      skillClass &&
      !replacementSentenceReflectsSkill(segment.paragraph, assignment.programName, skillClass)
    ) {
      issues.push({
        code: "REPLACEMENT_SKILL_UNCLEAR",
        severity: "advisory",
        segmentIndex: assignment.segmentIndex,
        message: `Hour ${assignment.segmentIndex + 1} should explain the skill practiced for "${assignment.programName}".`,
      });
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
