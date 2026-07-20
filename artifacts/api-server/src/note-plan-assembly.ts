import type { NotePlan, SessionContext } from "./note-plan-schema";
import { validateNotePlan } from "./note-plan-validation";

/** Lossless cleanup: normalize whitespace without changing clinical wording. */
export function normalizeFlexibleParagraph(paragraph: string): string {
  return paragraph.replace(/\s+/g, " ").trim();
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
  const issues = validateNotePlan(plan, ctx);
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => issue.message).join(" "));
  }
  return [...plan.segments]
    .sort((a, b) => a.segmentIndex - b.segmentIndex)
    .map((segment) => normalizeFlexibleParagraph(segment.paragraph))
    .join("\n\n");
}

export function preserveClinicalParagraphStructure(
  _before: string,
  after: string,
  expectedParagraphs: number,
): { text: string; restored: boolean } {
  const normalized = after
    .split(/\n\s*\n/)
    .map(normalizeFlexibleParagraph)
    .filter(Boolean)
    .join("\n\n");
  return {
    text: normalized,
    restored: countClinicalParagraphs(normalized) !== expectedParagraphs,
  };
}
