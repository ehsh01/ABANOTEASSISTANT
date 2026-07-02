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

export function preferredInterventionCandidatesForBehaviorFunction(
  interventions: string[],
  behaviorFunctions: ClinicalFunction[] | null | undefined,
): string[] {
  const primary = primaryFunctionForReplacementSelection(behaviorFunctions);
  if (!primary) return [];
  return functionMatchedInterventionsFromList(interventions, primary);
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
      return `Documented function: attention. Environmental Manipulation alone does not target an attention-maintained contingency. Use a function-matched intervention from JSON interventions (for example "${sample}") and pair with an attention-aligned replacement program when listed.`;
    case "escape":
      return `Documented function: escape. Prefer a demand/escape intervention from JSON interventions (for example "${sample}") rather than a generic or tangible-only strategy.`;
    case "tangible":
      return `Documented function: tangible. Prefer a tangible/access intervention from JSON interventions (for example "${sample}").`;
    default:
      return `Documented function: ${primaryFunction}. Use an intervention from JSON interventions that matches that function (for example "${sample}").`;
  }
}
