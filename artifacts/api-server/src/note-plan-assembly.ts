import type { NotePlan, SessionContext } from "./note-plan-schema";
import {
  blockingNotePlanIssues,
  validateNotePlan,
} from "./note-plan-validation";

/**
 * Replace dash punctuation with commas while preserving exact registered catalog text.
 * Hyphens inside words (for example, "age-appropriate") are not punctuation and remain.
 */
export function replaceDashPunctuation(
  text: string,
  protectedText: readonly string[] = [],
): string {
  const replacements = [...new Set(protectedText.map((value) => value.trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length)
    .map((value, index) => ({ value, token: `\uE000${index}\uE001` }));

  let result = text;
  for (const { value, token } of replacements) {
    result = result.split(value).join(token);
  }
  result = result
    .replace(/\s*[\u2013\u2014]\s*/g, ", ")
    .replace(/\s+-\s+/g, ", ")
    .replace(/,\s*,+/g, ", ");
  for (const { value, token } of replacements) {
    result = result.split(token).join(value);
  }
  return result;
}

/** Normalize model prose and enforce punctuation style without clinical rewriting. */
export function normalizeFlexibleParagraph(
  paragraph: string,
  protectedText: readonly string[] = [],
): string {
  return replaceDashPunctuation(paragraph, protectedText).replace(/\s+/g, " ").trim();
}

export function countClinicalParagraphs(body: string): number {
  return body
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean).length;
}

export function assembleClinicalBodyFromNotePlan(
  plan: NotePlan,
  ctx: SessionContext,
): string {
  const issues = blockingNotePlanIssues(validateNotePlan(plan, ctx));
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => issue.message).join(" "));
  }
  return [...plan.segments]
    .sort((a, b) => a.segmentIndex - b.segmentIndex)
    .map((segment) => {
      const assignment = ctx.hourlyAssignments.find(
        (candidate) => candidate.segmentIndex === segment.segmentIndex,
      );
      return normalizeFlexibleParagraph(segment.paragraph, [
        assignment?.programName ?? "",
        assignment?.activityHint ?? "",
        assignment?.behaviorHint ?? "",
        segment.behaviorLabel,
        ...segment.interventionLabels,
        ...ctx.profileBehaviors,
        ...ctx.profileInterventions,
        ...ctx.profileBehaviorTargets.flatMap((target) =>
          target.topography ? [target.name, target.topography] : [target.name],
        ),
      ]);
    })
    .join("\n\n");
}

export function preserveClinicalParagraphStructure(
  _before: string,
  after: string,
  expectedParagraphs: number,
): { text: string; restored: boolean } {
  const normalized = after
    .split(/\n\s*\n/)
    .map((paragraph) => normalizeFlexibleParagraph(paragraph))
    .filter(Boolean)
    .join("\n\n");
  return {
    text: normalized,
    restored: countClinicalParagraphs(normalized) !== expectedParagraphs,
  };
}
