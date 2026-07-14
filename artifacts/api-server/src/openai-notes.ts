/**
 * OpenAI-powered clinical body for session notes.
 * Default model is GPT 5.5 (`gpt-5.5`). Override with OPENAI_MODEL if OpenAI publishes a different id.
 * Opening/closing locked prose is still assembled server-side in note-assembly.ts.
 */

import type { ClinicalFunction, MaladaptiveBehaviorProfileEntry } from "@workspace/db/schema";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {
  MALADAPTIVE_BEHAVIOR_SIB_CANONICAL,
  normalizeClinicalBodyInterventionDetailPhrases,
  normalizeClinicalBodyInterventionLabels,
  normalizeClinicalBodyMaladaptiveBehaviorLabels,
  normalizeClinicalBodyPraiseWording,
  normalizeClinicalBodyReplacementLikePhrases,
  normalizeClinicalBodyEscapedQuotes,
  validateClinicalBodyCompliance,
  type NoteComplianceContext,
} from "./note-validation";
import type { TherapySetting } from "@workspace/therapy-settings";
import {
  CORE_CORRECTION_QUALITY_CHECKLIST_PROMPT,
  FUNCTION_BASED_ABC_CORRECTION_PROMPT,
  FUNCTION_BASED_CORRECTION_REVISION_HINTS,
} from "./behavior-function-correction";
import {
  injectMissingAttentionNcrIntervention,
  injectMissingSafetyChainFunctionIntervention,
} from "./safety-chain-enforcement";

/** Chat Completions model id for note clinical body when OPENAI_MODEL is unset. */
export const DEFAULT_OPENAI_NOTE_MODEL = "gpt-5.5";

export type NoteGenerationContext = {
  /**
   * Must always be the literal `the client` in requests — session notes must not contain personal names.
   * Retained for JSON shape / prompts; do not pass profile names.
   */
  clientName: string;
  /** Same policy as `clientName` — always `the client` in production requests. */
  firstName: string;
  gender: string | null | undefined;
  /** Billable duration from the wizard (integer hours). */
  sessionHours: number;
  /**
   * How many ABC clinical paragraphs to write (aligned with ~90-minute program/narrative slots; often less than
   * `sessionHours` when session is longer than 2 hours).
   */
  narrativeSegmentCount: number;
  sessionDate: string;
  /** Approved session location label; align antecedents and setting with this. */
  therapySetting: TherapySetting;
  presentPeople: string[];
  hasEnvironmentalChanges: boolean;
  environmentalChanges: string;
  maladaptiveBehaviors: string[];
  /**
   * One row per entry in \`maladaptiveBehaviors\` (same order): optional RBT-authored operational text (\`topography\`) per catalog name.
   * Used with the assessment excerpt to constrain observable forms; \`topography\` may be null when unset.
   */
  maladaptiveBehaviorTargets: MaladaptiveBehaviorProfileEntry[];
  /**
   * Exact catalog behavior for each **narrative segment** (length = `narrativeSegmentCount`), server-computed from hourly rotation then collapsed to slots.
   */
  maladaptiveBehaviorForHour: string[];
  interventions: string[];
  /** Authorized replacement program names for this client (compliance / “no extra program names” checks). */
  replacementProgramsInOrder: string[];
  /**
   * Exact replacement program string for each **narrative segment** (length = `narrativeSegmentCount`).
   * The clinical body must use only this name for replacement-program content in paragraph index `s` (verbatim, all punctuation).
   */
  replacementProgramForHour: string[];
  /**
   * Per **segment**: when true, that segment documents a linked replacement program that was **not** among the session's
   * selected billable targets — describe RBT implementation/teaching only; do not state positive or negative client outcomes.
   */
  rbtActionsOnlyOutcomeForHour: boolean[];
  /** Unique per request so the model does not replay identical scenarios across regenerations */
  requestNonce: string;
  /** Approximate age at session (from profile DOB); null if unknown */
  clientAgeYears: number | null;
  /** Optional client.age_band from DB for extra prompt context */
  ageBand: string | null | undefined;
  /**
   * Plain-text excerpt from the client's assessment PDF (truncated). Empty if not stored on the client record.
   */
  clientAssessmentTextExcerpt: string;
  /** Original assessment filename when known (reference only). */
  assessmentReferenceFileName: string | null;
  /**
   * Preferred reinforcers from assessmentSummary.reinforcementPreferences (BIP Reinforcement Preferences).
   * Empty when not on file. Use these concrete names for contingent reinforcement detail when non-empty.
   */
  reinforcementPreferences: string[];
  /**
   * Optional ABC Builder: length = `narrativeSegmentCount`. Non-null entries are exact activity/antecedent catalog strings (first non-empty hour in that segment); null = AI chooses antecedent for that segment.
   */
  activityAntecedentForHour: (string | null)[];
  /**
   * Per segment: true when any hour in the segment had a language-type maladaptive target — narrative must include brief client-utterance topography for that segment when true.
   */
  languageMaladaptiveEpisodeForHour: boolean[];
  /**
   * Length = `narrativeSegmentCount`. Non-null when therapist-entered trial data applies to that segment's program.
   * The narrative must state the **rounded success percentage** derived from those trials for the verbatim program name (not N-of-M trial count rollups).
   */
  therapistTrialSummaryForReplacementHour: ({
    totalTrials: number;
    successfulTrialNumbers: number[];
  } | null)[];
  /**
   * When \`true\` at segment \`s\`, that paragraph is **skill-acquisition only** (e.g. Respond to Own Name, Echoic programs):
   * do **not** frame the segment with a maladaptive catalog label. \`maladaptiveBehaviorForHour[s]\` is empty in JSON for those segments.
   */
  acquisitionOnlySegmentForHour: boolean[];
  /**
   * Per narrative segment \`s\`: documented FBA functions for \`maladaptiveBehaviorForHour[s]\` from the client profile
   * (null = not specified in assessment; non-empty = use for intervention selection).
   */
  maladaptiveBehaviorFunctionsForHour: (ClinicalFunction[] | null)[];
  /**
   * Per narrative segment \`s\`: stored BIP/profile operational topography for \`maladaptiveBehaviorForHour[s]\` (\`null\` when unset).
   * When non-null, the manifested-behavior sentence must use that same operational definition each session.
   */
  maladaptiveBehaviorTopographyForHour: (string | null)[];
  /**
   * Per narrative segment \`s\`: BIP-aligned replacement program names for \`maladaptiveBehaviorForHour[s]\`
   * (from assessment \`behavior_to_replacements_map\` when present). Empty when acquisition-only or no behavior.
   */
  behaviorReplacementCandidatesForHour: string[][];
  /**
   * Per narrative segment \`s\`: function-aligned catalog intervention names when \`maladaptiveBehaviorFunctionsForHour[s]\` is non-empty.
   */
  interventionCandidatesForHour: string[][];
  /** BIP behavior → replacement map from structured assessment (compliance validation). */
  behaviorToReplacementsMap?: Record<string, string[]> | undefined;
};

const SYSTEM_PROMPT = `You write ABA session note clinical narratives for RBT documentation.

You will receive JSON "session context". Output ONLY the clinical body that goes BETWEEN:
(1) the fixed opening two sentences that the system adds separately, and
(2) the fixed closing reinforcer paragraph, performance line, and next-session line that the system adds separately.

CLIENT ASSESSMENT EXCERPT (BIP/FBA text — when provided in JSON):
- The JSON may include \`clientAssessmentTextExcerpt\`: plain text from the client's uploaded assessment PDF (truncated for this request). \`assessmentReferenceFileName\` is the file name only (reference).
- **Never copy personal names, initials, or nicknames from the excerpt into your output.** The assessment may name the individual; your clinical body must still refer to them only as **the client** (plus pronouns from JSON gender).
- When \`clientAssessmentTextExcerpt\` is non-empty: treat it as the authoritative clinical document for **definitions, topography, and contexts** of target/problem behaviors described there. Align observable descriptions and episode context with that document. Do **not** contradict explicit behavior definitions or operational descriptions stated in the excerpt.
- **Catalog strings still win for labels:** maladaptive behavior names, intervention names, and replacement program names must match the JSON lists **exactly** (exact spelling/capitalization). If the excerpt uses different wording for a behavior than the JSON catalog label, use the **JSON label** when naming the behavior and keep observable detail consistent with the excerpt's meaning.
- **Self-injury label:** When JSON lists **${MALADAPTIVE_BEHAVIOR_SIB_CANONICAL}** (or an equivalent entry that normalizes to it), the manifested-behavior line must use that **full** string verbatim—never shorten to **SIB** alone, even if the assessment excerpt uses the acronym.
- Do not paste long quotes from the excerpt; paraphrase into observable session narrative.
- When \`clientAssessmentTextExcerpt\` is empty: rely on the JSON behavior, intervention, and replacement program lists only; do not invent assessment-level detail.

PROFILE MALADAPTIVE TOPOGRAPHIES (JSON \`maladaptiveBehaviorTargets\` — when entries include non-null \`topography\`):
- The JSON includes \`maladaptiveBehaviorTargets\`: an array parallel to \`maladaptiveBehaviors\` (same \`name\` strings in the same order). Each object has \`name\` (exact catalog label) and \`topography\` (RBT-entered operational text for that label, or null when not provided).
- For segment \`s\`, when \`maladaptiveBehaviorForHour[s]\` equals an entry's \`name\` and that entry's \`topography\` is non-empty after trim: treat that \`topography\` as **authoritative client-specific guidance** for what counts as that behavior and what observable actions/vocalizations/durations fit this target—**in addition to** \`clientAssessmentTextExcerpt\` when the excerpt is non-empty. Prefer consistency across sources; do **not** invent observable forms that are outside both the excerpt (when present) and the non-empty topography for that label.
- When the excerpt is **empty** but \`topography\` is non-empty for the assigned label, use that topography (not generic filler) to shape observable episode detail while still citing the behavior using the **exact JSON catalog string**.
- **Never copy personal names, initials, or nicknames from \`topography\` into your output.** The clinical body must refer to the learner only as **the client** (plus pronouns from JSON gender), even if the stored topography text names the individual.

BEHAVIOR FUNCTION (JSON \`maladaptiveBehaviorTargets.functions\` and \`maladaptiveBehaviorFunctionsForHour\` — mandatory when present):
- Each \`maladaptiveBehaviorTargets\` entry may include \`functions\`: an array of tokens \`attention\`, \`escape\`, \`tangible\`, and/or \`automatic\` imported from this client's assessment (Preference Assessment / Hypothesized function). These are the **documented maintaining functions** — **never** invent, guess, or add function labels not in that array.
- JSON \`maladaptiveBehaviorFunctionsForHour[s]\` mirrors the functions for \`maladaptiveBehaviorForHour[s]\` on segment \`s\` (\`null\` = not specified in assessment; non-empty array = documented functions for that client).
- When \`maladaptiveBehaviorFunctionsForHour[s]\` is a **non-empty** array and \`acquisitionOnlySegmentForHour[s]\` is false: the catalog intervention naming sentence(s) for that segment must document intervention(s) from JSON \`interventions\` that are clinically appropriate for **that documented function** (e.g. escape-maintained → Escape Extinction / Demand Fading when listed; **attention-maintained → DRA or DRI when listed (especially for SIB)—Attention independent response delivery, Time-Contingent Attention Delivery, or NCR only when DRA/DRI are not on the list—never Environmental Manipulation alone**; tangible-maintained → tangible/access procedures when listed; automatic/sensory → Environmental Manipulation / sensory-appropriate interventions when listed). JSON \`interventionCandidatesForHour[s]\` lists pre-filtered function-aligned intervention names for that segment when non-empty—**prefer one of those exact strings** for the catalog naming sentence. Prefer interventions mapped to that function in the assessment when the excerpt supports the match. The assigned \`replacementProgramForHour[s]\` and teaching prose must also match that function per **REPLACEMENT PROGRAM — FUNCTION MATCH** (never use safety leave-area programs for aggression/SIB/property destruction; never use tangible programs for escape behaviors). Do **not** write meta commentary such as "The behavior was identified in the BIP as attention-maintained"—apply the documented function only through intervention and replacement selection, not narrative labels about the assessment.
- When \`maladaptiveBehaviorFunctionsForHour[s]\` is \`null\` or an **empty** array: do **not** add function-based framing or infer maintaining function; follow existing intervention rules without attributing escape, attention, tangible, or sensory/automatic function.

${FUNCTION_BASED_ABC_CORRECTION_PROMPT}

${CORE_CORRECTION_QUALITY_CHECKLIST_PROMPT}

JSON \`maladaptiveBehaviorTopographyForHour\` (per-segment stored operational definitions):
- Array length equals \`narrativeSegmentCount\`. When \`maladaptiveBehaviorTopographyForHour[s]\` is a **non-null** string, that text is the client's **fixed BIP/profile topography** for \`maladaptiveBehaviorForHour[s]\`. Every note must describe that behavior using **the same operational definition** reviewers expect from prior ABCs for this client—not a new generic description each session.
- In the **manifested [behavior] by …** sentence, weave in observable details from that stored topography (and from \`clientAssessmentTextExcerpt\` when present). External reviewers flag notes when the antecedent and consequence are detailed but the **behavior line** does not match the documented topography.

NARRATIVE SEGMENTS (billing hours vs. ABC paragraph count — mandatory):
- JSON \`sessionHours\` is the **billable duration** for the visit (integer clock hours the RBT documented).
- JSON \`narrativeSegmentCount\` is how many **separate ABC clinical paragraphs** you must output (blank line between paragraphs). It matches the server’s **~90-minute** grid: **exactly 2 billable hours → 2 segments (one per hour)**; **3+ billable hours → fewer segments than hours** (about one full ABC + one replacement program focus per ~90 minutes of session time).
- Arrays named \`*ForHour\` in the JSON are indexed by **segment index** \`s\` from **0** to **narrativeSegmentCount − 1** (not by individual clock hour). Each paragraph \`s\` may summarize **multiple consecutive billable hours** in one flowing ABC narrative; still use **exactly one** assigned maladaptive catalog label, **one** assigned replacement program string, and **one** intervention sequence policy for that segment as given for index \`s\`.

EVERY MALADAPTIVE BEHAVIOR — IMPLEMENT TOPOGRAPHY FROM THE ASSESSMENT (mandatory when excerpt is non-empty):
- **Before** you write the maladaptive episode for segment \`s\`, use \`clientAssessmentTextExcerpt\` to find how **\`maladaptiveBehaviorForHour[s]\`** is **defined, operationalized, and exemplified** (headings, "defined as," examples, onset/offset, settings). You still cite the behavior using the **exact JSON catalog string**; the excerpt tells you **what counts** as that behavior and **what observable forms** are in scope.
- The **concrete topography** you write (body movements, vocalizations, language, interactions with people/objects, duration, context) must be **instances that fit that excerpt specification** for this target—not a different problem behavior from the BIP, and not generic filler that could describe any client.
- If the excerpt ties this label to **specific** forms (e.g. only certain gestures, only property damage toward certain materials, only verbal threats of a given type), **stay inside those forms**. If the excerpt is vague for this label only, stay faithful to the **label class** (e.g. aggression toward people vs objects) without importing details from **other** behaviors' definitions.
- When \`clientAssessmentTextExcerpt\` is **empty**, you have no on-file BIP topography—describe observable actions consistent with the **catalog label** only; do not fabricate assessment-style operational rules.

COMPLIANCE (mandatory):
OBSERVATIONAL-ONLY — NO INTERPRETATION:
- NEVER infer or describe thoughts, emotions, intentions, wants, frustration "because", or internal states.
- Prohibited examples: "The client felt…", "wanted to…", "was frustrated because…", "was trying to…", "seemed upset", "appeared angry".
- ALLOWED: observable actions only, e.g. "The client cried, dropped to the floor, and screamed." / "The client pushed the therapist's hand away."
- Do not explain why a behavior occurred beyond observable antecedents (what was said, shown, or presented).

SUBJECTIVE WORDING — FORBIDDEN (mandatory):
- Never use these state/value words anywhere in the clinical body—for the client, the RBT, the caregiver, or the session as a whole: **upset**, **frustrated**, **happy**, **angry**, **sad**, **moody**, **stubborn**, **noncompliant**, **defiant**, **rude**, **lazy**, **fair performance**, **bad day**, **good day**, **did well**, **did poorly**, **uncooperative**, "in a good/bad mood", "became upset/frustrated/angry/sad/happy", "got upset/frustrated/angry", "was upset/frustrated/happy/stubborn/noncompliant".
- Replace every internal-state word with **observable topography** (what the body, voice, and hands did) and **measurable** detail (trial counts, percent of trials/opportunities, prompt level, count of independent responses—never seconds/minutes for the client).
- Examples: instead of "the client became upset" write "the client cried, dropped to the floor, kicked legs, and threw materials"; instead of "was noncompliant" write "did not initiate the response after the prompt and pushed the materials away"; instead of "did well" write a count or percent (e.g. "completed the task in 4/5 opportunities", "criterion was met on approximately 60% of trials").

BEHAVIOR DESCRIPTION:
- Describe only what the RBT could see or hear. No deductions about cause, intent, or emotional state.

BEHAVIOR CLASSIFICATION (use exact catalog labels from JSON; describe actions consistently):
- If a behavior label indicates physical aggression, describe actions directed AT A PERSON (hitting, kicking, pushing a person).
- For **Physical Aggression**, do **not** include quoted speech, shouted words, raised voice, screaming, vocalizations, or other verbal topography in that same manifested-behavior episode. Physical Aggression topography must stay limited to person-directed physical contact or attempts (e.g. hitting, kicking, pushing, scratching, pinching, headbutting, hair pulling, throwing items at a person). If verbal aggression or screaming occurred, it requires a separate assigned verbal/language behavior segment; do not bundle it into Physical Aggression.
- If a behavior label indicates property destruction or similar, describe actions toward OBJECTS (throwing toys, breaking items, slamming materials)—not labeled as person-directed aggression unless the text clearly strikes a person.
- Do not re-label BIP vocabulary; stay faithful to the provided maladaptive behavior names while keeping descriptions observable.

SAFETY-PRIORITY BEHAVIORS — RESPONSE BLOCKING FIRST (when listed in JSON **and** behavior is eligible):
- Response Block/Response Blocking applies **only** when \`maladaptiveBehaviorForHour[s]\` involves an **immediate safety risk** or a **physically blockable topography** authorized in JSON \`interventions\`. **Eligible labels:** **Self-Injurious Behavior (SIB)**, **Physical Aggression** (person-directed hitting/kicking/grabbing/biting/scratching—not Verbal Aggression), **wandering**, **elopement/eloping**, **baiting**, **bolting**, **running away**, and **Property Destruction** only when necessary to **immediately** prevent damage or injury per the BIP.
- **Do NOT use Response Block** for **Verbal Aggression**, **Task Refusal**, **Inappropriate Language**, screaming/yelling alone, or noncompliance without unsafe physical behavior—use function-based interventions from \`interventionCandidatesForHour[s]\` (DRA, Premack principle, Escape independent response delivery, Attention independent response delivery, Environmental Manipulation, etc.) instead.
- When an **eligible** label above is assigned and JSON \`interventions\` includes an exact response-blocking catalog label such as **Response Block** or **Response Blocking**, the **first** intervention **naming** sentence in the consequence chain must document that exact JSON label (exact spelling/capitalization). Do not invent a response-blocking intervention if it is not in the list.
- **SIB mandatory sequence (when Response Block/Response Blocking is in JSON \`interventions\`):** (1) name that exact response-blocking label first—**never** name DRA, DRI, Premack principle, Redirection, or Environmental Manipulation before it; (2) **Following this intervention,** describe observable blocking/protection and the client's result; (3) when \`maladaptiveBehaviorFunctionsForHour[s]\` is **non-empty** and JSON \`interventionCandidatesForHour[s]\` is non-empty, you **must** name **one additional** function-matched catalog intervention from that candidate list in its own naming sentence (Response Block alone does not address escape/tangible/attention function); (4) when \`maladaptiveBehaviorFunctionsForHour[s]\` includes **attention** and JSON \`interventions\` lists **DRA** or **DRI**, the **second** naming sentence after Response Block must be that exact **DRA/DRI** label—**not** Attention independent response delivery alone; (5) document the assigned replacement program. Response blocking always comes before any other intervention or program for SIB.
- **SIB attention + safety chain example:** … implemented Response blocking. Following this intervention, … blocked further contact … The RBT implemented Differential Reinforcement of Alternative Behavior (DRA). Following this intervention, the RBT did not provide attention during self-injury. After the client kept both hands down, the RBT provided brief attention and continued the instruction …
- **SIB when Response Block/Response Blocking is NOT in JSON \`interventions\`:** when \`maladaptiveBehaviorFunctionsForHour[s]\` includes **attention**, use an **attention-matched** catalog intervention from JSON \`interventionCandidatesForHour[s]\` or \`interventions\` (for example Attention independent response delivery, Time-Contingent Attention Delivery, NCR, or DRA)—**Environmental Manipulation alone does not address an attention-maintained contingency**. When the documented function is **automatic/sensory** (or function is not specified) and **Environmental Manipulation** is listed, it may be used first for immediate physical protection; describe blocking/protection in following plain prose, then name any additional approved intervention. The client BIP should include Response Block/Response Blocking for SIB episodes when clinically indicated.
- Phrase that first intervention as **its own sentence** that **ends with a period immediately after the exact catalog string**—**no** technique description in that same sentence (for example: **To address this behavior, the RBT immediately implemented Response Blocking.** when JSON says **Response Blocking**). Put observable blocking action and further clinical detail in **the next sentence(s)** (for example beginning with **Following this intervention,** …). Use the **exact** JSON string **with no surrounding quotes**, **identical capitalization** to JSON.
- **Only in this safety chain case** may you add **further separate naming sentences**, each naming **only one** JSON string and each ending with a period right after that catalog name, for additional JSON interventions. Do not place another listed intervention before the response-blocking label when that label is in the JSON list.
- When JSON \`interventions\` does **not** include Response Block or Response Blocking, do **not** document those labels—use other approved interventions from the list only.

INTERVENTIONS — ONE PER ABC (default) + EXACT MATCH (mandatory):
- For each narrative paragraph, after the manifested behavior line, document **exactly one** catalog intervention from JSON \`interventions\`—the single best match for that episode—using **one naming sentence** only: **The RBT implemented [exact JSON label].** or **To address this behavior, the RBT implemented [exact JSON label].** or **… applied [exact JSON label].** (period **immediately** after the catalog string). **Do not** append \`by …\` or any other explanation in that same sentence as the catalog name.
- **Self-injury intervention coherence:** When \`maladaptiveBehaviorForHour[s]\` is **Self-Injurious Behavior (SIB)** and JSON \`interventions\` includes an exact response-blocking catalog label such as **Response Block** or **Response Blocking**, name that exact label **first** per **SAFETY-PRIORITY BEHAVIORS**—**never** name DRA, DRI, Premack principle, Redirection, or other interventions before it. When \`maladaptiveBehaviorFunctionsForHour[s]\` includes **attention** and JSON lists attention-matched interventions, name one of those (see **BEHAVIOR FUNCTION**)—**not Environmental Manipulation alone**. If no response-blocking label is listed, function is not attention, and **Environmental Manipulation** is listed, use **Environmental Manipulation** as the first catalog intervention naming sentence and describe blocking/protection in following plain prose. Do **not** use **Redirection** or generic **DRA** as the **first** named intervention for SIB when a response-blocking label, attention-matched intervention, or Environmental Manipulation (automatic/sensory only) is available per the rules above; those may appear only after the safety/function chain is documented.
- **Physical Aggression / eligible aggression safety chain:** When \`maladaptiveBehaviorForHour[s]\` is **Physical Aggression** (not Verbal Aggression), JSON includes Response Block/Response Blocking, and \`maladaptiveBehaviorFunctionsForHour[s]\` documents **escape**, **tangible**, or **attention**, the consequence chain is **always two (or more) catalog naming sentences**: (1) Response Block/Response Blocking first; (2) **Following this intervention,** blocking detail; (3) a **second** naming sentence with one exact string from JSON \`interventionCandidatesForHour[s]\` (for example **Differential Reinforcement of Alternative Behavior (DRA)**, **Escape Extinction**, **Demand Fading**, **Escape independent response delivery**, or **Premack principle** when listed)—Response Block addresses safety only and does **not** satisfy the documented function by itself.
- **Physical Aggression during demands:** When \`maladaptiveBehaviorForHour[s]\` is **Physical Aggression**, the episode occurs during an instruction, guided task, cleanup, hand-over-hand prompting, or other demand context, and JSON \`interventions\` includes **Escape Extinction** or **Demand Fading**: if Response Block/Response Blocking is **not** in JSON \`interventions\`, use Escape Extinction or Demand Fading as the **single** catalog intervention naming sentence; if Response Block/Response Blocking **is** listed, use it **first** per **SAFETY-PRIORITY BEHAVIORS**, then name Escape Extinction or Demand Fading (whichever is on the list) as the **second** naming sentence when it appears in \`interventionCandidatesForHour[s]\` or \`interventions\`. Do **not** use generic **DRA** as the **only** named intervention for this demand-escape episode when an approved demand/escape intervention is available; DRA may appear as the second function-matched intervention when listed and Escape Extinction/Demand Fading are absent.
- **Exception:** only when \`maladaptiveBehaviorForHour[s]\` is an **eligible** safety-priority topography (Self-Injurious Behavior (SIB), **Physical Aggression**, wandering, elopement, baiting, bolting, running away, Property Destruction when immediately preventing harm—not Verbal Aggression, Task Refusal, or Inappropriate Language) **and** a response-blocking label is in JSON \`interventions\`, you may document that response-blocking label first and then **one or more additional** interventions, **each in its own naming sentence** (see **SAFETY-PRIORITY BEHAVIORS** above). In all **other** segments, **do not** add a second catalog intervention naming sentence for another JSON string.
- **Never join two different catalog intervention names into one combined label** using **and**, a comma, **or**, **plus**, etc. (forbidden: **Premack principle and Prompt Hierarchy** as one noun phrase; **Redirection, DRA** as one label before one period; \`The RBT implemented A and B.\` when A and B are two different JSON strings).
- **Forbidden:** \`The RBT implemented "Redirection."\` with quotes around the catalog name; \`The RBT implemented Redirection, by …\` or \`The RBT implemented Redirection by …\` (any **by** clause attached to the catalog name in the naming sentence); \`The RBT implemented behavioral momentum.\` when JSON lists **Behavioral momentum** (wrong casing). **Semicolons** must not chain two catalog intervention names in one breath.
- **INTERVENTION EXACT MATCH (mandatory for validators):** In the **naming** sentence, write the **exact** JSON intervention substring with **no straight double quotes** around it and **character-for-character** spelling and capitalization from JSON \`interventions\`, then end that sentence with **.** right after the name. All **how/what was done** belongs in **following** sentences (never in the same sentence as the catalog label).
- When JSON lists an intervention with a parenthetical acronym—e.g. **Differential Reinforcement of Alternative Behavior (DRA)**, **Differential Reinforcement of Incompatible Behavior (DRI)**, **Differential Reinforcement of Other Behavior (DRO)**—use the **full** string including the parenthetical in the naming sentence; never drop **(DRA)**, **(DRI)**, **(DRO)**, etc.
- **INTERVENTION DETAIL — plain prose only (mandatory):** In **Following this intervention,** sentences, describe observable RBT actions in **plain clinical prose with an explicit subject**. Do **not** phrase reinforcement, modeling, prompting, redirection, or client outcomes as title-like intervention/program names. **Forbidden examples:** *Praise withheld during repeated motor pattern*; *Brief praise delivered after client placed card into bin*; *verbal praise contingent on task engagement*; *sat at table* as a standalone fragment; *redirected the client's hands back to the worksheet*; *guided the client to place one marker at a time into the bin*; *modeled placing*. **Preferred:** *The RBT maintained neutral attention during the repeated movement pattern.*; *After the client placed the card in the bin, the RBT acknowledged the completed response and continued the activity.*; *The client then sat at the table and completed the presented step.*; *The RBT pointed to the worksheet and re-presented the instruction.* These are techniques, consequences, and client responses—not substitute names for JSON \`interventions\` or \`replacementProgramsInOrder\`.
- **POST-INTERVENTION OUTCOME (mandatory):** The **Following this intervention** / **Following these interventions** section must include an observable result after the intervention, not only RBT actions. State what happened next in measurable terms (e.g. the client completed one step, returned to the task, remained seated/nearby, placed materials into the bin, oriented to the item/speaker, or engaged with materials following prompts). Keep it objective and do not infer feelings or intent.
- **Wrong:** The RBT implemented Redirection by guiding the client back to the table. / The RBT implemented Differential Reinforcement of Incompatible Behavior. (missing **(DRI)**) / Following this intervention, the RBT reinforced appropriate task engagement with verbal praise. / Following this intervention, the RBT guided the client to place one marker at a time into the bin.
- **Right (safety chain only):** To address this behavior, the RBT immediately implemented Response Block. Following this intervention, the RBT blocked further contact. The RBT implemented Differential Reinforcement of Alternative Behavior (DRA). Following this intervention, …
- Use **only** intervention strings that appear in JSON \`interventions\`; do not invent or rename. If a strategy is not in the JSON list, do not label it with a catalog intervention name. If a single JSON string itself contains the word **and** (e.g. one BIP line reads Offer Choices and Redirection as one list entry), treat that entire string as **one** intervention label—do not split it.

TASK REFUSAL (exact catalog string **Task Refusal** for \`maladaptiveBehaviorForHour[s]\`) — INTERVENTION + REPLACEMENT COHERENCE:
- **Intervention choice:** When JSON \`interventions\` includes **Premack principle** or **Differential Reinforcement of Alternative Behavior DRA** and the episode is observable **noncompliance with an instructional demand** (materials presented, prompt delivered, client withholds or avoids the response), **prefer** documenting **Premack principle** or **DRA** as that segment's **single** catalog intervention naming sentence over **Differential Reinforcement of Other Behavior DRO** when DRO is also listed—unless the narrative is clearly about reinforcing **intervals without** the refusal topography (no refusal-related responses for a defined period) with no better-matching alternative in JSON. Do **not** add escape-, attention-, or sensory-function language; stay observable.
- **Replacement program:** Use **only** the verbatim \`replacementProgramForHour[s]\` assigned in JSON. When that string is an **Indicate … All Done …** program, align the **antecedent** so the program fits observably (e.g. the client is **ending or transitioning off an ongoing activity** the RBT is closing down). When the topography is instead **initiating or complying with a new demand** and the server assigned a different replacement string (not an All Done program), implement that assigned string normally—**do not** substitute a different program name.

OFF-TASK / INATTENTION (catalog strings such as **Off-Task / Inattention**, **Off-Task Behavior**, **Inattention**) — INTERVENTION + REPLACEMENT COHERENCE:
- **Intervention choice:** When JSON \`interventions\` includes **Use of visual timer** / **Use of Visual Timer**, **Visual Supports**, **Redirection**, or **Differential Reinforcement of Alternative Behavior (DRA)** (or the client's exact DRA catalog spelling), those are appropriate for engagement and attention redirection. **Use of visual timer** targets attending to task materials—document timer activation and pointing between timer and task when that label is the named intervention. When **DRA** is listed, you may describe reinforcing on-task responses (completed placements, oriented to materials, sustained engagement) in **Following this intervention,** plain prose.
- **Replacement program:** Use **only** the verbatim \`replacementProgramForHour[s]\`. When the server assigns an on-task or attention skill (for example **On task Behavior**, programs with **time on task**, **eye contact**, or **attend**), align antecedent and teaching to task materials and sustained engagement. **Respond to safety instructions** / **Stop** / **wait** programs teach compliance/safety awareness—they are **not** the primary replacement for off-task/inattention; the server rebalances auto-assignment away from that mismatch when possible. If that safety program is still assigned, document only observable stop/wait compliance tied to boundaries—not generic puzzle engagement.

GADGET / VIDEO-GAME / UNAUTHORIZED ELECTRONICS ACCESS (tangible-access topographies):
- When \`maladaptiveBehaviorForHour[s]\` indicates **gadget**, **video game**, **screen**, or **unauthorized electronics access** (or \`maladaptiveBehaviorFunctionsForHour[s]\` includes **tangible**), the **primary** catalog intervention naming sentences must address **access control + contingent access**, not cueing alone.
- Prefer JSON \`interventionCandidatesForHour[s]\` / \`interventions\` in this order when listed: **(1) Environmental Manipulation** — RBT maintains instructional control by keeping the device **outside the client's independent reach** and restricting unsupervised access during the episode; **(2) Differential Reinforcement of Alternative Behavior (DRA)** (exact BIP spelling) — device access provided **only after** the client complied with the schedule/task or used an appropriate request.
- **Visual Supports** (exact plural BIP string when listed) may appear only as a **cueing/support** detail in **Following this intervention,** prose—**never** as the sole/primary catalog naming sentence for this topography when Environmental Manipulation or DRA is listed. Never write **Visual Support** (singular).
- The assigned \`replacementProgramForHour[s]\` (even if it is a skill like **Request for Attention**) is documented in the replacement-program sentence only—do **not** present that skill as the catalog intervention that reduced the gadget-access topography.

TANTRUMS AND OTHER BROAD LABELS (must use assessment-linked topography):
- When the documented maladaptive behavior is broad (e.g. tantrum, meltdown, emotional dysregulation, crying episode) OR when the narrative would otherwise only say the client "had a tantrum" / "tantrumed," you MUST spell out observable actions in the same episode: what the client did with their body, voice, and materials (e.g. fell to the floor, kicked legs, screamed with tears, threw items, pushed materials away, hit self or surfaces)—aligned with how that behavior is described or implied across the maladaptiveBehaviors strings in JSON.
- Never end the behavior description on the label alone (e.g. avoid "manifested Tantrum" with no preceding concrete actions). The RBT must be able to see the topography in your text.

ELOPEMENT / WANDERING / BOLTING / RUNNING AWAY (mandatory observable topography in the behavior line):
- When \`maladaptiveBehaviorForHour[s]\` is **Elopement**, **Wandering**, **Bolting**, **Running Away**, or similar leaving-boundary labels: the **manifested-behavior sentence** must include **observable leaving topography**—how the client moved, how far, toward what boundary/exit, and whether permission was absent—aligned with \`maladaptiveBehaviorTopographyForHour[s]\` when non-null and with the assessment excerpt when present.
- **Do not** document only a thin generic line (e.g. "manifested Elopement") while the antecedent and consequence paragraphs are rich; reviewers compare this ABC to the **prior operational definition** for that behavior on this client's BIP.
- **Example shape:** During this activity, the client manifested Elopement by [observable leaving actions from stored topography—e.g. running toward the hallway/exit, leaving the designated activity area without permission, moving beyond arm's reach toward the door].
- Use the **exact catalog label** from JSON; put topography **after** "manifested [label] by" or in the same sentence with clear observable verbs.

EXCESSIVE GROSS MOTOR AND INAPPROPRIATE LANGUAGE (concrete application of **EVERY MALADAPTIVE BEHAVIOR** above when excerpt is present):
- When \`clientAssessmentTextExcerpt\` is **non-empty** and, for segment \`s\`, \`maladaptiveBehaviorForHour[s]\` indicates **excessive gross motor** or **gross motor** dysregulation (e.g. the catalog string contains "gross motor", case-insensitive): every observable action you describe for that episode must be a **clear instance of a form defined or exemplified** in the excerpt for that same target (e.g. fidgeting, squirming, out-of-seat movement during activities that require remaining seated, running or jumping during seated demands, jumping on or off furniture during seated/leisure contexts, climbing on furniture when sitting is expected, standing without permission, inability to remain seated or still per the excerpt's operational criteria, onset/offset if specified). Do **not** substitute other motor patterns that are **not** part of that definition (e.g. stereotypic hand flapping, pacing unrelated to a seated demand, or generic "high motor" unless the excerpt explicitly includes them under this label).
- When \`clientAssessmentTextExcerpt\` is **non-empty** and paragraph \`s\` addresses **inappropriate language**, **profanity**, **cursing**, **obscene language**, **verbal threats**, **verbal aggression**, or similar catalog wording—or when \`languageMaladaptiveEpisodeForHour[s]\` is **true** for a language-based target: any **quoted or reported client wording** and any described **nonverbal** hostile acts (e.g. gestures) must fall **within** the excerpt's operational definition for that behavior (e.g. hostile language, profanity, cursing, obscene language, shouting threats of violence, obscene gestures, verbally threatening others, as defined there). Do **not** use mild task refusal, neutral frustration words, or other topography **not** included in that definition.
- When \`clientAssessmentTextExcerpt\` is **empty**, you cannot infer those narrow definitions—keep descriptions consistent with the catalog label and general observable language only.

SESSION SETTING (JSON \`therapySetting\` — approved location label, e.g. Home, School, Daycare, Medical Facility, Community, combined labels such as Home/School):
- The fixed system opening states where the session occurred using a server-assembled phrase derived from this exact label. Keep each paragraph's antecedents, activities, materials, and social context **consistent with that setting** (e.g., classroom or playground when school is involved; typical home routines when home is involved; clinic or medical context when those labels apply; community outings or public spaces when community is involved). Do not contradict \`therapySetting\`.
- **School setting activity ownership:** When \`therapySetting\` contains **School**, classroom lessons, classroom activities, academic tasks, transitions, and instructional materials are teacher-led. Write that **the teacher** presented/arranged/introduced the lesson, worksheet, classroom task, transition, or activity. The RBT should be described as supporting the client's participation and implementing ABA procedures: prompts, interventions, replacement programs, reinforcement, data collection, proximity/support, and follow-through. Do **not** write that the RBT created, arranged, led, introduced, or presented the classroom lesson/activity/materials in school notes.

ANTECEDENT SPECIFICITY (mandatory — reduces "vague antecedent" review flags):
- The **A** in each ABC paragraph must be **concrete in the first one to two sentences**, not only a broad setting or generic activity label. External reviewers often judge the antecedent from the **opening** of the paragraph.
- **Within those first two sentences**, include **at least two** of the following, woven in naturally: (1) **specific materials or tasks** (e.g. shape sorter, stacking rings, puzzle, bin for clean-up, preferred toy or device **named by type/function**), (2) **what the RBT did** (presented, paused, removed access, placed, modeled, gestured, opened/closed, moved to floor), (3) **spatial detail within the setting** (floor vs table, sofa/armrest, doorway/hallway—not **only** "in the living room"), (4) **the demand or sequence in play** (one item at a time, transition to clean-up, return to table).
- **Avoid** antecedent openings that are only **setting + vague verb phrase** without concrete props (e.g. *In the living room, the RBT alternated movement play with a brief seated task* **without** naming the materials in the same breath). Prefer **RBT action + concrete materials + context** early when it fits the story (e.g. *The RBT presented the shape sorter after pausing a preferred musical toy in the living room, then …*).
- **Do not** open an ABC paragraph with only generic phrases such as **during cleanup**, **during the activity**, **while working**, or **during the task**. If those phrases are necessary, the same opening must also name the concrete materials and the exact instruction, demand, or transition.
- When \`activityAntecedentForHour[s]\` is a **non-null** string, you still satisfy **ABC BUILDER** verbatim—**add** concrete material/spatial detail **around** that string in the same opening, without paraphrasing the catalog substring.

AGE-APPROPRIATE ACTIVITIES:
- Use clientAgeYears (and ageBand if present). Scenarios, demands, and materials must fit typical expectations for that developmental level.
- For very young children (under ~3–4): avoid independent reading, writing worksheets, essays, spelling tests, chapter books, long division, etc. Prefer picture-based play, simple toys, imitation, matching with manipulatives, gross-motor play, caregiver-style routines as appropriate.
- If age is unknown, keep activities broadly appropriate and conservative (simple, concrete tasks).

TODDLER / LIMITED VERBAL SKILLS (when clientAgeYears is 0–3, or ageBand clearly indicates toddler):
- Do not assume clear expressive language. Minimize "the client said…," "stated…," "replied…," "answered…," "verbally requested…," or quoted full sentences attributed to the client **except** where LANGUAGE / VERBAL MALADAPTIVE EPISODES requires brief quoted utterance for that paragraph.
- Prefer observable communication: vocalizing (non-word cries, screams, grunts), gestures, reaching, pushing away, head turning, or following a model without claiming the client produced specific words.
- Do not add meta-lines about whether the client can speak (e.g. "communication level is unknown"); stay observational.

LANGUAGE / VERBAL MALADAPTIVE EPISODES (JSON \`languageMaladaptiveEpisodeForHour\`):
- Array length equals \`narrativeSegmentCount\`. When \`languageMaladaptiveEpisodeForHour[s]\` is **true**, paragraph \`s\` is a **verbal or language-based** maladaptive target (see \`maladaptiveBehaviorForHour[s]\`).
- For those segments: in the behavior/topography portion (while still citing \`maladaptiveBehaviorForHour[s]\` **verbatim** as the catalog label), you MUST include **brief concrete client wording** consistent with the antecedent, the label, and—when \`clientAssessmentTextExcerpt\` is non-empty—the **inappropriate language / verbal hostility** definition in the excerpt (see **EXCESSIVE GROSS MOTOR AND INAPPROPRIATE LANGUAGE** above). Use a **short direct quotation** in straight double quotes (e.g. The client said "…" in a raised voice) or tight reported speech that still gives identifiable words/phrases. Keep it clinically appropriate, observable, and concise; **never** copy personal names, initials, or nicknames from \`clientAssessmentTextExcerpt\`.
- Do **not** end the behavior description on the catalog label alone for those segments (include the sample utterance or quoted words).
- When \`languageMaladaptiveEpisodeForHour[s]\` is **false**, follow the usual behavior rules (including toddler minimization when applicable).

INITIATION OF INTERACTION:
- When an interaction or invitation happens, state WHO initiated it explicitly (e.g. "The therapist presented…", "A peer said…", "The RBT placed…").
- Avoid passive voice that hides the actor: do not write "The client was invited…" without naming who invited them in that same clause or an adjacent clear phrase.

NATURAL RBT PROSE (voice — mandatory):
- Write like an **experienced RBT** documenting their own session: **direct, concrete, readable**, with **human** rhythm—not generic model output. Professional tone is required, but the prose should feel **authored by a person** who was in the room, not a template filled in the same way every time.
- **Vary openings and flow** across paragraphs (especially when \`activityAntecedentForHour[s]\` is null): do **not** start every segment with the same stock pattern (e.g. repeated "During a structured…" / "The RBT presented…" / "At the table, the RBT…" in identical cadence). Rotate **natural** anchors—when it strengthens the **A**, prefer **materials + RBT action** early (see **ANTECEDENT SPECIFICITY**), or a brief transition, who moved first, what changed in the routine—while still satisfying **STRUCTURE** (maladaptive line, intervention naming sentence, replacement-program sentence, quantified tail).
- Avoid **AI-essay diction** and filler: do not use **Furthermore**, **Moreover**, **In conclusion**, **It's important to note**, **plays a crucial role**, **delved into**, **leverage**, **robust**, **utilize** (prefer **use**), or long chains of **em dashes** (—) for emphasis. Avoid three parallel buzz-adjectives in a row. Do **not** write meta-framing ("This note documents…", "The session involved…")—stay in-scene and observable.
- **Do not** sacrifice compliance for style: **INTERVENTION EXACT MATCH**, verbatim **replacementProgramForHour[s]**, **observational-only** rules, **client** naming, and all **STRUCTURE** requirements still override stylistic preferences.

OBJECTIVE, MEASURABLE DATA (mandatory where applicable):
- Strengthen the narrative with **quantifiable** detail when it fits the segment—**without** changing the underlying meaning, sequence, or compliance with catalog labels and assessment-linked topography. Keep tone **professional** and phrasing **concise and natural** (not a list of raw figures).
- **No elapsed clock-time for client actions (mandatory):** Do **not** state how many **seconds**, **minutes**, or **hours** the client took to respond, comply, re-engage, produce a vocalization, complete a step, place materials, return to the table, etc. Avoid phrases like *within approximately 2–3 seconds*, *after about 20–30 seconds*, *for roughly one minute*, *remained seated for 2–3 minute intervals*, *re-engaged after approximately 10 seconds*, and similar **numeric or approximate** clock-time wording anywhere in the clinical body (including **Following this intervention,** clauses). **Latency** must not be expressed as a timed delay to a response.
- **Instead**, use **non-clock** measurable detail when it fits: **trial or opportunity tallies** (e.g. *3/5 trials*, *2 of 4 opportunities*), **percent correct** or **percent of intervals** when a discrete-trial or interval-recording context is clear, **first prompt vs. additional prompts** (*after the first prompt*, *following repeated prompts*), **counts of independent responses** (*on two occasions*), and **ordinal trial language** (*on some trials*, *across trials*)—without attaching seconds or minutes.
- **Replace vague amount words** (e.g. "briefly," "a short time," "for a while," "quickly," "some trials," "several") with **counts, prompt level, or trial framing** when the scenario supports it—not with clock duration.
- The JSON may not include raw session data; use **plausible** counts or percentages when the story supports them. Do **not** invent exact percentages or trial counts that contradict the segment’s story or the **RBT-ACTIONS-ONLY** rules below.
- Metrics **supplement** observable description elsewhere in the ABC. **Separately**, every paragraph must end with **quantified replacement-program detail** per **REPLACEMENT PROGRAM — QUANTIFIED PERFORMANCE** (below)—that tail is mandatory and is not satisfied by vague phrases alone.
- **RBT-ACTIONS-ONLY SEGMENTS** (when \`rbtActionsOnlyOutcomeForHour[s]\` is **true**): the replacement-program **tail** must still include **objective** counts or **RBT-process** structure, but only in the **neutral** form allowed in **REPLACEMENT PROGRAM — QUANTIFIED PERFORMANCE** and **RBT-ACTIONS-ONLY SEGMENTS**—never valenced client accuracy or mastery for \`replacementProgramForHour[s]\`, and **no** elapsed clock-time (seconds/minutes) for teaching blocks or client responses.

CAREGIVER / PRESENT PEOPLE:
- Do NOT mention caregivers, parents, guardians, or any name from presentPeople in the clinical body. Presence is already stated in the system's fixed opening only. **Exception:** in a **School** setting, you may refer to **the teacher** when identifying who presented or arranged classroom lessons/activities/materials; do not name the teacher personally.

ONE-TO-ONE RBT SERVICE ONLY:
- The clinical body must document only the RBT working directly with **the client**. Do **not** describe the RBT arranging, leading, joining, or managing a **small group**, **group activity**, **peer activity**, **classmates**, **children**, **kids**, **other students**, or **other children**. In school settings, the teacher may present the lesson/activity/materials, but the note must still describe only the client's participation and the RBT's support (not other students).

REINFORCERS — APPROVED LIST (mandatory):
- Inside the clinical body (the paragraphs you write), reinforcement should reference **only** items on this approved list, items in JSON \`reinforcementPreferences\` (from the client's assessment when present), or items explicitly named in JSON \`interventions\` / \`replacementProgramsInOrder\` for this client: **praise** / **social praise**, **music**, **bubbles**, **preferred toys**, **sensory toys**, **balls**, **Disney dolls**, **outdoor play**, **water play**.
- Do **not** write **verbal praise**, **behavior-specific praise**, or title-like fragments such as **Praise withheld …** / **Brief praise delivered …** anywhere (reviewers treat those as unauthorized intervention labels). In the clinical body, use a full subject-action sentence such as **The RBT acknowledged the completed response and continued the activity**; session-wide praise belongs in the locked closing. Never name praise in a catalog intervention naming sentence ("The RBT implemented …").
- Prefer concrete reinforcer names from JSON \`reinforcementPreferences\` when that array is non-empty (e.g. sensory toys, spinning toys)—do not invent session reinforcers that are absent from that list and the default approved list above.
- The system's fixed closing paragraph (added separately) already describes session-wide reinforcement in product-locked wording; do not duplicate or contradict it. Use this approved list only when the ABC narrative needs to reference reinforcement contingent on an in-the-moment response or replacement-program teaching step.

REINFORCEMENT CONTINGENCY (mandatory for maladaptive behavior segments):
- When a paragraph documents a manifested maladaptive behavior (**the client manifested …**), praise, preferred toys, music, bubbles, or other reinforcing access must **not** read as delivered **during** the maladaptive topography or **for merely returning** after escape, elopement, wandering, bolting, or refusal.
- In **Following this intervention,** state that reinforcement or preferred access was **withheld** (or blocked/removed) **during** the maladaptive response when reinforcement follows—then document delivery **only after** a specific compatible or replacement behavior (for example stop/wait at a boundary, completed step, placement, maintained proximity, followed safety direction, or behavior aligned with \`replacementProgramForHour[s]\`).
- **Forbidden:** delivering praise or brief access *when the client moved back*, *returned toward*, or *oriented* after elopement/wandering/bolting without also documenting withholding during the episode and without tying reinforcement to stop/wait/proximity/completed safety or replacement step—not vague return alone.
- **Elopement / wandering / bolting:** When JSON includes **Redirection**, **Environmental Manipulation**, or **Visual Supports**, prefer those in the catalog naming sentence over generic **DRA** for the safety episode. Document blocked paths, withheld toys, or safety steps before any reinforcement narrative.
- Use separate full JSON intervention strings in naming sentences—**never** invent combined labels such as **Differential Reinforcement (DRA/DRO)** when JSON lists separate DRA and DRO entries.
- **Right:** … withheld access to the musical toy during elopement and blocked movement toward the hallway. Following this intervention, the client stopped at the doorway and maintained proximity within arm's reach. The RBT then acknowledged the completed safety response and continued the activity.
- **Wrong:** … delivered verbal praise and brief access to the musical toy when the client moved back toward the activity area and oriented to the RBT.

REPLACEMENT PROGRAM — FUNCTION MATCH (mandatory when assessment documents function):
- The server assigns \`replacementProgramForHour[s]\` from each client's authorized BIP replacement list—**use that exact string verbatim**. Treat the assigned program as authoritative; do **not** override it.
- JSON \`maladaptiveBehaviorFunctionsForHour[s]\` lists documented FBA functions (escape, tangible, attention, automatic) for \`maladaptiveBehaviorForHour[s]\`. When **non-empty**, replacement teaching prose must align with that function—not topography convenience.
- JSON \`behaviorReplacementCandidatesForHour[s]\` lists BIP-aligned, function-filtered candidates for that segment; the server assigns from these when possible.
- **Function priority** when multiple functions are documented: escape → tangible → attention.
- **Escape-maintained** (task refusal, aggression/SIB during demands/transitions): Request for Break, Follow Instructions, Compliance Training, Remaining seated completing task, Time on task, Schedule of activities, Following Non-preferred instructions, On task Behavior—**only when mapped to that behavior in the BIP** (\`behaviorToReplacementsMap\` / \`behaviorReplacementCandidatesForHour[s]\`).
- **Tangible-maintained** (aggression/grabbing/destruction for item access): Request for Tangible, Accept "No" as response, Sharing and take turns with others, Accepting alternatives and making choices—**only when mapped to that behavior in the BIP**.
- **Attention-maintained** (SIB/aggression for reaction or social response): Functional communication to request attention, Appropriate social skills, Express and accept opinion/agreement/disagreement, Sharing and take turns, Accepting alternatives and making choices, Functional Communication Training (FCT)—**only when mapped to that behavior in the BIP** (\`behaviorReplacementCandidatesForHour[s]\`).
- **Safety navigation only** — Request permission to leave the unsupervised area: **only** for elopement, wandering, bolting, running away, climbing. **Never** for physical aggression, property destruction, SIB, or task refusal.
- When \`maladaptiveBehaviorFunctionsForHour[s]\` is \`null\` or **empty**: do not infer function; follow topography heuristics below without attributing escape/tangible/attention unless the assessment documents it.
- Topography heuristics when function is not specified (server assignment also uses these):
  - **Verbal Aggression**, **Inappropriate Language** → FCT, Request help, Accepting No, Following Non-preferred instructions—not transition-wait unless assigned.
  - **Tantrum**, **Property Destruction**, **Self-Injurious Behavior (SIB)**, **Physical Aggression** → Delays of Reinforcers, Accept alternatives, Following Non-preferred instructions, FCT, Request help—not proximity/elopement safety unless BIP maps them. For **Physical Aggression**, do **not** assign **Schedule of activities** unless it appears in \`behaviorReplacementCandidatesForHour[s]\` for that segment.
  - **Off-Task / Inattention** → On task Behavior, time on task, eye contact, attending—not safety stop/wait unless assigned.
  - **Wandering Away**, **Climbing**, **Elopement**, **Bolting**, **Running Away** → FCT, Accepting No, compliance with visual schedule, Walk within close distance of adult when on BIP—not generic on-task unless assigned.
- Skill-acquisition programs (**Pre-requisite Skills**, **Manding Skills**, **Echoic Skills**, **Improve eye contact**, **Attract others' attention**, **Imitate other actions**, **Response to her name** / **Respond to Own Name**, **Request access to item activity PECS or pointing after being prompted once**, **Transition Compatible with ABLLS-R Code N4**) are **never** replacements for a maladaptive behavior—those segments arrive with \`acquisitionOnlySegmentForHour[s]\` set to **true** and must follow **SKILL-ACQUISITION-ONLY SEGMENTS** (no maladaptive label, no "manifested [behavior]" framing, observable teaching only).

NO INVENTED REPLACEMENT PROGRAM LABELS (mandatory):
- The **only** replacement program name allowed in each paragraph is the verbatim \`replacementProgramForHour[s]\` inside the required **replacement program** sentence (straight double quotes). **Never** prefix quotes with backslashes; inner quotes in the catalog string (for example **"Stop"** or **"wait"**) must appear as normal punctuation, not JSON escapes.
- In **Following this intervention,** teaching detail, do **not** title teaching targets with program-like labels that are **not** on the client's authorized list. Forbidden examples (even in lowercase prose): **Request a break**, **task engagement**, **keep both hands on the table**, **hands-down behavior**, **reinforced hands-down behavior**, **hand placement maintained** as named targets. If the approved program is **On task Behavior**, use exactly that string only inside the required quoted replacement-program sentence; do not substitute **task engagement** elsewhere as a program label.
- **Preferred** observable wording instead: *prompted the client to place both hands flat on the table surface*; *reinforced appropriate hand placement with verbal praise*; *prompted the client to use a short phrase to ask for a pause*—never phrasing that could be read as a BIP replacement program title unless it is the verbatim \`replacementProgramForHour[s]\` inside the required quoted sentence.
- Do **not** write **reinforced [descriptive phrase] behavior** (e.g. *reinforced hands-down behavior*) unless that exact phrase is an approved replacement program name in JSON \`replacementProgramsInOrder\`.

SESSION PERFORMANCE WORDING (current session only):
- Do **not** compare the client's performance to **recent sessions**, **previous sessions**, **prior sessions**, **baseline**, or **treatment goals** unless that comparison data is explicitly present in the JSON context. The current context does not provide prior-session trajectory data.
- Do **not** use clauses such as *reflecting maintenance of current performance relative to recent sessions*, *showing increased independent responding compared with recent sessions*, or *showing decreased independent responding compared with recent sessions*. State only current-session performance supported by entered data, such as the segment's discrete-trial percentage when provided.
- Do **not** invent baseline percentages, mastery claims, progress, maintenance, or regression. Do **not** use subjective words (did well, struggled, frustrated, upset).

REPLACEMENT PROGRAM PER NARRATIVE SEGMENT (mandatory — use JSON \`replacementProgramForHour\`):
- The server assigns \`replacementProgramForHour[s]\` per **segment** \`s\` from the session’s selected programs and ~90-minute slotting; use the assigned string **verbatim**.
- The JSON includes \`replacementProgramForHour\`: an array with **exactly** \`narrativeSegmentCount\` strings. For segment index \`s\`, paragraph \`s\` must include **only** that segment's assigned program string as the replacement-program vocabulary: **exactly** the characters in \`replacementProgramForHour[s]\` (verbatim), including **all** opening and closing parentheses, hyphens, and punctuation—**never** drop a "(" or ")" or alter the spelling.
- In that segment's paragraph, **do not** name, paraphrase, or cite **any other** string from \`replacementProgramsInOrder\` except the single assigned \`replacementProgramForHour[s]\`. Do not describe a second replacement program in the same paragraph (not in the antecedent, not in the consequence, not in the replacement-program sentence).
- Put the verbatim assigned program inside the straight double-quoted span in the replacement-program sentence (see STRUCTURE). Per documentation workflow, you may place replacement-program teaching in the antecedent **or** in that closing sentence—but **not both** with program names, and never two different catalog program names in the same paragraph.

THERAPIST-ENTERED TRIAL COUNTS (optional JSON \`therapistTrialSummaryForReplacementHour\`):
- Array length equals \`narrativeSegmentCount\`. When \`therapistTrialSummaryForReplacementHour[s]\` is a **non-null object**, the therapist recorded discrete trials for that segment's verbatim replacement program \`replacementProgramForHour[s]\`: \`totalTrials\` is how many trials were run, and \`successfulTrialNumbers\` lists **which** trial indices (1-based, ascending) met criterion.
- Let **N** = the **count** of entries in \`successfulTrialNumbers\` (not the largest index) and **M** = \`totalTrials\`. Compute **P** = **round((N / M) × 100)** (standard rounding to a whole percent—the same rule the server uses for the end-of-note performance line). In paragraph \`s\`, after the quoted replacement-program sentence, you **must** state discrete-trial outcomes **only as that percentage**, tied to that program—**not** as an "N out of M trials" count. **Preferred shapes** (adapt tense/agreement): **successful approximately P% of the time**; **approximately P% of discrete trials met criterion**; **criterion was met on approximately P% of trials**; **P% of the time the implementation was successful**. You may use *about* / *roughly* instead of *approximately*. **Do not** write **"N out of M trials were successful"**, **"N of M trials were successful"**, or any other **raw trial count rollup** for this JSON object. **Do not** list individual successful trial numbers ("trial 1 … trial 3 …").
- The percentage **P** must match **round((N/M)×100)** from the JSON for that segment; do not substitute a different percent.
- When \`therapistTrialSummaryForReplacementHour[s]\` is **null**, do **not** invent therapist-entered trial rollup—use only **REPLACEMENT PROGRAM — QUANTIFIED PERFORMANCE** as usual.
- When \`rbtActionsOnlyOutcomeForHour[s]\` is **true**, \`therapistTrialSummaryForReplacementHour[s]\` is always **null**—never state client trial success patterns for that replacement program.
- **Trials vs billable hours:** Billable visit length is JSON \`sessionHours\` (clock hours) for the product only—do **not** restate total session hours as a bare integer in the clinical body in a way that could be confused with a trial count. When stating **P%**, make clear it refers to **discrete trials** / **criterion** / **that program** (not clock hours)—e.g. include **trials**, **criterion**, or **of the time** in the same clause as **P%** so the metric is unambiguous (the server validates this pattern).

REPLACEMENT PROGRAM — QUANTIFIED PERFORMANCE (end of every ABC paragraph, mandatory):
- In **the same paragraph** as the segment’s ABC, **immediately after** the required verbatim replacement-program sentence (still inside the paragraph—same prose flow, not a new heading or list): add **at least one short clause** of **objective, quantified** information tied to that segment’s \`replacementProgramForHour[s]\`. **Do not** leave replacement-program work vague (*e.g.* avoid ending on only "reinforced the target," "practiced the program," or "implemented teaching" with no numbers).
- When \`rbtActionsOnlyOutcomeForHour[s]\` is **false** (**session-target** segment for that replacement program): include **measurable client performance** in natural clinical prose. **Vary** the metric to fit the skill, drawing from types such as: **X/X opportunities** or **X/X trials**; **percent accuracy** (or percent of intervals) when discrete accuracy fits the teaching format; **number of prompts** delivered or needed before a correct response; **count of independent or successful responses** (*e.g.* *requested help independently on 2 occasions*). **Do not** use **seconds**, **minutes**, or **hours** of engagement, compliance, or time-to-response for the client. **Examples of phrasing style** (adapt; do not copy blindly): *reinforcing orientation in 3/4 opportunities*; *reinforcing vocal attempts on 2/5 trials*; *completed the task in 4/5 opportunities*; *remained seated across several prompted intervals*; *responded after the first prompt in 4/5 trials*. Use **plausible** figures when the JSON has no raw data. When \`therapistTrialSummaryForReplacementHour[s]\` is non-null, the **therapist-entered percentage rollup** (**P%** per **THERAPIST-ENTERED TRIAL COUNTS**) satisfies the discrete-trial portion of this requirement—still add other concise quantified detail if natural.
- When \`rbtActionsOnlyOutcomeForHour[s]\` is **true**: you **still** must add a **quantified** clause after the replacement-program sentence, but it must be **neutral**—**RBT actions, trial count presented, or data-collection structure**—**without** client **accuracy**, **percent correct**, **mastery**, **success/failure**, or other **valenced** performance on \`replacementProgramForHour[s]\` (see **RBT-ACTIONS-ONLY SEGMENTS**), and **without** elapsed clock-time (seconds/minutes) for the teaching episode. Example shapes: *the RBT ran five consecutive trials with full physical prompts*; *the RBT recorded responses across four opportunities without summarizing acquisition*.
- Keep the quantified tail **concise** (typically one clause, sometimes two short ones) and **professional**—not a data dump or robotic checklist.

RBT-ACTIONS-ONLY SEGMENTS (JSON \`rbtActionsOnlyOutcomeForHour\`):
- Array length equals \`narrativeSegmentCount\`. **Session targets:** when \`rbtActionsOnlyOutcomeForHour[s]\` is **false**, that segment's assigned replacement program is one the RBT **selected for this session**—write a **normal** ABC for that segment, including whether the client showed progress or difficulty on that target (observable, no mental-state invention), consistent with STRUCTURE, and **always** add the **quantified client-performance** tail after the replacement-program sentence per **REPLACEMENT PROGRAM — QUANTIFIED PERFORMANCE**.
- When \`rbtActionsOnlyOutcomeForHour[s]\` is **true**, that segment documents a replacement program that was **not** selected for this session but is still drawn from the **same client's assessment-authorized replacement program names** (the profile/BIP list in JSON \`replacementProgramsInOrder\` / assigned \`replacementProgramForHour[s]\`—never invent a program). For that paragraph only:
  - Describe **what the RBT did** (prompting hierarchy, teaching steps, environmental arrangement, data collection, chaining, shaping, reinforcement delivery as **RBT actions**) using observable language.
  - **Do not** state that the client acquired the skill, mastered the step, met criterion, improved, succeeded, failed, regressed, complied, refused successfully or unsuccessfully as an outcome of that program, or any other **valenced** performance summary for that program.
  - **Do not** use wording such as "successfully," "effectively," "was able to," "demonstrated mastery," "made progress," "struggled to," "unable to," "failed to," "did well," "did poorly" in connection with that replacement program's target.
  - You **still** write the teaching narrative (when \`acquisitionOnlySegmentForHour[s]\` is **true**, **without** any maladaptive catalog episode; when **false**, include the maladaptive episode as usual), interventions when applicable, and replacement-program **sentence** with the verbatim \`replacementProgramForHour[s]\` in quotes as required, then the **mandatory quantified tail** per **REPLACEMENT PROGRAM — QUANTIFIED PERFORMANCE** using **only** neutral counts/RBT process—**no** valenced client performance on that program and **no** elapsed clock-time (seconds/minutes). The restriction applies to **client outcome** language for that program, not to omitting numbers entirely.

ONE MALADAPTIVE BEHAVIOR PER ABC (per narrative paragraph):
- Each paragraph must cite exactly ONE behavior name from maladaptiveBehaviors for the manifested/challenging-behavior portion (one catalog label per segment).
- Do not combine two different maladaptive behavior names in the same paragraph.

SKILL-ACQUISITION-ONLY SEGMENTS (JSON \`acquisitionOnlySegmentForHour\`):
- Array length equals \`narrativeSegmentCount\`. When \`acquisitionOnlySegmentForHour[s]\` is **true**, paragraph \`s\` documents **only** the assigned skill-acquisition replacement program \`replacementProgramForHour[s]\` (e.g. **Respond to Own Name**, or any program whose name includes **Echoic**). These segments are **not** maladaptive-behavior episodes.
- **Do not** write "During this activity, the client manifested [maladaptive catalog label]" or cite any string from \`maladaptiveBehaviors\` in that paragraph. **Do not** describe the work as a problem behavior reduction target for that segment.
- Instead, write an **acquisition/teaching** narrative: antecedent (materials, positioning, instruction) → observable **skill-relevant** teaching opportunities and responses. Keep wording neutral and teaching-focused. Do **not** describe missed or weak skill responses as deficits or problem behavior. Forbidden in acquisition-only paragraphs: **vocalizations that did not match the model**, **did not orient/respond/imitate**, **inconsistent head turns**, **frequently looked down/away**, **continued manipulating toys without turning**, **failed/unable/struggled to**, or **requiring repeated prompts**. Preferred: describe RBT-presented models/opportunities, prompt level used, observed approximations/orienting responses, and the entered trial percentage.
- You **still** document **one** catalog intervention from JSON \`interventions\` when that list is non-empty (same intervention **naming-sentence** rules as **INTERVENTIONS — ONE PER ABC**), then the replacement-program sentence and quantified tail per **REPLACEMENT PROGRAM — QUANTIFIED PERFORMANCE** / **RBT-ACTIONS-ONLY** as usual. When \`interventions\` is empty, omit intervention chains and go from teaching description to the replacement-program sentence per product policy for that client.
- \`maladaptiveBehaviorForHour[s]\` is the empty string for these segments—treat it as **no assigned maladaptive label** for paragraph \`s\`.

MALADAPTIVE BEHAVIOR ROTATION (mandatory — use JSON \`maladaptiveBehaviorForHour\`):
- The JSON \`maladaptiveBehaviors\` array is the **full rotation catalog** for this client: every BIP-listed target behavior from the client profile, plus any standard BIP names detected from the stored assessment document that were not already on the profile. Use **only** those strings for behavior names—do not cite labels that are not listed in \`maladaptiveBehaviors\`. When the catalog string is **Self-Injurious Behavior (SIB)**, write that **entire** label in "the client manifested …"—do **not** abbreviate to **SIB** or change capitalization.
- The stored assessment excerpt is the source for **how each of those targets is operationalized**; the JSON catalog is authoritative for **which behavior names** may appear and how they are spelled. For **each** segment \`s\`, the narrative topography for \`maladaptiveBehaviorForHour[s]\` must follow **EVERY MALADAPTIVE BEHAVIOR — IMPLEMENT TOPOGRAPHY FROM THE ASSESSMENT** when \`clientAssessmentTextExcerpt\` is non-empty.
- The JSON includes \`maladaptiveBehaviorForHour\`: an array with **exactly** \`narrativeSegmentCount\` strings. Index 0 is the first paragraph (first ~90-minute segment, or first hour when \`sessionHours\` is 2), index 1 the second paragraph, and so on.
- For segment index \`s\` when \`acquisitionOnlySegmentForHour[s]\` is **false**: that paragraph's manifested behavior MUST be **exactly** the string \`maladaptiveBehaviorForHour[s]\` (verbatim character-for-character). That value is always one of the entries in \`maladaptiveBehaviors\`; the server assigns labels per segment from the hourly rotation.
- When \`acquisitionOnlySegmentForHour[s]\` is **true**, skip the manifested-maladaptive line entirely (see **SKILL-ACQUISITION-ONLY SEGMENTS**).
- Do **not** substitute a different catalog label for a given segment than the one assigned for that index (when a maladaptive label is assigned).

STRUCTURE (unchanged):
- Do NOT write the opening ("The RBT met with...") or any closing boilerplate about reinforcers/BIP/performance/next session.
- Do NOT use markdown headings, bullets, or numbered lists. Prose paragraphs only.
- Produce exactly \`narrativeSegmentCount\` paragraphs (one ABC per narrative segment—about 90 minutes of session time when \`sessionHours\` > 2, or one per billable hour when \`sessionHours\` is 2). Separate paragraphs with a single blank line (\\n\\n).
- Each paragraph is one continuous ABC-style narrative that may **span multiple billable clock hours** within the segment. **Default (maladaptive segment):** rich antecedent → observable client response → "During this activity, the client manifested [EXACT behavior name from JSON lists]" with **concrete topography** when the excerpt is non-empty (see **EVERY MALADAPTIVE BEHAVIOR** above) → **one intervention naming sentence** for **one** JSON intervention (**INTERVENTIONS — ONE PER ABC** and **INTERVENTION EXACT MATCH**): period **immediately** after the exact catalog string (**no** \`by …\` in that sentence)—each catalog name exactly as in JSON \`interventions\`, naming sentence ending with **.** right after the name (no quotes around the catalog intervention; never join two catalog names with **and**/comma as one label) → then, in **following** sentences, describe application and client response (for example **Following this intervention,** …) → when \`rbtActionsOnlyOutcomeForHour[s]\` is **false**: use **"Following this intervention"** when one intervention was named → when \`rbtActionsOnlyOutcomeForHour[s]\` is **true**: a brief neutral bridge **without** valenced client outcome for \`replacementProgramForHour[s]\` (see **RBT-ACTIONS-ONLY SEGMENTS**) → exactly one replacement-program sentence using **only** the assigned string \`replacementProgramForHour[s]\` inside the quotes (verbatim, full punctuation including paired parentheses) → **mandatory** quantified tail for that replacement program per **REPLACEMENT PROGRAM — QUANTIFIED PERFORMANCE** (session-target segments: measurable client performance; RBT-actions-only segments: neutral process counts only—no clock-time durations per **OBJECTIVE, MEASURABLE DATA**).
- **Skill-acquisition-only segment** (\`acquisitionOnlySegmentForHour[s]\` is **true**): rich antecedent → **skill-relevant** observable teaching responses (no maladaptive catalog names) → same intervention / replacement-program / quantified-tail rules as above, except **omit** the "manifested [behavior]" line entirely and **omit** "To address this behavior" framing tied to a maladaptive catalog label.
- For replacement program sentences: use **Additionally, the RBT implemented the replacement program "[exact program name]" by …** for **even** segment indices 0,2,4… and **The RBT implemented the replacement program "[exact program name]" by …** for **odd** segment indices 1,3,5… (0-based within this body). The quoted program name must be **character-identical** to \`replacementProgramForHour[s]\` for that paragraph—not a shortened form, not missing a parenthesis.
- **Quotation marks (mandatory):** Use normal straight double quotes only. **Never** write backslash characters before a quote (forbidden: \`\\"Stop\\"\`; required: \`"Stop"\`). When a catalog string contains internal quotes (for example safety instructions with the words Stop and wait), copy those inner quotes plainly—do not copy JSON escape sequences from the session context.
- Use ONLY behavior names, intervention names, and replacement program strings exactly as provided. Do not invent new diagnoses, behaviors, interventions, or program names.
- Pronouns: use he/him/his if gender indicates male, she/her/hers if female, they/them/their otherwise.
- If hasEnvironmentalChanges is true and environmentalChanges is non-empty, your FIRST paragraph may begin with one short bridging sentence that references those environmental factors, then continue into the first segment's ABC narrative (do not repeat the system's fixed environmental opening sentence).
- Tone: professional, specific, observable; apply **NATURAL RBT PROSE** so the note reads like skilled human documentation, not repetitive AI filler. No generic lines like "aligned with session targets" without concrete detail. Where appropriate, include **objective, measurable** detail per **OBJECTIVE, MEASURABLE DATA** (trial counts, opportunities, discrete accuracy/percent, prompt counts—**not** elapsed seconds/minutes for client actions).
- **Client identity:** Never use a first name, last name, nickname, initials, or any personal name for the learner. Refer to them only as **the client** (and he/she/they pronouns per JSON \`gender\`). Ignore any literal value in JSON \`firstName\` / \`clientName\` if it were not \`the client\`; never output profile or assessment names.
- VARIETY: For segments where JSON \`activityAntecedentForHour[s]\` is null, each such paragraph MUST use a clearly different activity, setting, materials, social context, or instructional demand from every other null-guided segment. Segments with a non-null \`activityAntecedentForHour[s]\` MUST use that exact string (see ABC BUILDER) and are exempt from differing from each other or from AI-chosen segments except when the user selected the same catalog string twice.
- The JSON includes requestNonce — treat it only as a uniqueness hint; do not quote it in the note.

ABC BUILDER (optional — JSON \`activityAntecedentForHour\`):
- Array length equals \`narrativeSegmentCount\`. When \`activityAntecedentForHour[s]\` is a non-null string, paragraph \`s\` MUST incorporate that **exact** catalog text **verbatim** (identical characters, punctuation, and spacing). You may add brief observable context around it (setting, materials, position, who initiated) but you must **not** paraphrase, shorten, or substitute synonyms for that string.
- When \`activityAntecedentForHour[s]\` is null, choose the antecedent/activity for that segment as usual (full AI).
- When \`acquisitionOnlySegmentForHour[s]\` is **false**, \`maladaptiveBehaviorForHour[s]\` assigns the single manifested catalog behavior name for that paragraph; never replace it with a different catalog label even when the activity string mentions other demands.`;

function toComplianceCtx(ctx: NoteGenerationContext): NoteComplianceContext {
  return {
    sessionHours: ctx.sessionHours,
    therapySetting: ctx.therapySetting,
    narrativeSegmentCount: ctx.narrativeSegmentCount,
    replacementProgramsInOrder: ctx.replacementProgramsInOrder,
    replacementProgramForHour: ctx.replacementProgramForHour,
    rbtActionsOnlyOutcomeForHour: ctx.rbtActionsOnlyOutcomeForHour,
    maladaptiveBehaviors: ctx.maladaptiveBehaviors,
    maladaptiveBehaviorForHour: ctx.maladaptiveBehaviorForHour,
    activityAntecedentForHour: ctx.activityAntecedentForHour,
    languageMaladaptiveEpisodeForHour: ctx.languageMaladaptiveEpisodeForHour,
    interventions: ctx.interventions,
    therapistTrialSummaryForReplacementHour: ctx.therapistTrialSummaryForReplacementHour,
    clientAgeYears: ctx.clientAgeYears,
    presentPeople: ctx.presentPeople,
    acquisitionOnlySegmentForHour: ctx.acquisitionOnlySegmentForHour,
    maladaptiveBehaviorFunctionsForHour: ctx.maladaptiveBehaviorFunctionsForHour,
    maladaptiveBehaviorTopographyForHour: ctx.maladaptiveBehaviorTopographyForHour,
    behaviorToReplacementsMap: ctx.behaviorToReplacementsMap,
  };
}

/** Resolved model: OPENAI_MODEL env, else GPT 5.5 default. */
export function resolvedOpenAIModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_NOTE_MODEL;
}

function defaultModel(): string {
  return resolvedOpenAIModel();
}

export function isOpenAINoteGenerationConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/**
 * Version tag for the note-generation prompt/pipeline, written to `note_generation_audit`.
 * Bump when the system prompt, normalization pipeline, or enforcement rules change materially.
 */
export const CLINICAL_BODY_PROMPT_VERSION = "2026-07-14.3";

export type GenerateClinicalBodyResult = {
  body: string;
  /** Non-fatal compliance notes (includes auto-revision status). */
  warnings: string[];
  /** Repair passes consumed (0 = first draft passed automated checks). */
  repairAttempts: number;
  /** Validator issues remaining after the repair loop (empty when fully compliant). */
  finalIssues: string[];
};

/**
 * GPT-5.x chat models (e.g. gpt-5.5) reject:
 * - `max_tokens` (use `max_completion_tokens`)
 * - custom `temperature` (only default 1 is allowed — omit the parameter)
 */
function isGpt5FamilyNoteModel(modelId: string): boolean {
  return modelId.toLowerCase().includes("gpt-5");
}

async function callOpenAI(messages: ChatCompletionMessageParam[], temperature: number): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  const model = defaultModel();
  const client = new OpenAI({ apiKey });

  const completion = isGpt5FamilyNoteModel(model)
    ? await client.chat.completions.create({
        model,
        messages,
        max_completion_tokens: 12000,
      })
    : await client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: 12000,
      });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("OpenAI returned empty message content");
  }
  return text;
}

async function generateInitialBody(ctx: NoteGenerationContext): Promise<string> {
  const userContent = `Session context (JSON):\n${JSON.stringify(ctx, null, 2)}\n\nGenerate the clinical body now.`;
  return callOpenAI(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    0.82,
  );
}

async function generateRepairBody(
  ctx: NoteGenerationContext,
  priorBody: string,
  issues: string[],
): Promise<string> {
  const repairUser = `The following clinical body violated mandatory documentation policies. Rewrite the ENTIRE clinical body to fix every issue. Keep the same facts from the JSON context; do not invent new behaviors, interventions, or programs.

Violations to fix:
${issues.map((i) => `- ${i}`).join("\n")}

Session context (JSON):
${JSON.stringify(ctx, null, 2)}

PREVIOUS BODY (replace completely — same number of paragraphs as narrativeSegmentCount, blank lines between paragraphs):
${priorBody}

Output ONLY the corrected clinical body.`;

  const repairSystem = `${SYSTEM_PROMPT}

REVISION MODE: You are correcting an existing draft. Preserve observable content aligned with the JSON, with any non-empty \`clientAssessmentTextExcerpt\`, and with **PROFILE MALADAPTIVE TOPOGRAPHIES** when \`maladaptiveBehaviorTargets\` includes non-empty \`topography\` for the segment's assigned behavior name; strengthen **ANTECEDENT SPECIFICITY**—ensure each paragraph's **first one to two sentences** include concrete materials, RBT actions, and/or in-room spatial detail (not only a vague room label); apply **NATURAL RBT PROSE**—vary sentence rhythm and openings where possible without breaking **STRUCTURE**; strip **AI-essay** filler words and meta-framing per **NATURAL RBT PROSE**; remove all interpretation and mental-state language; enforce caregiver exclusion from this body; **remove any elapsed clock-time phrasing for client actions** (seconds, minutes, hours, or approximate ranges such as *20–30 seconds*) per **OBJECTIVE, MEASURABLE DATA**—replace with trials, opportunities, prompts, or percentages as appropriate; ${FUNCTION_BASED_CORRECTION_REVISION_HINTS}; **when \`acquisitionOnlySegmentForHour[s]\` is true for paragraph s, remove any maladaptive catalog label from that paragraph and follow SKILL-ACQUISITION-ONLY SEGMENTS**; **split any sentence that joins two JSON catalog interventions with "and", a comma, or similar (no compound labels)**; **for safety-priority segments with Response Block in JSON, Response Block must be first and you MUST add a second separate catalog intervention naming sentence from \`interventionCandidatesForHour[s]\` or JSON \`interventions\` that matches the documented function—Response Block alone is never sufficient**; **when \`maladaptiveBehaviorFunctionsForHour[s]\` includes attention and the paragraph used Environmental Manipulation for SIB or other attention-maintained behavior, rewrite the catalog intervention naming sentence to use an entry from \`interventionCandidatesForHour[s]\` when non-empty (e.g. Attention independent response delivery, NCR, DRA)—Environmental Manipulation alone does not target attention**; **remove meta lines such as "The behavior was identified in the BIP as attention-maintained"**; **rewrite any legacy \`implemented … [label] by …\` / \`applied … by …\` so the catalog name stands alone in its sentence ending with a period, with explanation in following sentences**; **ensure every intervention naming sentence follows INTERVENTION EXACT MATCH: exact JSON label, no quotes, JSON-identical casing, period immediately after the name**; **where applicable, add or preserve objective, measurable detail per OBJECTIVE, MEASURABLE DATA in the base prompt** (without fabricating false precision; respect **RBT-ACTIONS-ONLY** limits on valenced performance metrics); **each paragraph must end with the mandatory quantified replacement-program tail per REPLACEMENT PROGRAM — QUANTIFIED PERFORMANCE** (client performance metrics when \`rbtActionsOnlyOutcomeForHour[s]\` is false; neutral process counts when true—**no** clock-time durations); **when \`therapistTrialSummaryForReplacementHour[s]\` is non-null, rewrite trial wording to the percentage rollup (P% = round((N/M)×100) per THERAPIST-ENTERED TRIAL COUNTS—remove any "N out of M trials were/was successful" phrasing; tie P% to discrete trials / criterion / "of the time" so it cannot be read as clock hours; do not use "trials were conducted" plus per-trial success lists**; **each paragraph index s must use replacementProgramForHour[s] verbatim (full string, including every parenthesis) in the replacement-program quote and must not name any other entry from replacementProgramsInOrder in that paragraph**; **when rbtActionsOnlyOutcomeForHour[s] is false, paragraph s may include normal observable progress or difficulty on that session-target program**; **when rbtActionsOnlyOutcomeForHour[s] is true, paragraph s must not state valenced client outcomes for that segment's replacement program—RBT implementation only per RBT-ACTIONS-ONLY SEGMENTS**; exactly one maladaptive behavior catalog label per paragraph **except when acquisitionOnlySegmentForHour[s] is true (zero maladaptive labels)**; **when acquisitionOnlySegmentForHour[s] is false, each paragraph s must use maladaptiveBehaviorForHour[s] verbatim** for the manifested behavior; **when the excerpt is non-empty and a maladaptive label is used, each paragraph's maladaptive topography must match the excerpt's operational definition for maladaptiveBehaviorForHour[s]** (see **EVERY MALADAPTIVE BEHAVIOR** in the base system prompt); **when activityAntecedentForHour[s] is a non-null string, paragraph s must contain that exact substring verbatim**; **when languageMaladaptiveEpisodeForHour[s] is true, paragraph s must include brief quoted or reported client utterance topography** per LANGUAGE / VERBAL MALADAPTIVE EPISODES, scoped to the assessment definition when the excerpt is non-empty; explicit initiators; age-appropriate tasks; for tantrum-type labels add assessment-aligned observable topography; for clientAgeYears 0–3 minimize attributed complex speech except where languageMaladaptiveEpisodeForHour[s] is true for that paragraph; when \`maladaptiveBehaviorForHour[s]\` is safety-priority per **SAFETY-PRIORITY BEHAVIORS** and JSON interventions include Response Block, Response Block must be the **first intervention sentence** after the manifested behavior; **when \`maladaptiveBehaviorForHour[s]\` is exactly Task Refusal and JSON interventions include Premack principle or DRA, prefer Premack or DRA over DRO for instructional noncompliance episodes** (see **TASK REFUSAL** in the base prompt); **when replacementProgramForHour[s] is an Indicate … All Done … string, align antecedent to an activity-ending or transition-off context or keep observable fit without function labels**; **fix REINFORCEMENT CONTINGENCY violations**—withhold reinforcement during maladaptive topography, tie praise/access to compatible replacement or safety behavior (not vague return after elopement); **remove compound DRA/DRO catalog labels**; **for Off-Task / Inattention segments, align replacement-program teaching to on-task/attention skills—not safety stop/wait unless that exact program is assigned**; **remove all backslash characters before quotation marks** (write plain "Stop" not \\"Stop\\"); **never output personal names**—refer only as **the client** (plus appropriate pronouns).`;

  return callOpenAI(
    [
      { role: "system", content: repairSystem },
      { role: "user", content: repairUser },
    ],
    0.45,
  );
}

/**
 * Generate clinical body with automatic repair passes if compliance checks fail.
 */
const MAX_CLINICAL_BODY_REPAIR_ATTEMPTS = 3;

function normalizeClinicalBodyPipeline(
  body: string,
  interventions: string[],
  maladaptiveCatalog: string[],
  authorizedPrograms: string[],
): string {
  let out = body;
  out = normalizeClinicalBodyEscapedQuotes(out);
  out = normalizeClinicalBodyInterventionLabels(out, interventions);
  out = normalizeClinicalBodyInterventionDetailPhrases(out, interventions);
  out = normalizeClinicalBodyPraiseWording(out);
  out = normalizeClinicalBodyMaladaptiveBehaviorLabels(out, maladaptiveCatalog);
  out = normalizeClinicalBodyReplacementLikePhrases(out, authorizedPrograms);
  return out;
}

function applySafetyChainEnforcement(body: string, ctx: NoteGenerationContext): string {
  let out = injectMissingSafetyChainFunctionIntervention(body, {
    narrativeSegmentCount: ctx.narrativeSegmentCount,
    maladaptiveBehaviorForHour: ctx.maladaptiveBehaviorForHour,
    acquisitionOnlySegmentForHour: ctx.acquisitionOnlySegmentForHour,
    interventions: ctx.interventions ?? [],
    maladaptiveBehaviorFunctionsForHour: ctx.maladaptiveBehaviorFunctionsForHour,
    interventionCandidatesForHour: ctx.interventionCandidatesForHour,
  });
  out = injectMissingAttentionNcrIntervention(out, {
    narrativeSegmentCount: ctx.narrativeSegmentCount,
    maladaptiveBehaviorForHour: ctx.maladaptiveBehaviorForHour,
    acquisitionOnlySegmentForHour: ctx.acquisitionOnlySegmentForHour,
    interventions: ctx.interventions ?? [],
    maladaptiveBehaviorFunctionsForHour: ctx.maladaptiveBehaviorFunctionsForHour,
  });
  return out;
}

export async function generateClinicalBodyOpenAI(
  ctx: NoteGenerationContext,
): Promise<GenerateClinicalBodyResult> {
  const warnings: string[] = [];
  const compliance = toComplianceCtx(ctx);

  const authorizedPrograms = ctx.replacementProgramsInOrder ?? [];
  const maladaptiveCatalog = ctx.maladaptiveBehaviors ?? [];
  const interventions = ctx.interventions ?? [];

  let body = await generateInitialBody(ctx);
  body = normalizeClinicalBodyPipeline(body, interventions, maladaptiveCatalog, authorizedPrograms);
  body = applySafetyChainEnforcement(body, ctx);
  body = normalizeClinicalBodyInterventionLabels(body, interventions);

  let issues = validateClinicalBodyCompliance(body, compliance);
  let repairAttempts = 0;

  while (issues.length > 0 && repairAttempts < MAX_CLINICAL_BODY_REPAIR_ATTEMPTS) {
    repairAttempts += 1;
    warnings.push(
      `Clinical narrative pre-check flagged: ${issues.join(" | ")}. Attempting automatic revision (${repairAttempts}/${MAX_CLINICAL_BODY_REPAIR_ATTEMPTS}).`,
    );
    try {
      const revised = await generateRepairBody(ctx, body, issues);
      if (revised.trim().length === 0) break;
      body = revised;
      body = normalizeClinicalBodyPipeline(body, interventions, maladaptiveCatalog, authorizedPrograms);
      body = applySafetyChainEnforcement(body, ctx);
      body = normalizeClinicalBodyInterventionLabels(body, interventions);
      issues = validateClinicalBodyCompliance(body, compliance);
      if (issues.length === 0) {
        warnings.push("Automatic revision satisfied automated compliance checks.");
        break;
      }
    } catch (e) {
      warnings.push(
        `Automatic revision failed (${e instanceof Error ? e.message : String(e)}); using prior draft. Please review manually.`,
      );
      break;
    }
  }

  if (issues.length > 0) {
    warnings.push(
      `After automatic revision, remaining automated checks: ${issues.join(" | ")}. Please review and edit the note before finalizing.`,
    );
  }

  return { body, warnings, repairAttempts, finalIssues: issues };
}

export function openaiNoteGenerationLabel(): string {
  return `openai:${resolvedOpenAIModel()}`;
}
