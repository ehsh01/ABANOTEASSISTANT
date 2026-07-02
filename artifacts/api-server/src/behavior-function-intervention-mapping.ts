import type { ClinicalFunction } from "@workspace/db/schema";
import { primaryFunctionForReplacementSelection } from "./behavior-function-replacement-mapping";

/** True when the intervention label is Response Block / Response Blocking. */
export function isResponseBlockInterventionLabel(name: string): boolean {
  const s = name.trim();
  if (!s) return false;
  if (/^response block(?:ing)?$/i.test(s)) return true;
  return /\bresponse block(?:ing)?\b/i.test(s);
}

export function isEnvironmentalManipulationInterventionLabel(name: string): boolean {
  return /^environmental manipulation$/i.test(name.trim());
}

export function interventionMatchesFunctionCategory(
  interventionName: string,
  fn: ClinicalFunction,
): boolean {
  const n = interventionName.trim().toLowerCase();
  if (!n) return false;

  switch (fn) {
    case "attention":
      return (
        /attention independent/.test(n) ||
        /time-?contingent attention/.test(n) ||
        /non-?contingent reinforcement|\bncr\b/.test(n) ||
        /differential reinforcement of alternative|\(dra\)|\bdra\b/.test(n) ||
        /differential reinforcement of incompatible|\(dri\)|\bdri\b/.test(n) ||
        /pivot praise/.test(n) ||
        /functional communication|\bfct\b/.test(n) ||
        /extinction.*attention|attention.*extinction/.test(n)
      );
    case "escape":
      return (
        /escape extinction/.test(n) ||
        /escape independent/.test(n) ||
        /demand fading/.test(n) ||
        /escape\s+extinction|demand\s+fading/.test(n) ||
        /differential reinforcement of alternative|\(dra\)|\bdra\b/.test(n) ||
        /premack/.test(n) ||
        /high-?probability request|behavioral momentum/.test(n)
      );
    case "tangible":
      return (
        /differential reinforcement of alternative|\(dra\)|\bdra\b/.test(n) ||
        /extinction.*tangible|tangible.*extinction/.test(n) ||
        /token economy/.test(n) ||
        /premack/.test(n)
      );
    case "automatic":
      return (
        isEnvironmentalManipulationInterventionLabel(interventionName) ||
        /sensory/.test(n) ||
        /blocking/.test(n) ||
        /response block/.test(n)
      );
    default:
      return false;
  }
}

/** Interventions from the authorized list that match the documented primary function. */
export function functionMatchedInterventionsFromList(
  interventions: string[],
  primaryFunction: ClinicalFunction,
): string[] {
  return [...new Set(interventions.map((s) => s.trim()).filter((s) => s.length > 0))].filter((name) =>
    interventionMatchesFunctionCategory(name, primaryFunction),
  );
}

export function isDraInterventionLabel(name: string): boolean {
  const n = name.trim().toLowerCase();
  return (
    /differential reinforcement of alternative/.test(n) ||
    /\(dra\)/.test(n) ||
    /^dra$/.test(n)
  );
}

export function isDriInterventionLabel(name: string): boolean {
  const n = name.trim().toLowerCase();
  return (
    /differential reinforcement of incompatible/.test(n) ||
    /\(dri\)/.test(n) ||
    /^dri$/.test(n)
  );
}

export function isDraOrDriInterventionLabel(name: string): boolean {
  return isDraInterventionLabel(name) || isDriInterventionLabel(name);
}

export function isAttentionIndependentResponseDeliveryLabel(name: string): boolean {
  return /attention independent/.test(name.trim().toLowerCase());
}

export function isSibMaladaptiveBehaviorLabel(behaviorName: string): boolean {
  const t = behaviorName.trim();
  if (!t) return false;
  return (
    /self[- ]?injurious\s+behavior/i.test(t) ||
    /\bSIB\b/i.test(t) ||
    t.toLowerCase() === "sib"
  );
}

/** DRA/DRI first when listed; passive attention schedules follow. */
export function orderedAttentionFunctionInterventions(interventions: string[]): string[] {
  const matched = functionMatchedInterventionsFromList(interventions, "attention");
  const draDri = matched.filter(isDraOrDriInterventionLabel);
  if (draDri.length === 0) return matched;
  const rest = matched.filter((name) => !draDri.includes(name));
  return [...draDri, ...rest];
}

export function preferredInterventionCandidatesForBehaviorFunction(
  interventions: string[],
  behaviorFunctions: ClinicalFunction[] | null | undefined,
  maladaptiveBehavior?: string | null | undefined,
): string[] {
  const primary = primaryFunctionForReplacementSelection(behaviorFunctions);
  if (!primary) return [];
  if (primary === "attention") {
    const ordered = orderedAttentionFunctionInterventions(interventions);
    const behavior = maladaptiveBehavior?.trim() ?? "";
    if (isSibMaladaptiveBehaviorLabel(behavior)) {
      const draDri = ordered.filter(isDraOrDriInterventionLabel);
      if (draDri.length > 0) {
        return draDri;
      }
    }
    return ordered;
  }
  return functionMatchedInterventionsFromList(interventions, primary);
}

/**
 * After Response Block on attention-maintained SIB, Attention independent response delivery alone
 * is insufficient when DRA/DRI are on the approved list.
 */
export function isInsufficientAttentionInterventionAfterSibSafetyChain(
  secondInterventionName: string,
  authorizedInterventions: string[],
): boolean {
  const second = secondInterventionName.trim();
  if (!second || !isAttentionIndependentResponseDeliveryLabel(second)) return false;
  return orderedAttentionFunctionInterventions(authorizedInterventions).some(isDraOrDriInterventionLabel);
}

/**
 * True when the named intervention does not match the documented maintaining function
 * and function-aligned options exist on the client's approved list.
 */
export function isFunctionMisfitIntervention(
  interventionName: string,
  behaviorFunctions: ClinicalFunction[] | null | undefined,
  authorizedInterventions: string[],
): boolean {
  const intervention = interventionName.trim();
  if (!intervention) return false;

  if (isResponseBlockInterventionLabel(intervention)) {
    return false;
  }

  const primary = primaryFunctionForReplacementSelection(behaviorFunctions);
  if (!primary || primary === "automatic") return false;

  const matched = functionMatchedInterventionsFromList(authorizedInterventions, primary);
  if (matched.length === 0) return false;

  if (interventionMatchesFunctionCategory(intervention, primary)) {
    return false;
  }

  if (primary === "attention" && isEnvironmentalManipulationInterventionLabel(intervention)) {
    return true;
  }

  return !matched.includes(intervention);
}

/** Hint when response blocking is documented but no function-aligned intervention follows. */
export function functionInterventionAfterSafetyChainHint(
  primaryFunction: ClinicalFunction,
  candidates: string[],
): string {
  const sample = candidates.slice(0, 3).join('", "');
  return `Response Block/Response Blocking addresses safety/topography only. When documented function is ${primaryFunction}, also name a **second** catalog intervention from JSON \`interventionCandidatesForHour[s]\` (for example "${sample}") in its own naming sentence after blocking is described—never Response Block alone.`;
}

/** Human-readable hint for validation / repair prompts. */
export function functionInterventionMismatchHint(
  primaryFunction: ClinicalFunction,
  candidates: string[],
): string {
  const sample = candidates.slice(0, 3).join('", "');
  switch (primaryFunction) {
    case "attention":
      return `Documented function: attention. Environmental Manipulation alone does not target an attention-maintained contingency. For attention-maintained SIB with Response Block first, use **DRA or DRI** as the second catalog intervention when listed (for example "${sample}")—Attention independent response delivery alone does not satisfy the BIP intervention chain when DRA/DRI are available. Pair with an attention-aligned replacement program when listed.`;
    case "escape":
      return `Documented function: escape. Prefer a demand/escape intervention from JSON interventions (for example "${sample}") rather than a generic or tangible-only strategy.`;
    case "tangible":
      return `Documented function: tangible. Prefer a tangible/access intervention from JSON interventions (for example "${sample}").`;
    default:
      return `Documented function: ${primaryFunction}. Use an intervention from JSON interventions that matches that function (for example "${sample}").`;
  }
}
