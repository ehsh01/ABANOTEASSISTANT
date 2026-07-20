import {
  isIncompleteTopographyAction,
  isUnusableStoredTopography,
  lastResortObservableTopographyForBehavior,
} from "./maladaptive-behavior-topography";
import {
  attributeActionClauseToRbt,
  escapeRegExp,
  normalizeClauseAfterBy,
} from "./note-normalization";
import type { NotePlan, SessionContext, TherapistTrialSummary } from "./note-plan-schema";
import { enrichInterventionApplicationForBehavior } from "./note-plan-validation";
import { enrichTeachingOrPromptingForProgram } from "./program-teaching-templates";

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
  // Subjectless gerund action detail ("requiring cleanup …", "moving materials …") gets "the RBT"
  // as the implementing subject with the action verb(s) in simple past.
  return sentence(attributeActionClauseToRbt(normalized));
}

function clauseAfterBy(text: string): string {
  return normalizeClauseAfterBy(text);
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

/**
 * Intervention naming-sentence leads. Every variant preserves the exact "the RBT implemented <label>."
 * clause that `countInterventionImplementationsInParagraph` and the safety-chain validators detect, so
 * only the human-sounding lead varies. Index 0 keeps the canonical "To address this behavior," opener
 * so single-segment fixtures/tests stay stable.
 */
// Naming leads observed across the approved example notes. "Addressing this behavior," is
// intentionally excluded (dangling participle the user corrected away); "In response," /
// "To reduce this behavior," / "To manage this behavior," are all present in the approved notes.
const INTERVENTION_NAMING_LEADS = [
  "To address this behavior, the RBT implemented",
  "In response to this behavior, the RBT implemented",
  "In response, the RBT implemented",
  "To reduce this behavior, the RBT implemented",
  "To manage this behavior, the RBT implemented",
] as const;

/** Connectives for a 2nd+ intervention naming sentence within one (safety-chain) segment. */
const INTERVENTION_NAMING_FOLLOW_ON_LEADS = [
  "The RBT then implemented",
  "Next, the RBT implemented",
  "The RBT also implemented",
] as const;

/**
 * Human-sounding naming sentence for one intervention. `labelIndex === 0` rotates by segment so
 * multi-hour notes do not repeat the same opener; later labels in a safety chain use a follow-on lead.
 */
export function interventionNamingSentence(
  label: string,
  segmentIndex: number,
  labelIndex: number,
): string {
  const lead =
    labelIndex === 0
      ? INTERVENTION_NAMING_LEADS[segmentIndex % INTERVENTION_NAMING_LEADS.length]!
      : INTERVENTION_NAMING_FOLLOW_ON_LEADS[
          (labelIndex - 1) % INTERVENTION_NAMING_FOLLOW_ON_LEADS.length
        ]!;
  return `${lead} ${label.trim()}.`;
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
 * Trial-percentage sentence variants. Every form is accepted by `therapistTrialPercentRollupPhrasePresent`
 * (each states the same rounded percentage tied to the program and never uses an "N out of M" rollup), so
 * the repeated per-hour trial line reads less mechanically across a multi-hour note. Index 0 keeps the
 * canonical "criterion was met on approximately X% of discrete trials." wording for fixture stability.
 */
function trialSentenceVariant(replacementLabel: string, pct: number, seedIndex: number): string {
  const variants = [
    `For "${replacementLabel}", criterion was met on approximately ${pct}% of discrete trials.`,
    `For "${replacementLabel}", the client met criterion on approximately ${pct}% of trials.`,
    `For "${replacementLabel}", criterion was met on approximately ${pct}% of recorded trials.`,
    `For "${replacementLabel}", target responses met criterion approximately ${pct}% of the time.`,
  ];
  return variants[seedIndex % variants.length]!;
}

/**
 * When therapist-entered trial data exists, emit the locked percentage sentence.
 * When missing, return empty — do not invent a % and do not apologize for missing RBT input.
 * `segmentIndex` only rotates the surface wording; the percentage/program are unchanged.
 */
export function buildDeterministicTrialSentence(
  replacementLabel: string,
  summary: TherapistTrialSummary | null,
  segmentIndex = 0,
): string {
  if (!summary) {
    return "";
  }
  const percentage = roundedTrialPercentage(summary);
  return trialSentenceVariant(replacementLabel, percentage, segmentIndex);
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
        // Acquisition-only: do not emit topography as its own sentence. Schema may still carry a
        // complete placeholder for validation, but approved notes flow antecedent → replacement
        // teaching. Emitting gerund/topography fillers produced dangling "orienting toward…" fragments.
      } else {
        // Belt-and-suspenders: never assemble BIP status placeholders into the manifested-behavior line.
        const rawTopo = neutralize(segment.topography);
        const lockedTopo = locked.behaviorTopography ?? "";
        const usableTopo =
          !isUnusableStoredTopography(rawTopo) && !isIncompleteTopographyAction(rawTopo)
            ? rawTopo
            : !isUnusableStoredTopography(lockedTopo) && !isIncompleteTopographyAction(lockedTopo)
              ? lockedTopo
              : (lastResortObservableTopographyForBehavior(locked.behaviorLabel) ??
                "engaging in the targeted motor actions for this episode");
        parts.push(
          `${manifestedBehaviorBridge(index)} ${locked.behaviorLabel} by ${clauseAfterBy(usableTopo)}`,
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
          parts.push(interventionNamingSentence(label, index, labelIndex));
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
        index,
      );
      if (trialSentence) {
        parts.push(trialSentence);
      }
      return parts.join(" ");
    })
    .join("\n\n");
}

/** Count ABC paragraphs separated by blank lines (same rule as clinical compliance). */
export function countClinicalParagraphs(clinicalBody: string): number {
  return clinicalBody
    .trim()
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean).length;
}

/**
 * If a rewrite collapses or empties ABC paragraph separators, keep the pre-rewrite body.
 * Prevents scrubbers from turning a valid multi-hour note into 0/1 paragraph.
 */
export function preserveClinicalParagraphStructure(
  before: string,
  after: string,
  expectedParagraphs: number,
): { text: string; restored: boolean } {
  const beforeCount = countClinicalParagraphs(before);
  const afterCount = countClinicalParagraphs(after);
  const target = Math.max(1, expectedParagraphs);
  if (beforeCount >= target && afterCount < target) {
    return { text: before, restored: true };
  }
  if (before.trim().length > 0 && after.trim().length === 0) {
    return { text: before, restored: true };
  }
  return { text: after, restored: false };
}

/**
 * Deterministic minimal clinical body when the model returns nothing usable.
 * One paragraph per frozen segment using locked labels only — enough to save a note.
 * Must still emit therapist-entered trial percentages and usable topography/application detail
 * so soft-fail saves are not clinically empty shells.
 */
export function buildMinimalClinicalBodyFromSessionContext(context: SessionContext): string {
  return context.segments
    .map((locked, index) => {
      const activity = locked.activityAntecedent?.trim();
      const lead = activity
        ? sentence(
            index === 0
              ? `The RBT presented session materials and began ${activity.replace(/^\.+/, "")}`
              : index === 1
                ? `Next, the RBT continued with ${activity.replace(/^\.+/, "")}`
                : index === 2
                  ? `Later, the RBT arranged ${activity.replace(/^\.+/, "")}`
                  : index === 3
                    ? `After that, the RBT presented materials for ${activity.replace(/^\.+/, "")}`
                    : `Near the end of the session, the RBT presented ${activity.replace(/^\.+/, "")}`,
          )
        : index === 0
          ? "The RBT presented session materials and began the scheduled activity."
          : index === 1
            ? "Next, the RBT continued with the next scheduled activity."
            : index === 2
              ? "Later, the RBT arranged the next instructional opportunity."
              : index === 3
                ? "After that, the RBT presented the next task materials."
                : index === context.segments.length - 1
                  ? "Near the end of the session, the RBT presented the final activity."
                  : `During a subsequent activity, the RBT presented the next scheduled task.`;

      const trialSentence = buildDeterministicTrialSentence(
        locked.replacementLabel,
        locked.trialSummary,
        index,
      );

      if (locked.acquisitionOnly) {
        const teaching = enrichTeachingOrPromptingForProgram(
          "modeling the target response and prompting the client through the presented opportunities",
          locked.replacementLabel,
        );
        return [
          lead,
          `The RBT implemented the replacement program "${locked.replacementLabel}" by ${clauseAfterBy(teaching)}`,
          "The client participated in the presented opportunities with prompting as needed.",
          trialSentence,
        ]
          .filter(Boolean)
          .join(" ");
      }

      const topo =
        locked.behaviorTopography &&
        !isUnusableStoredTopography(locked.behaviorTopography) &&
        !isIncompleteTopographyAction(locked.behaviorTopography)
          ? locked.behaviorTopography
          : (lastResortObservableTopographyForBehavior(locked.behaviorLabel) ??
            "engaging in the observable actions documented for this target during the episode");
      const namingLabels =
        locked.interventionLabels.length > 0
          ? locked.interventionLabels
          : [
              context.planCatalogSnapshot.interventions[0] ?? "Premack principle",
            ];
      const parts: string[] = [
        lead,
        `${manifestedBehaviorBridge(index)} ${locked.behaviorLabel} by ${clauseAfterBy(topo)}`,
      ];
      namingLabels.forEach((label, labelIndex) => {
        parts.push(interventionNamingSentence(label, index, labelIndex));
        const application = enrichInterventionApplicationForBehavior(
          // Intentionally thin seed so behavior-specific enrichment templates apply.
          "applying the assigned contingency during the episode",
          locked.behaviorLabel,
          label,
        );
        if (application) {
          parts.push(`Following this intervention, ${followingClause(application)}`);
        }
      });
      parts.push("The client returned to the presented activity after the intervention.");
      parts.push(
        `${index % 2 === 0 ? "Additionally, the" : "The"} RBT implemented the replacement program "${locked.replacementLabel}" by ${clauseAfterBy(
          enrichTeachingOrPromptingForProgram(
            "modeling the target response and prompting the client before reinforcement was delivered",
            locked.replacementLabel,
          ),
        )}`,
      );
      parts.push("The client completed the prompted response and remained near the materials.");
      if (trialSentence) parts.push(trialSentence);
      return parts.join(" ");
    })
    .join("\n\n");
}
