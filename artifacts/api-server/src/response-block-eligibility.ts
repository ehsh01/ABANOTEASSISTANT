import { isSibMaladaptiveBehaviorLabel } from "./behavior-function-intervention-mapping";

/**
 * Maladaptive behavior labels where Response Block/Response Blocking must NOT be used.
 * These topographies are not physically blockable or do not pose an immediate safety risk
 * that requires physical interruption.
 */
export function isResponseBlockProhibitedBehavior(behaviorName: string): boolean {
  const u = behaviorName.trim().toLowerCase();
  if (!u) return false;
  if (/verbal\s+aggression/i.test(u)) return true;
  if (/task\s+refusal/i.test(u)) return true;
  if (/inappropriate\s+language/i.test(u)) return true;
  if (/\bscream/i.test(u) || /\byell(?:ing)?\b/i.test(u)) return true;
  if (/non-?compliance/i.test(u)) return true;
  if (/inappropriate\s+remark/i.test(u)) return true;
  if (/inappropriate\s+social\s+behavior/i.test(u)) return true;
  if (/\bdisruption\b/i.test(u) && !/\bphysical\b/i.test(u)) return true;
  return false;
}

/** Person-directed physical aggression (not verbal aggression). */
export function isPhysicalAggressionBehaviorLabel(behaviorName: string): boolean {
  const u = behaviorName.trim().toLowerCase();
  if (!u || isResponseBlockProhibitedBehavior(behaviorName)) return false;
  if (/\bphysical\s+aggression\b/i.test(u)) return true;
  return /\baggression\b/i.test(u) && !/verbal/i.test(u);
}

export function isPropertyDestructionBehaviorLabel(behaviorName: string): boolean {
  return /property\s+destruction/i.test(behaviorName.trim().toLowerCase());
}

export function isElopementSafetyBehaviorLabel(behaviorName: string): boolean {
  const u = behaviorName.trim().toLowerCase();
  return (
    /\bwandering\b/.test(u) ||
    /\belope/.test(u) ||
    /\bbaiting\b/.test(u) ||
    /\bbolting\b/.test(u) ||
    /\brunning\s+away\b/.test(u)
  );
}

/**
 * True when Response Block may appear in a safety chain (first naming sentence) for this behavior.
 * Verbal aggression, task refusal, and other non-physical topographies are excluded.
 */
export function assignedBehaviorAllowsResponseBlockSafetyChain(behaviorName: string): boolean {
  const t = behaviorName.trim();
  if (!t || isResponseBlockProhibitedBehavior(t)) return false;
  if (isSibMaladaptiveBehaviorLabel(t)) return true;
  if (isPhysicalAggressionBehaviorLabel(t)) return true;
  if (isElopementSafetyBehaviorLabel(t)) return true;
  if (isPropertyDestructionBehaviorLabel(t)) return true;
  return false;
}

export const RESPONSE_BLOCK_ELIGIBILITY_PROMPT = `RESPONSE BLOCK / RESPONSE BLOCKING — ELIGIBILITY (mandatory):
Response Blocking must **only** be used when the maladaptive behavior involves an **immediate safety risk** or a **physical topography that can be safely interrupted**, and the exact label is on JSON \`interventions\`.

**Appropriate (when listed on the BIP):**
- **Physical Aggression** (hitting, kicking, grabbing, biting, scratching another person)
- **Self-Injurious Behavior (SIB)** (head hitting, scratching self, biting self, etc.)
- **Elopement / wandering / bolting / running away** (blocking movement toward an unsafe area)
- **Property Destruction** only when necessary to **immediately** prevent damage or injury (e.g. stopping tearing, throwing, or breaking objects)—and only when authorized in the BIP

**Do NOT use Response Block for** (use function-based interventions from \`interventionCandidatesForHour[s]\` instead):
- Verbal Aggression
- Task Refusal
- Inappropriate Language / inappropriate remarks
- Screaming or yelling alone
- Noncompliance without unsafe physical behavior
- Any behavior whose topography is **not** an immediate, observable physical action posing a safety risk

Before naming Response Block, verify the assigned \`maladaptiveBehaviorForHour[s]\` label is eligible per this list and the intervention is authorized in the client's BIP.`;
