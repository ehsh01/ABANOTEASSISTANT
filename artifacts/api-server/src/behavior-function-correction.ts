import type { ClinicalFunction } from "@workspace/db/schema";
import { primaryFunctionForReplacementSelection } from "./behavior-function-replacement-mapping";

/** Binding core correction rules — checked on every maladaptive ABC segment at generation time. */
export const CORE_CORRECTION_RULES_PROMPT = `CORE CORRECTION RULES (every maladaptive behavior segment — mandatory):
1. **Clear topography:** Describe what the client physically or verbally did in observable, measurable terms. The manifested-behavior line must never be the catalog label alone—use "manifested [exact label] by …" with specific actions/vocalizations from maladaptiveBehaviorTopographyForHour[s] and the assessment excerpt when available.
2. **Function-based alignment:** Use JSON maladaptiveBehaviorFunctionsForHour[s] as the documented function when non-empty (attention, escape, tangible, automatic). When function is documented, **every** catalog intervention and the replacement-program teaching must logically match that function. Do **not** invent function labels in prose; apply function only through intervention and replacement selection.
3. **Intervention consistency:** Response Block/Response Blocking is **safety/support only**—never the sole or primary function treatment. When Response Block is named first on a safety-priority segment, a **second** function-based catalog intervention from interventionCandidatesForHour[s] is **required** when that array is non-empty. Describe blocking in **Following this intervention,** as protective action only.
4. **Mandatory DRA integration:** When maladaptiveBehaviorFunctionsForHour[s] includes **attention** (SIB, verbal aggression, attention-seeking topographies) and JSON interventions lists **DRA** or **DRI**, name that exact label as the function intervention (first when no Response Block; **second** naming sentence after Response Block when safety chain applies). Reinforce an alternative behavior that replaces the attention-maintained topography—not attention delivery alone when DRA/DRI are available.
5. **Replacement program logic:** Use only the verbatim replacementProgramForHour[s] assigned for that segment. Teaching prose must match the **same function** as the maladaptive behavior. Do **not** write replacement teaching that fits a different function than documented. Prefer distinct BIP-mapped replacements per behavior when behaviorReplacementCandidatesForHour[s] lists different options—do not copy the same replacement teaching strategy across unrelated functions when the server assigned different programs.`;

export const FUNCTION_BASED_MATCHING_GUIDE_PROMPT = `FUNCTION-BASED MATCHING GUIDE (when maladaptiveBehaviorFunctionsForHour[s] is non-empty):
**ATTENTION-maintained** (e.g. SIB, verbal aggression, attention-seeking):
- Must include: **DRA or DRI** when on JSON interventions (required function intervention).
- **Following this intervention:** withhold attention/reaction during topography; reinforce appropriate social engagement, communication, or task engagement after compatible behavior.
- Replacement: social/communication skill from behaviorReplacementCandidatesForHour[s] (FCT, Functional communication to request attention, Appropriate social skills, sharing/turn-taking when BIP-mapped).

**ESCAPE-maintained** (e.g. task refusal, aggression during demands):
- Must include: demand/escape intervention from interventionCandidatesForHour[s] (Escape Extinction, Demand Fading, Escape independent response delivery, Premack, DRA when listed).
- **Following this intervention:** re-present task, prompting, structured follow-through; reinforce compliance or task completion.
- Replacement: task/compliance skill from behaviorReplacementCandidatesForHour[s] (Request for Break, Follow Instructions, Remaining seated completing the task, Following Non-preferred instructions, On task Behavior—BIP-mapped only).

**TANGIBLE-maintained** (e.g. aggression or SIB for item access):
- Must include: access/contingency intervention from interventionCandidatesForHour[s] (DRA, Premack, token economy, tangible extinction when listed).
- **Following this intervention:** withhold preferred access during topography; reinforce appropriate requesting, waiting, or tolerance.
- Replacement: communication/choice skill from behaviorReplacementCandidatesForHour[s] (Request for Tangible, Accept "No", Accepting alternatives, making choices—BIP-mapped only).`;

export const FUNCTION_BASED_ABC_CORRECTION_PROMPT = `${CORE_CORRECTION_RULES_PROMPT}

${FUNCTION_BASED_MATCHING_GUIDE_PROMPT}

- **ABC sequence:** Antecedent (materials, demand, access context) → observable client behavior/topography → consequence (safety if needed, then function intervention naming sentence(s), then **Following this intervention,** detail with withholding + reinforcement tied to replacement skill) → verbatim replacement-program sentence → quantified tail.
- **Editing tone:** Objective, measurable, neutral—no vague wording, no internal states, no meta commentary about the BIP function.`;

export const CORE_CORRECTION_QUALITY_CHECKLIST_PROMPT = `QUALITY CHECK BEFORE FINAL OUTPUT (verify every maladaptive segment):
- Documented function identified from maladaptiveBehaviorFunctionsForHour[s] (or topography-only when empty).
- Observable topography present in manifested-behavior line.
- Each named intervention matches that function; Response Block is not the only function intervention when candidates exist.
- DRA/DRI included when required for attention-maintained segments and listed on JSON interventions.
- replacementProgramForHour[s] teaching aligns with the same function; not reused inappropriately across unrelated functions when different programs were assigned.
- No conflicting treatment logic (withhold during topography, reinforce only after compatible behavior).
- Professional ABA tone throughout.`;

export const FUNCTION_BASED_CORRECTION_REVISION_HINTS = `Apply **CORE CORRECTION RULES** and **FUNCTION-BASED MATCHING GUIDE** from the base prompt: fix function/replacement mismatches; add DRA/DRI for attention-maintained segments when listed; keep Response Block as safety-only with a second function intervention; strengthen thin topography; align replacement teaching to assigned replacementProgramForHour[s] and documented function; run the **QUALITY CHECK BEFORE FINAL OUTPUT** mentally before returning text.`;

/** Human-readable function label for validation messages. */
export function primaryFunctionLabel(
  functions: ClinicalFunction[] | null | undefined,
): ClinicalFunction | null {
  return primaryFunctionForReplacementSelection(functions);
}
