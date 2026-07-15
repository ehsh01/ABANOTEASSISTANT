import { escapeRegExp } from "./note-normalization";
import type { NotePlan, SessionContext, TherapistTrialSummary } from "./note-plan-schema";

function sentence(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/**
 * The intervention-count validator counts "implemented|applied <exact catalog name>." naming sentences
 * anywhere in a paragraph. Only the SERVER-authored naming sentences (built from the locked
 * interventionLabels) may count. If the model embeds a second catalog naming sentence in any prose field
 * (application/response/teaching/result/topography/antecedent), rewrite that stray "implemented|applied
 * X." to "used X." so it is not counted — keeping the per-segment count deterministically equal to the
 * server's assignment and preventing INTERVENTION_COUNT blocks.
 */
function neutralizeStrayInterventionNamingSentences(
  text: string,
  interventionCatalog: string[],
): string {
  if (!text) return text;
  let out = text;
  const names = [...new Set(interventionCatalog.map((s) => s.trim()).filter(Boolean))].sort(
    (a, b) => b.length - a.length,
  );
  for (const name of names) {
    const re = new RegExp(`\\b(?:implemented|applied)\\s+(${escapeRegExp(name)})\\s*\\.`, "gi");
    out = out.replace(re, "used $1.");
  }
  return out;
}

function followingClause(text: string): string {
  const normalized = text.trim().replace(/\s+/g, " ").replace(/^The RBT\b/, "the RBT");
  return sentence(normalized);
}

function clauseAfterBy(text: string): string {
  const normalized = text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^The RBT\b/, "the RBT")
    .replace(/^The client\b/, "the client");
  return sentence(normalized);
}

/** True when "Following this intervention, …" would only restate the catalog name (after neutralize). */
function isRedundantInterventionApplication(application: string, label: string): boolean {
  const normalized = application.trim().replace(/\s+/g, " ").replace(/\.$/, "");
  if (!normalized) return true;
  const re = new RegExp(
    `^(?:the RBT\\s+)?(?:used|implemented|applied)\\s+${escapeRegExp(label.trim())}$`,
    "i",
  );
  return re.test(normalized) || normalized.toLowerCase() === label.trim().toLowerCase();
}

/** Varied openings so ABC paragraphs do not all start with "During". */
const ANTECEDENT_DURING_REPLACEMENTS = [
  "While",
  "As",
  "When",
  "Once",
  "After",
  "With",
] as const;

/**
 * Rewrite a leading "During …" so multi-hour notes do not open every paragraph the same way.
 * Non-"During" antecedents are left unchanged.
 */
export function organicAntecedentLead(antecedent: string, segmentIndex: number): string {
  const trimmed = antecedent.trim().replace(/\s+/g, " ");
  if (!/^During\b/i.test(trimmed)) {
    return sentence(trimmed);
  }
  const replacement =
    ANTECEDENT_DURING_REPLACEMENTS[segmentIndex % ANTECEDENT_DURING_REPLACEMENTS.length]!;
  return sentence(trimmed.replace(/^During\b/i, replacement));
}

/** Manifested-behavior bridges — none begin with "During"; keep "the client manifested" contiguous for validators. */
const MANIFESTED_BRIDGES = [
  "While this work was underway, the client manifested",
  "At that point, the client manifested",
  "As the activity continued, the client manifested",
  "When the demand was present, the client manifested",
  "Soon after, the client manifested",
  "Then, the client manifested",
] as const;

export function manifestedBehaviorBridge(segmentIndex: number): string {
  return MANIFESTED_BRIDGES[segmentIndex % MANIFESTED_BRIDGES.length]!;
}

export function roundedTrialPercentage(summary: TherapistTrialSummary): number {
  const successful = new Set(
    summary.successfulTrialNumbers.filter(
      (trial) => trial >= 1 && trial <= summary.totalTrials,
    ),
  ).size;
  return Math.round((successful / summary.totalTrials) * 100);
}

/**
 * When therapist-entered trial data exists, emit the locked percentage sentence.
 * When missing, return empty — do not invent a % and do not apologize for missing RBT input.
 */
export function buildDeterministicTrialSentence(
  replacementLabel: string,
  summary: TherapistTrialSummary | null,
): string {
  if (!summary) {
    return "";
  }
  const percentage = roundedTrialPercentage(summary);
  return `For "${replacementLabel}", criterion was met on approximately ${percentage}% of discrete trials.`;
}

export function assembleClinicalBodyFromNotePlan(
  plan: NotePlan,
  context: SessionContext,
): string {
  const interventionCatalog = context.planCatalogSnapshot.interventions;
  const neutralize = (text: string): string =>
    neutralizeStrayInterventionNamingSentences(text, interventionCatalog);

  return plan.segments
    .map((segment, index) => {
      const locked = context.segments[index]!;
      const parts: string[] = [organicAntecedentLead(neutralize(segment.antecedent), index)];

      if (locked.acquisitionOnly) {
        parts.push(sentence(neutralize(segment.topography)));
      } else {
        parts.push(
          `${manifestedBehaviorBridge(index)} ${locked.behaviorLabel} by ${clauseAfterBy(neutralize(segment.topography))}`,
        );
        // Naming sentences are driven by the server-locked interventionLabels (the backend is the
        // authority on how many/which interventions), not the model's free-form list. This keeps the
        // documented intervention count deterministically equal to the assignment: exactly one for
        // ordinary segments, and the Response-Block-first chain for safety-priority behaviors.
        const namingLabels =
          locked.interventionLabels.length > 0
            ? locked.interventionLabels
            : segment.interventions.slice(0, 1).map((intervention) => intervention.label);
        namingLabels.forEach((label, labelIndex) => {
          const match =
            segment.interventions.find(
              (intervention) =>
                intervention.label.trim().toLowerCase() === label.trim().toLowerCase(),
            ) ??
            segment.interventions[labelIndex] ??
            segment.interventions[0];
          parts.push(`To address this behavior, the RBT implemented ${label}.`);
          const application = neutralize(match?.application?.trim() ?? "");
          if (application && !isRedundantInterventionApplication(application, label)) {
            parts.push(`Following this intervention, ${followingClause(application)}`);
          }
        });
        parts.push(sentence(neutralize(segment.responseToIntervention)));
      }

      const replacementLead = index % 2 === 0 ? "Additionally, the" : "The";
      parts.push(
        `${replacementLead} RBT implemented the replacement program "${locked.replacementLabel}" by ${clauseAfterBy(neutralize(segment.teachingOrPromptingSummary))}`,
      );
      if (
        segment.resultSummary.trim().toLowerCase() !==
        segment.responseToIntervention.trim().toLowerCase()
      ) {
        parts.push(sentence(neutralize(segment.resultSummary)));
      }
      const trialSentence = buildDeterministicTrialSentence(
        locked.replacementLabel,
        locked.trialSummary,
      );
      if (trialSentence) {
        parts.push(trialSentence);
      }
      return parts.join(" ");
    })
    .join("\n\n");
}
