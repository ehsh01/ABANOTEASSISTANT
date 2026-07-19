/**
 * RETIRED FROM LIVE NOTEPLAN PATH (2026-07-19).
 *
 * These free-prose prompt strings are **not imported** by `openai-notes.ts` / structured NotePlan
 * generation. Live clinical rules live in `SYSTEM_PROMPT` + server assignment
 * (`assignInterventionsForSegment`, validators, scrubbers). Kept only so older references/docs do
 * not break if something still imports the symbols; do not wire them back into generation.
 */
import type { ClinicalFunction } from "@workspace/db/schema";
import { primaryFunctionForReplacementSelection } from "./behavior-function-replacement-mapping";
import { RESPONSE_BLOCK_ELIGIBILITY_PROMPT } from "./response-block-eligibility";

/** @deprecated Not used by structured NotePlan generation. */
export const CORE_CORRECTION_RULES_PROMPT = `CORE CORRECTION RULES (every maladaptive behavior segment — mandatory):
1. **Clear topography:** Describe what the client physically or verbally did in observable, measurable terms. The manifested-behavior line must never be the catalog label alone—use "manifested [exact label] by …" with specific actions/vocalizations from maladaptiveBehaviorTopographyForHour[s] and the assessment excerpt when available.
2. **Function-based alignment:** Use JSON maladaptiveBehaviorFunctionsForHour[s] as the documented function when non-empty (attention, escape, tangible, automatic). When function is documented, **every** catalog intervention and the replacement-program teaching must logically match that function. Do **not** invent function labels in prose; apply function only through intervention and replacement selection.
3. **Intervention consistency:** Response Block/Response Blocking is **safety/support only**—never the sole or primary function treatment, and **never** for non-physical topographies (Verbal Aggression, Task Refusal, Inappropriate Language, screaming/yelling alone, noncompliance without unsafe physical behavior). When Response Block is named first on an **eligible** safety-priority segment (Physical Aggression, SIB, elopement/wandering/bolting, Property Destruction when immediately preventing harm), a **second** function-based catalog intervention from interventionCandidatesForHour[s] is **required** when that array is non-empty. Describe blocking in **Following this intervention,** as protective action only.
4. **Mandatory DRA integration:** When maladaptiveBehaviorFunctionsForHour[s] includes **attention** (SIB, verbal aggression, attention-seeking topographies) and JSON interventions lists **DRA** or **DRI**, name that exact label as the function intervention (first when no Response Block; **second** naming sentence after Response Block when safety chain applies). Reinforce an alternative behavior that replaces the attention-maintained topography—not attention delivery alone when DRA/DRI are available. When **Attention Independent Response Delivery / Non-contingent reinforcement (NCR)** is also on JSON interventions, include it in addition to DRA/DRI so the attention chain is complete.
5. **Complete function chain (no incomplete chains):** For every maladaptive segment, the named interventions must cover the documented function per the FUNCTION-BASED MATCHING GUIDE using ONLY labels present in interventionCandidatesForHour[s]/JSON interventions—escape segments must document reinforcement for task engagement/compliance; tangible segments must withhold/deny access during the behavior; attention segments must use DRA/DRI (plus NCR when listed). Never invent a label that is not listed.
6. **Observable outcome required:** End each maladaptive segment with a concrete, observable behavioral outcome after the intervention (e.g. the behavior decreased in frequency, the client resumed task engagement, compliance increased, the client used the appropriate request). Do not stop after listing RBT actions.
7. **Replacement program logic:** Use only the verbatim replacementProgramForHour[s] assigned for that segment. Teaching prose must match the **same function** as the maladaptive behavior. Do **not** write replacement teaching that fits a different function than documented. Prefer distinct BIP-mapped replacements per behavior when behaviorReplacementCandidatesForHour[s] lists different options—do not copy the same replacement teaching strategy across unrelated functions when the server assigned different programs.`;

/** @deprecated Not used by structured NotePlan generation. */
export const FUNCTION_BASED_MATCHING_GUIDE_PROMPT = `FUNCTION-BASED MATCHING GUIDE (when maladaptiveBehaviorFunctionsForHour[s] is non-empty). Build a COMPLETE, audit-ready intervention chain for the documented function. Name only interventions present in JSON interventions / interventionCandidatesForHour[s]; never invent an intervention or replacement not already listed:
**ATTENTION-maintained** (e.g. SIB, verbal aggression, attention-seeking):
- Required chain when the labels are listed: **(1)** Response Block/Response Blocking first ONLY when maladaptiveBehaviorForHour[s] is an **eligible** safety topography (Physical Aggression, SIB, elopement/wandering/bolting, Property Destruction when immediately preventing harm)—**never** for Verbal Aggression, Inappropriate Language, screaming/yelling alone, or other non-physical topographies; **(2) DRA or DRI** as the primary function intervention (reinforce an appropriate alternative that replaces the attention-maintained topography); **(3) Attention Independent Response Delivery / Non-contingent reinforcement (NCR)** when it is on JSON interventions — deliver attention on a time-based, behavior-independent schedule so appropriate behavior no longer needs the maladaptive topography to access attention.
- Do not stop at Response Block or at NCR alone: when DRA/DRI is listed it must appear as the function intervention. Add NCR in addition to DRA when both are listed.
- **Following this intervention:** withhold attention/reaction during topography; reinforce appropriate social engagement, communication, or task engagement after compatible behavior.
- Replacement: social/communication skill from behaviorReplacementCandidatesForHour[s] (FCT, Functional communication to request attention, Appropriate social skills, sharing/turn-taking when BIP-mapped).

**ESCAPE-maintained** (e.g. task refusal, aggression during demands):
- Required chain when the labels are listed: **(1)** a demand/escape intervention from interventionCandidatesForHour[s] (Escape Extinction, Demand Fading, Escape independent response delivery, Premack, high-probability request sequence); **(2)** a compliance-based **DRA** when listed.
- **Following this intervention:** re-present the task, prompt through, and use structured follow-through; then **explicitly reinforce task engagement / compliance / task completion** (state the reinforcement delivered for compliant responding) — do not end the segment on the escape intervention without documenting reinforcement for engagement.
- Replacement: task/compliance skill from behaviorReplacementCandidatesForHour[s] (Request for Break, Follow Instructions, Remaining seated completing the task, Following Non-preferred instructions, On task Behavior—BIP-mapped only).

**TANGIBLE-maintained** (e.g. aggression or SIB for item access; gadget / video-game / unauthorized electronics access):
- Required chain when the labels are listed: **(1) Environmental Manipulation** (when listed) — keep the preferred item/gadget **outside the client's independent reach** and restrict unsupervised access during the episode; **(2) DRA** (when listed) so access is delivered **only after** schedule compliance, task completion, or an appropriate request—never contingent on the maladaptive access response. Premack or token economy may appear when listed as the contingency.
- **Do NOT** name **Visual Supports** / **Visual Support** as the **primary** catalog intervention for tangible/gadget access when Environmental Manipulation or DRA is listed — Visual Supports is a cueing tool only (and must use the exact plural BIP string **Visual Supports** when referenced).
- **Following this intervention:** keep preferred access withheld during topography; reinforce appropriate requesting, waiting, schedule compliance, or tolerance, then grant access contingent on the appropriate response.
- Replacement: communication/choice/waiting skill from behaviorReplacementCandidatesForHour[s] (Request for Tangible, Accept "No", Accepting alternatives, Delay of Reinforcement / waiting—BIP-mapped only). Do **not** present an attention-request program (e.g. Request for Attention) as the intervention that reduced the tangible-access topography—even if that skill is the assigned replacement skill-acquisition target for the segment.`;

/** @deprecated Not used by structured NotePlan generation. */
export const FUNCTION_BASED_ABC_CORRECTION_PROMPT = `${CORE_CORRECTION_RULES_PROMPT}

${FUNCTION_BASED_MATCHING_GUIDE_PROMPT}

${RESPONSE_BLOCK_ELIGIBILITY_PROMPT}

- **ABC sequence:** Antecedent (materials, demand, access context) → observable client behavior/topography → consequence (safety if needed, then function intervention naming sentence(s), then **Following this intervention,** detail with withholding + reinforcement tied to replacement skill) → verbatim replacement-program sentence → quantified tail.
- **Editing tone:** Objective, measurable, neutral—no vague wording, no internal states, no meta commentary about the BIP function.`;

/** @deprecated Not used by structured NotePlan generation. */
export const CORE_CORRECTION_QUALITY_CHECKLIST_PROMPT = `QUALITY CHECK BEFORE FINAL OUTPUT (verify every maladaptive segment — audit-ready, zero reviewer corrections):
- Documented function identified from maladaptiveBehaviorFunctionsForHour[s] (or topography-only when empty).
- Observable topography present in manifested-behavior line.
- Each named intervention matches that function; Response Block is not the only function intervention when candidates exist.
- Function chain is COMPLETE using only listed labels: attention → DRA/DRI (plus NCR/Attention Independent Response Delivery when listed); escape → escape/demand intervention AND documented reinforcement for task engagement/compliance; tangible → access withheld/denied during behavior AND DRA for appropriate requesting.
- replacementProgramForHour[s] teaching aligns with the same function; not reused inappropriately across unrelated functions when different programs were assigned.
- No conflicting treatment logic (withhold during topography, reinforce only after compatible behavior).
- Segment ends with a concrete observable outcome (behavior decreased, task engagement resumed, compliance increased, appropriate request used).
- Antecedent is specific (task, instruction type, environmental/access/transition context); no vague setup.
- Professional ABA tone throughout.`;

/** @deprecated Not used by structured NotePlan generation. */
export const FUNCTION_BASED_CORRECTION_REVISION_HINTS = `Apply **CORE CORRECTION RULES** and **FUNCTION-BASED MATCHING GUIDE** from the base prompt: fix function/replacement mismatches; complete the function chain using only listed labels (attention → DRA/DRI plus NCR when listed; escape → escape/demand intervention plus reinforcement for task engagement/compliance; tangible → withhold/deny access during behavior plus DRA for appropriate requesting); keep Response Block as safety-only with a second function intervention; strengthen thin topography; specify vague antecedents; ensure each segment ends with an observable behavioral outcome; align replacement teaching to assigned replacementProgramForHour[s] and documented function; run the **QUALITY CHECK BEFORE FINAL OUTPUT** mentally before returning text.`;

/** Human-readable function label for validation messages. */
export function primaryFunctionLabel(
  functions: ClinicalFunction[] | null | undefined,
): ClinicalFunction | null {
  return primaryFunctionForReplacementSelection(functions);
}
