import type { NotePlan, SessionContext, TherapistTrialSummary } from "./note-plan-schema";

function sentence(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function followingClause(text: string): string {
  const normalized = text.trim().replace(/\s+/g, " ").replace(/^The RBT\b/, "the RBT");
  return sentence(normalized);
}

export function roundedTrialPercentage(summary: TherapistTrialSummary): number {
  const successful = new Set(
    summary.successfulTrialNumbers.filter(
      (trial) => trial >= 1 && trial <= summary.totalTrials,
    ),
  ).size;
  return Math.round((successful / summary.totalTrials) * 100);
}

export function buildDeterministicTrialSentence(
  replacementLabel: string,
  summary: TherapistTrialSummary | null,
): string {
  if (!summary) {
    return `The RBT documented implementation of "${replacementLabel}" without a discrete-trial percentage because no therapist-entered trial summary was available.`;
  }
  const percentage = roundedTrialPercentage(summary);
  return `For "${replacementLabel}", criterion was met on approximately ${percentage}% of discrete trials.`;
}

export function assembleClinicalBodyFromNotePlan(
  plan: NotePlan,
  context: SessionContext,
): string {
  return plan.segments
    .map((segment, index) => {
      const locked = context.segments[index]!;
      const parts: string[] = [sentence(segment.antecedent)];

      if (locked.acquisitionOnly) {
        parts.push(sentence(segment.topography));
      } else {
        parts.push(
          `During this activity, the client manifested ${locked.behaviorLabel} by ${sentence(segment.topography)}`,
        );
        for (const intervention of segment.interventions) {
          parts.push(`To address this behavior, the RBT implemented ${intervention.label}.`);
          parts.push(`Following this intervention, ${followingClause(intervention.application)}`);
        }
        parts.push(sentence(segment.responseToIntervention));
      }

      const replacementLead = index % 2 === 0 ? "Additionally, the" : "The";
      parts.push(
        `${replacementLead} RBT implemented the replacement program "${locked.replacementLabel}" by ${sentence(segment.teachingOrPromptingSummary)}`,
      );
      parts.push(sentence(segment.resultSummary));
      parts.push(buildDeterministicTrialSentence(locked.replacementLabel, locked.trialSummary));
      return parts.join(" ");
    })
    .join("\n\n");
}
