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

/** Exact BIP label is typically "Visual Supports" (plural). Singular "Visual Support" is a misfit spelling. */
export function isVisualSupportsInterventionLabel(name: string): boolean {
  return /^visual supports?$/i.test(name.trim());
}

/**
 * Gadget / unauthorized electronics access topographies (tangible-access when function not
 * documented on profile). Used to prefer Environmental Manipulation + DRA over cueing-only tools.
 */
export function isGadgetAccessMaladaptiveBehaviorLabel(behaviorName: string): boolean {
  const t = behaviorName.trim().toLowerCase();
  if (!t) return false;
  return (
    /\bgadget/.test(t) ||
    /video\s*games?/.test(t) ||
    /\bscreen\b/.test(t) ||
    /\bipad\b/.test(t) ||
    /\btablet\b/.test(t) ||
    /electronics/.test(t) ||
    /unauthorized access/.test(t) ||
    /persistent access or use of gadgets/.test(t)
  );
}

/**
 * Interventions that ONLY target an attention-maintained contingency (e.g. Pivot Praise). Using these
 * as the primary behavior-reduction intervention for an escape/tangible/automatic behavior is a
 * function mismatch and an audit red flag. They stay eligible only for attention-maintained behaviors.
 */
export function isAttentionOnlyInterventionLabel(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (!n) return false;
  return /pivot praise/.test(n);
}

/**
 * Best-effort function inference from the maladaptive behavior LABEL, used only when the client
 * profile has no documented function for that behavior. This prevents the assignment fallback from
 * dropping an attention-only or arbitrary "first approved" intervention onto an escape/tangible/
 * automatic behavior. It never invents prose; it only guides selection among APPROVED interventions.
 */
export function inferBehaviorFunctionsFromLabel(
  behaviorLabel: string,
): ClinicalFunction[] | null {
  const b = behaviorLabel.trim().toLowerCase();
  if (!b) return null;
  if (/task\s*refusal|non-?compliance|noncompliant|refus/.test(b)) return ["escape"];
  if (/elope|wander|bolt|running\s*away|\bflight\b/.test(b)) return ["escape"];
  if (/property\s*destruction/.test(b)) return ["escape", "tangible"];
  if (/physical\s*aggression/.test(b) || (/aggression/.test(b) && !/verbal/.test(b)))
    return ["escape", "tangible"];
  if (/tantrum|meltdown/.test(b)) return ["escape", "tangible"];
  if (/stereotyp|self-?stim|stimming|excessive\s*motor|repetitive\s*motor/.test(b))
    return ["automatic"];
  if (/disrupt/.test(b)) return ["escape", "attention"];
  if (/verbal\s*aggression|scream|yell/.test(b)) return ["attention", "escape"];
  return null;
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
        // Restricting unsupervised reach / item availability is the primary access-control lever.
        isEnvironmentalManipulationInterventionLabel(interventionName) ||
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

/**
 * Non-contingent reinforcement family: Attention Independent Response Delivery / NCR /
 * time-contingent attention — the BIP-mapped attention-extinction intervention that delivers
 * attention on a behavior-independent schedule to reduce the reinforcing value of the function.
 */
export function isNonContingentReinforcementInterventionLabel(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (!n) return false;
  return (
    /attention independent response delivery/.test(n) ||
    /attention independent/.test(n) ||
    /non-?contingent reinforcement/.test(n) ||
    /\bncr\b/.test(n) ||
    /time-?contingent attention/.test(n)
  );
}

/** Exact catalog string from the client's list when it is a non-contingent reinforcement (NCR) label. */
export function findNonContingentReinforcementInterventionLabel(
  interventions: string[],
): string | null {
  for (const raw of interventions) {
    const s = raw.trim();
    if (s.length === 0) continue;
    if (isNonContingentReinforcementInterventionLabel(s)) return s;
  }
  return null;
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

function escapeInterventionRank(name: string): number {
  const n = name.trim().toLowerCase();
  if (/escape extinction/.test(n)) return 0;
  if (/demand fading/.test(n)) return 1;
  if (/escape independent/.test(n)) return 2;
  if (/premack/.test(n)) return 3;
  if (isDraOrDriInterventionLabel(name)) return 4;
  if (/high-?probability|behavioral momentum/.test(n)) return 5;
  return 10;
}

function tangibleInterventionRank(name: string): number {
  const n = name.trim().toLowerCase();
  // Restrict access first, then DRA for contingent access after appropriate responding.
  if (isEnvironmentalManipulationInterventionLabel(name)) return 0;
  if (isDraOrDriInterventionLabel(name)) return 1;
  if (/premack/.test(n)) return 2;
  if (/token economy/.test(n)) return 3;
  if (/tangible.*extinction|extinction.*tangible/.test(n)) return 4;
  return 10;
}

export function preferredInterventionCandidatesForBehaviorFunction(
  interventions: string[],
  behaviorFunctions: ClinicalFunction[] | null | undefined,
  maladaptiveBehavior?: string | null | undefined,
): string[] {
  let primary = primaryFunctionForReplacementSelection(behaviorFunctions);
  // When the profile has no documented function but the label is clearly gadget/electronics
  // access-seeking, treat as tangible for candidate selection (do not invent prose labels).
  if (!primary && isGadgetAccessMaladaptiveBehaviorLabel(maladaptiveBehavior ?? "")) {
    primary = "tangible";
  }
  if (!primary) return [];
  if (primary === "attention") {
    const ordered = orderedAttentionFunctionInterventions(interventions);
    const draDri = ordered.filter(isDraOrDriInterventionLabel);
    if (draDri.length > 0) return draDri;
    return ordered;
  }
  const matched = functionMatchedInterventionsFromList(interventions, primary);
  if (primary === "escape") {
    return [...matched].sort((a, b) => escapeInterventionRank(a) - escapeInterventionRank(b));
  }
  if (primary === "tangible") {
    return [...matched].sort((a, b) => tangibleInterventionRank(a) - tangibleInterventionRank(b));
  }
  return matched;
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
  maladaptiveBehavior?: string | null | undefined,
): boolean {
  const intervention = interventionName.trim();
  if (!intervention) return false;

  if (isResponseBlockInterventionLabel(intervention)) {
    return false;
  }

  let primary = primaryFunctionForReplacementSelection(behaviorFunctions);
  if (!primary && isGadgetAccessMaladaptiveBehaviorLabel(maladaptiveBehavior ?? "")) {
    primary = "tangible";
  }
  if (!primary || primary === "automatic") return false;

  const matched = functionMatchedInterventionsFromList(authorizedInterventions, primary);
  if (matched.length === 0) return false;

  // Visual Supports is cueing only — never sufficient as the sole/primary function treatment
  // when Environmental Manipulation or DRA (etc.) are available for tangible/access topographies.
  if (
    isVisualSupportsInterventionLabel(intervention) &&
    (primary === "tangible" || primary === "escape") &&
    matched.some(
      (n) =>
        isEnvironmentalManipulationInterventionLabel(n) ||
        isDraOrDriInterventionLabel(n) ||
        /premack/i.test(n),
    )
  ) {
    return true;
  }

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
      return `Documented function: escape. Prefer a demand/escape intervention from JSON interventions (for example "${sample}") with re-presentation of the task and structured follow-through in Following this intervention. Pair with a compliance/task-engagement replacement from behaviorReplacementCandidatesForHour[s].`;
    case "tangible":
      return `Documented function: tangible (or gadget/electronics access topography). Prefer **Environmental Manipulation** to keep the preferred item outside independent reach / restrict unsupervised access, then **DRA** (when listed) so access is contingent on schedule compliance or an appropriate request—not Visual Supports alone (cueing tool only). Use exact catalog strings (e.g. "${sample}"). Pair with a requesting/acceptance/waiting replacement from behaviorReplacementCandidatesForHour[s]—do not treat an attention-request skill as the primary behavior-reduction intervention.`;
    default:
      return `Documented function: ${primaryFunction}. Use an intervention from JSON interventions that matches that function (for example "${sample}").`;
  }
}
