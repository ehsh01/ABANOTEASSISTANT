import type { ClinicalFunction } from "@workspace/db/schema";
import {
  findNonContingentReinforcementInterventionLabel,
  isDraOrDriInterventionLabel,
  isResponseBlockInterventionLabel,
  isSibMaladaptiveBehaviorLabel,
  orderedAttentionFunctionInterventions,
  preferredInterventionCandidatesForBehaviorFunction,
} from "./behavior-function-intervention-mapping";
import { assignedBehaviorAllowsResponseBlockSafetyChain } from "./response-block-eligibility";
import { primaryFunctionForReplacementSelection } from "./behavior-function-replacement-mapping";

export { assignedBehaviorAllowsResponseBlockSafetyChain } from "./response-block-eligibility";

/** Prose mention of any non-contingent reinforcement (NCR) variant. */
const NCR_PRESENCE_RE =
  /attention independent response delivery|attention independent|non-?contingent reinforcement|\bNCR\b|time-?contingent attention/i;

/** True when the paragraph already documents a non-contingent reinforcement (NCR) intervention. */
export function paragraphDocumentsNonContingentReinforcement(paragraph: string): boolean {
  return NCR_PRESENCE_RE.test(paragraph);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Exact intervention string from the client's list when it is a response-blocking safety label. */
export function findResponseBlockInterventionLabel(interventions: string[]): string | null {
  for (const raw of interventions) {
    const s = raw.trim();
    if (s.length === 0) continue;
    if (isResponseBlockInterventionLabel(s)) return s;
  }
  return null;
}

/** Assigned maladaptive labels that may use Response Block + function intervention safety chains. */
export function interventionTailAfterManifestedBehavior(paragraph: string): string {
  const m = /\bthe client manifested\b/i.exec(paragraph);
  if (!m || m.index === undefined) return paragraph;
  const after = paragraph.slice(m.index);
  const dot = after.indexOf(".");
  return dot >= 0 ? after.slice(dot + 1) : after;
}

/**
 * First catalog intervention named with implemented/applied + period (case-insensitive label match).
 */
export function firstNamedInterventionInConsequenceTail(
  text: string,
  interventionNames: string[],
): string | null {
  const names = [...new Set(interventionNames.map((s) => s.trim()).filter((s) => s.length > 0))].sort(
    (a, b) => b.length - a.length,
  );
  let bestIdx = Infinity;
  let bestName: string | null = null;
  for (const name of names) {
    const re = new RegExp(`(?:implemented|applied)\\s+${escapeRegExp(name)}\\s*\\.`, "i");
    const m = re.exec(text);
    if (m && m.index < bestIdx) {
      bestIdx = m.index;
      bestName = name;
    }
  }
  return bestName;
}

/** True when Response Block is the first catalog intervention naming sentence after manifested behavior. */
export function paragraphHasResponseBlockFirst(
  paragraph: string,
  responseBlockLabel: string,
  interventionList: string[],
): boolean {
  const tail = interventionTailAfterManifestedBehavior(paragraph);
  const first = firstNamedInterventionInConsequenceTail(tail, interventionList);
  if (!first || !isResponseBlockInterventionLabel(first)) return false;
  return first.trim().toLowerCase() === responseBlockLabel.trim().toLowerCase();
}

/** True when a function-aligned catalog intervention is named after response blocking. */
export function hasFunctionMatchedInterventionAfterResponseBlock(
  paragraph: string,
  responseBlockLabel: string,
  functionCandidates: string[],
): boolean {
  if (functionCandidates.length === 0) return false;
  const tail = interventionTailAfterManifestedBehavior(paragraph);
  const blockRe = new RegExp(
    `(?:implemented|applied)\\s+${escapeRegExp(responseBlockLabel)}\\s*\\.`,
    "i",
  );
  const blockMatch = blockRe.exec(tail);
  if (!blockMatch) return false;
  const afterBlock = tail.slice(blockMatch.index + blockMatch[0].length);
  const names = [...new Set(functionCandidates.map((s) => s.trim()).filter((s) => s.length > 0))].sort(
    (a, b) => b.length - a.length,
  );
  for (const name of names) {
    const re = new RegExp(`(?:implemented|applied)\\s+${escapeRegExp(name)}\\s*\\.`, "i");
    if (re.test(afterBlock)) return true;
  }
  return false;
}

/**
 * Pick the second catalog intervention for a Response Block safety chain.
 * Uses per-segment candidates when present; otherwise function-filtered list; then SIB/PA fallbacks.
 */
export function selectSecondSafetyChainIntervention(params: {
  assignedBehavior: string;
  interventions: string[];
  behaviorFunctions: ClinicalFunction[] | null | undefined;
  interventionCandidatesForHour?: string[] | undefined;
}): string | null {
  const { assignedBehavior, interventions, behaviorFunctions, interventionCandidatesForHour } = params;
  const nonRb = (list: string[]) =>
    list.filter((s) => s.trim().length > 0 && !isResponseBlockInterventionLabel(s));

  const hourCandidates = nonRb(interventionCandidatesForHour ?? []);
  if (hourCandidates.length > 0) {
    if (
      isSibMaladaptiveBehaviorLabel(assignedBehavior) &&
      primaryFunctionForReplacementSelection(behaviorFunctions) === "attention"
    ) {
      const dra = hourCandidates.find(isDraOrDriInterventionLabel);
      if (dra) return dra;
    }
    return hourCandidates[0]!;
  }

  const preferred = nonRb(
    preferredInterventionCandidatesForBehaviorFunction(
      interventions,
      behaviorFunctions,
      assignedBehavior,
    ),
  );
  if (preferred.length > 0) {
    return preferred[0]!;
  }

  if (isSibMaladaptiveBehaviorLabel(assignedBehavior)) {
    const attentionOrdered = nonRb(orderedAttentionFunctionInterventions(interventions));
    const dra = attentionOrdered.find(isDraOrDriInterventionLabel);
    if (dra) return dra;
    if (attentionOrdered.length > 0) return attentionOrdered[0]!;
  }

  const escapeFirst = nonRb(interventions).find((s) => /escape extinction|demand fading/i.test(s));
  if (escapeFirst && /\baggression\b/i.test(assignedBehavior)) return escapeFirst;

  const anyNonRb = nonRb(interventions);
  return anyNonRb[0] ?? null;
}

function followingDetailForFunctionIntervention(
  label: string,
  primary: ClinicalFunction | null,
): string {
  if (isDraOrDriInterventionLabel(label) || primary === "attention") {
    return "Following this intervention, attention was withheld during the maladaptive response and brief praise was delivered when the client displayed compatible behavior oriented toward the task.";
  }
  if (primary === "escape") {
    return "Following this intervention, the RBT re-presented the instruction and reinforced compliance with brief praise when the client completed a prompted step.";
  }
  if (primary === "tangible") {
    return "Following this intervention, access to preferred items was withheld during the topography and was delivered contingent on appropriate requesting or waiting.";
  }
  return "Following this intervention, the RBT withheld reinforcement during the topography and delivered brief praise when the client displayed compatible replacement behavior.";
}

/** Normalize Response Block spelling in paragraph to exact catalog label. */
function normalizeResponseBlockLabelInParagraph(paragraph: string, responseBlockLabel: string): string {
  const re = new RegExp(
    `((?:implemented|applied)\\s+)response\\s+block(?:ing)?(\\s*\\.)`,
    "gi",
  );
  return paragraph.replace(re, `$1${responseBlockLabel}$2`);
}

/**
 * Deterministically insert a function-matched second catalog intervention after Response Block
 * when the paragraph documents Response Block alone (safety chain incomplete).
 */
export function injectMissingSafetyChainFunctionIntervention(
  clinicalBody: string,
  params: {
    narrativeSegmentCount: number;
    maladaptiveBehaviorForHour: string[];
    acquisitionOnlySegmentForHour?: boolean[] | undefined;
    interventions: string[];
    maladaptiveBehaviorFunctionsForHour?: (ClinicalFunction[] | null)[] | undefined;
    interventionCandidatesForHour?: string[][] | undefined;
  },
): string {
  const responseBlockLabel = findResponseBlockInterventionLabel(params.interventions);
  if (!responseBlockLabel) return clinicalBody;

  const paragraphs = clinicalBody.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const segCount = params.narrativeSegmentCount;
  const acquisition = params.acquisitionOnlySegmentForHour ?? [];

  for (let i = 0; i < Math.min(paragraphs.length, segCount); i++) {
    if (acquisition[i] === true) continue;
    const assignedBehavior = params.maladaptiveBehaviorForHour[i]?.trim() ?? "";
    if (!assignedBehavior || !assignedBehaviorAllowsResponseBlockSafetyChain(assignedBehavior)) {
      continue;
    }
    if (!/\bthe client manifested\b/i.test(paragraphs[i]!)) continue;

    let p = normalizeResponseBlockLabelInParagraph(paragraphs[i]!, responseBlockLabel);
    if (!paragraphHasResponseBlockFirst(p, responseBlockLabel, params.interventions)) continue;

    const segmentFunctions = params.maladaptiveBehaviorFunctionsForHour?.[i];
    const candidates =
      params.interventionCandidatesForHour?.[i]?.filter((s) => !isResponseBlockInterventionLabel(s)) ??
      preferredInterventionCandidatesForBehaviorFunction(
        params.interventions,
        segmentFunctions,
        assignedBehavior,
      ).filter((s) => !isResponseBlockInterventionLabel(s));

    if (
      hasFunctionMatchedInterventionAfterResponseBlock(p, responseBlockLabel, candidates.length > 0 ? candidates : nonRbFallback(params.interventions))
    ) {
      paragraphs[i] = p;
      continue;
    }

    const secondLabel = selectSecondSafetyChainIntervention({
      assignedBehavior,
      interventions: params.interventions,
      behaviorFunctions: segmentFunctions,
      interventionCandidatesForHour: params.interventionCandidatesForHour?.[i],
    });
    if (!secondLabel) continue;

    const primary = primaryFunctionForReplacementSelection(segmentFunctions);
    const naming = `The RBT implemented ${secondLabel}.`;
    const detail = followingDetailForFunctionIntervention(secondLabel, primary);
    const insertBlock = ` ${naming} ${detail}`;

    const replacementRe =
      /(\s*)(Additionally,\s*)?the RBT implemented the replacement program\b/i;
    const replacementMatch = replacementRe.exec(p);
    if (replacementMatch && replacementMatch.index !== undefined) {
      p = p.slice(0, replacementMatch.index) + insertBlock + p.slice(replacementMatch.index);
    } else {
      p = p.trimEnd() + insertBlock;
    }
    paragraphs[i] = p;
  }

  return paragraphs.join("\n\n");
}

function nonRbFallback(interventions: string[]): string[] {
  return interventions.filter((s) => s.trim().length > 0 && !isResponseBlockInterventionLabel(s));
}

/**
 * Deterministically append a non-contingent reinforcement (NCR) naming sentence to an
 * attention-maintained SIB paragraph that already documents its chain but omits NCR.
 *
 * NCR (Attention Independent Response Delivery) is the BIP-mapped intervention that targets the
 * attention *contingency* maintaining SIB. Response Block manages topography and DRA reinforces an
 * alternative behavior, but neither reduces the reinforcing value of attention on its own. When NCR
 * is on the client's approved intervention list it must appear alongside the rest of the chain to
 * pass function-completeness / audit review. This runs after the DRA safety-chain injection so the
 * ordering stays Response Block → DRA → NCR → replacement program.
 */
export function injectMissingAttentionNcrIntervention(
  clinicalBody: string,
  params: {
    narrativeSegmentCount: number;
    maladaptiveBehaviorForHour: string[];
    acquisitionOnlySegmentForHour?: boolean[] | undefined;
    interventions: string[];
    maladaptiveBehaviorFunctionsForHour?: (ClinicalFunction[] | null)[] | undefined;
  },
): string {
  const ncrLabel = findNonContingentReinforcementInterventionLabel(params.interventions);
  if (!ncrLabel) return clinicalBody;

  const paragraphs = clinicalBody.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const segCount = params.narrativeSegmentCount;
  const acquisition = params.acquisitionOnlySegmentForHour ?? [];

  for (let i = 0; i < Math.min(paragraphs.length, segCount); i++) {
    if (acquisition[i] === true) continue;
    const assignedBehavior = params.maladaptiveBehaviorForHour[i]?.trim() ?? "";
    if (!assignedBehavior || !isSibMaladaptiveBehaviorLabel(assignedBehavior)) continue;

    const segmentFunctions = params.maladaptiveBehaviorFunctionsForHour?.[i];
    if (primaryFunctionForReplacementSelection(segmentFunctions) !== "attention") continue;

    let p = paragraphs[i]!;
    if (!/\bthe client manifested\b/i.test(p)) continue;
    if (paragraphDocumentsNonContingentReinforcement(p)) continue;

    const naming = `The RBT implemented ${ncrLabel}.`;
    const detail =
      "Following this intervention, the RBT delivered brief attention on a fixed time-based schedule independent of the client's behavior, reducing the reinforcing value of attention for the maladaptive response.";
    const insertBlock = ` ${naming} ${detail}`;

    const replacementRe = /(\s*)(Additionally,\s*)?the RBT implemented the replacement program\b/i;
    const replacementMatch = replacementRe.exec(p);
    if (replacementMatch && replacementMatch.index !== undefined) {
      p = p.slice(0, replacementMatch.index) + insertBlock + p.slice(replacementMatch.index);
    } else {
      p = p.trimEnd() + insertBlock;
    }
    paragraphs[i] = p;
  }

  return paragraphs.join("\n\n");
}
