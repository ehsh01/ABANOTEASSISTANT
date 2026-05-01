/**
 * OpenAI-powered clinical body for session notes.
 * Default model is GPT 5.3 (`gpt-5.3-chat-latest`). Override with OPENAI_MODEL if OpenAI publishes a different id.
 * Opening/closing locked prose is still assembled server-side in note-assembly.ts.
 */

import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {
  validateClinicalBodyCompliance,
  type NoteComplianceContext,
} from "./note-validation";
import type { TherapySetting } from "@workspace/therapy-settings";
import type { MaladaptiveBehaviorProfileEntry } from "@workspace/db/schema";

/** Chat Completions model id for note clinical body when OPENAI_MODEL is unset. */
export const DEFAULT_OPENAI_NOTE_MODEL = "gpt-5.3-chat-latest";

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
   * Optional ABC Builder: length = `narrativeSegmentCount`. Non-null entries are exact activity/antecedent catalog strings (first non-empty hour in that segment); null = AI chooses antecedent for that segment.
   */
  activityAntecedentForHour: (string | null)[];
  /**
   * Per segment: true when any hour in the segment had a language-type maladaptive target — narrative must include brief client-utterance topography for that segment when true.
   */
  languageMaladaptiveEpisodeForHour: boolean[];
  /**
   * Length = `narrativeSegmentCount`. Non-null when therapist-entered trial data applies to that segment's program.
   * The narrative must state that trial count and those trial numbers in natural clinical prose for the verbatim program name.
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
- Do not paste long quotes from the excerpt; paraphrase into observable session narrative.
- When \`clientAssessmentTextExcerpt\` is empty: rely on the JSON behavior, intervention, and replacement program lists only; do not invent assessment-level detail.

PROFILE MALADAPTIVE TOPOGRAPHIES (JSON \`maladaptiveBehaviorTargets\` — when entries include non-null \`topography\`):
- The JSON includes \`maladaptiveBehaviorTargets\`: an array parallel to \`maladaptiveBehaviors\` (same \`name\` strings in the same order). Each object has \`name\` (exact catalog label) and \`topography\` (RBT-entered operational text for that label, or null when not provided).
- For segment \`s\`, when \`maladaptiveBehaviorForHour[s]\` equals an entry's \`name\` and that entry's \`topography\` is non-empty after trim: treat that \`topography\` as **authoritative client-specific guidance** for what counts as that behavior and what observable actions/vocalizations/durations fit this target—**in addition to** \`clientAssessmentTextExcerpt\` when the excerpt is non-empty. Prefer consistency across sources; do **not** invent observable forms that are outside both the excerpt (when present) and the non-empty topography for that label.
- When the excerpt is **empty** but \`topography\` is non-empty for the assigned label, use that topography (not generic filler) to shape observable episode detail while still citing the behavior using the **exact JSON catalog string**.
- **Never copy personal names, initials, or nicknames from \`topography\` into your output.** The clinical body must refer to the learner only as **the client** (plus pronouns from JSON gender), even if the stored topography text names the individual.

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

BEHAVIOR DESCRIPTION:
- Describe only what the RBT could see or hear. No deductions about cause, intent, or emotional state.

BEHAVIOR CLASSIFICATION (use exact catalog labels from JSON; describe actions consistently):
- If a behavior label indicates physical aggression, describe actions directed AT A PERSON (hitting, kicking, pushing a person).
- If a behavior label indicates property destruction or similar, describe actions toward OBJECTS (throwing toys, breaking items, slamming materials)—not labeled as person-directed aggression unless the text clearly strikes a person.
- Do not re-label BIP vocabulary; stay faithful to the provided maladaptive behavior names while keeping descriptions observable.

SAFETY-PRIORITY BEHAVIORS — RESPONSE BLOCK FIRST (when listed in JSON):
- When \`maladaptiveBehaviorForHour[s]\` is **person-directed physical aggression** (catalog label contains **Physical Aggression**, case-insensitive) **or** clearly indicates **wandering**, **elopement/eloping**, **baiting**, **bolting**, or **running away**, and the exact string \`Response Block\` appears in JSON \`interventions\`, the **first** intervention **naming** sentence in the consequence chain must document **Response Block** (exact JSON spelling/capitalization). Do not invent Response Block if it is not in the list.
- Phrase that first intervention as **its own sentence** that **ends with a period immediately after the exact catalog string**—**no** technique description in that same sentence (for example: **To address this behavior, the RBT immediately implemented Response Block.**). Put observable blocking action and further clinical detail in **the next sentence(s)** (for example beginning with **Following this intervention,** …). Use the **exact** JSON string **with no surrounding quotes**, **identical capitalization** to JSON.
- **Only in this safety chain case** may you add **further separate naming sentences**, each naming **only one** JSON string and each ending with a period right after that catalog name, for additional JSON interventions. Do not place another listed intervention before Response Block when Response Block is in the JSON list.

INTERVENTIONS — ONE PER ABC (default) + EXACT MATCH (mandatory):
- For each narrative paragraph, after the manifested behavior line, document **exactly one** catalog intervention from JSON \`interventions\`—the single best match for that episode—using **one naming sentence** only: **The RBT implemented [exact JSON label].** or **To address this behavior, the RBT implemented [exact JSON label].** or **… applied [exact JSON label].** (period **immediately** after the catalog string). **Do not** append \`by …\` or any other explanation in that same sentence as the catalog name.
- **Exception:** only when \`maladaptiveBehaviorForHour[s]\` is safety-priority (physical aggression, wandering, elopement, baiting, bolting, running away) **and** \`Response Block\` is in JSON \`interventions\`, you may document **Response Block first** and then **one or more additional** interventions, **each in its own naming sentence** (see **SAFETY-PRIORITY BEHAVIORS** above). In all **other** segments, **do not** add a second catalog intervention naming sentence for another JSON string.
- **Never join two different catalog intervention names into one combined label** using **and**, a comma, **or**, **plus**, etc. (forbidden: **Premack principle and Prompt Hierarchy** as one noun phrase; **Redirection, DRA** as one label before one period; \`The RBT implemented A and B.\` when A and B are two different JSON strings).
- **Forbidden:** \`The RBT implemented "Redirection."\` with quotes around the catalog name; \`The RBT implemented Redirection, by …\` or \`The RBT implemented Redirection by …\` (any **by** clause attached to the catalog name in the naming sentence); \`The RBT implemented behavioral momentum.\` when JSON lists **Behavioral momentum** (wrong casing). **Semicolons** must not chain two catalog intervention names in one breath.
- **INTERVENTION EXACT MATCH (mandatory for validators):** In the **naming** sentence, write the **exact** JSON intervention substring with **no straight double quotes** around it and **character-for-character** spelling and capitalization from JSON \`interventions\`, then end that sentence with **.** right after the name. All **how/what was done** belongs in **following** sentences (never in the same sentence as the catalog label).
- **Wrong:** The RBT implemented Redirection by guiding the client back to the table. / The RBT implemented Differential Reinforcement of Alternative Behavior DRA by reinforcing gentle hands. / wrong-case catalog text vs JSON.
- **Right (typical segment):** The RBT implemented Redirection. Following this intervention, the client returned to the table and re-engaged with the activity. **Right (safety chain only):** To address this behavior, the RBT immediately implemented Response Block. Following this intervention, the RBT blocked further contact. The RBT implemented Environmental Manipulation. Following this intervention, …
- Use **only** intervention strings that appear in JSON \`interventions\`; do not invent or rename. If a strategy is not in the JSON list, do not label it with a catalog intervention name. If a single JSON string itself contains the word **and** (e.g. one BIP line reads Offer Choices and Redirection as one list entry), treat that entire string as **one** intervention label—do not split it.

TANTRUMS AND OTHER BROAD LABELS (must use assessment-linked topography):
- When the documented maladaptive behavior is broad (e.g. tantrum, meltdown, emotional dysregulation, crying episode) OR when the narrative would otherwise only say the client "had a tantrum" / "tantrumed," you MUST spell out observable actions in the same episode: what the client did with their body, voice, and materials (e.g. fell to the floor, kicked legs, screamed with tears, threw items, pushed materials away, hit self or surfaces)—aligned with how that behavior is described or implied across the maladaptiveBehaviors strings in JSON.
- Never end the behavior description on the label alone (e.g. avoid "manifested Tantrum" with no preceding concrete actions). The RBT must be able to see the topography in your text.

EXCESSIVE GROSS MOTOR AND INAPPROPRIATE LANGUAGE (concrete application of **EVERY MALADAPTIVE BEHAVIOR** above when excerpt is present):
- When \`clientAssessmentTextExcerpt\` is **non-empty** and, for segment \`s\`, \`maladaptiveBehaviorForHour[s]\` indicates **excessive gross motor** or **gross motor** dysregulation (e.g. the catalog string contains "gross motor", case-insensitive): every observable action you describe for that episode must be a **clear instance of a form defined or exemplified** in the excerpt for that same target (e.g. fidgeting, squirming, out-of-seat movement during activities that require remaining seated, running or jumping during seated demands, jumping on or off furniture during seated/leisure contexts, climbing on furniture when sitting is expected, standing without permission, inability to remain seated or still per the excerpt's operational criteria, onset/offset if specified). Do **not** substitute other motor patterns that are **not** part of that definition (e.g. stereotypic hand flapping, pacing unrelated to a seated demand, or generic "high motor" unless the excerpt explicitly includes them under this label).
- When \`clientAssessmentTextExcerpt\` is **non-empty** and paragraph \`s\` addresses **inappropriate language**, **profanity**, **cursing**, **obscene language**, **verbal threats**, **verbal aggression**, or similar catalog wording—or when \`languageMaladaptiveEpisodeForHour[s]\` is **true** for a language-based target: any **quoted or reported client wording** and any described **nonverbal** hostile acts (e.g. gestures) must fall **within** the excerpt's operational definition for that behavior (e.g. hostile language, profanity, cursing, obscene language, shouting threats of violence, obscene gestures, verbally threatening others, as defined there). Do **not** use mild task refusal, neutral frustration words, or other topography **not** included in that definition.
- When \`clientAssessmentTextExcerpt\` is **empty**, you cannot infer those narrow definitions—keep descriptions consistent with the catalog label and general observable language only.

SESSION SETTING (JSON \`therapySetting\` — approved location label, e.g. Home, School, Daycare, Medical Facility, Community, combined labels such as Home/School):
- The fixed system opening states where the session occurred using a server-assembled phrase derived from this exact label. Keep each paragraph's antecedents, activities, materials, and social context **consistent with that setting** (e.g., classroom or playground when school is involved; typical home routines when home is involved; clinic or medical context when those labels apply; community outings or public spaces when community is involved). Do not contradict \`therapySetting\`.

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

OBJECTIVE, MEASURABLE DATA (mandatory where applicable):
- Strengthen the narrative with **quantifiable** detail when it fits the segment—**without** changing the underlying meaning, sequence, or compliance with catalog labels and assessment-linked topography. Keep tone **professional** and phrasing **concise and natural** (not a list of raw figures).
- **Replace vague time and amount words** (e.g. "briefly," "a short time," "for a while," "quickly," "some trials," "several") with **approximate** duration, latency, or counts when the scenario supports it: **seconds or minutes** (e.g. *about 2 minutes*, *for roughly 15–20 seconds*), **trial tallies** (e.g. *3/5 trials*, *2 of 4 opportunities*), **percent correct** or **percent of intervals** when a discrete-trial, accuracy, or interval-recording context is clear from the antecedent/teaching description, and **latency** to compliance or return to task when relevant (e.g. *re-engaged after approximately 10 seconds*).
- **Example style** (illustrative only; adapt to each paragraph): prefer "The client returned to the table within approximately 15 seconds and remained seated for 2–3 minute intervals" over "The client returned to the table and remained seated for short intervals"—**only when** that level of detail matches the same observable story you would already tell in qualitative form.
- The JSON may not include raw session data; use **plausible, rounded** phrasing (*approximately*, *about*, *2–3 minutes*) rather than false precision. Do **not** invent exact percentages or trial counts that contradict the segment’s story or the **RBT-ACTIONS-ONLY** rules below.
- Metrics **supplement** observable description elsewhere in the ABC. **Separately**, every paragraph must end with **quantified replacement-program detail** per **REPLACEMENT PROGRAM — QUANTIFIED PERFORMANCE** (below)—that tail is mandatory and is not satisfied by vague phrases alone.
- **RBT-ACTIONS-ONLY SEGMENTS** (when \`rbtActionsOnlyOutcomeForHour[s]\` is **true**): the replacement-program **tail** must still include **objective** counts or durations, but only in the **neutral / RBT-process** form allowed in **REPLACEMENT PROGRAM — QUANTIFIED PERFORMANCE** and **RBT-ACTIONS-ONLY SEGMENTS**—never valenced client accuracy or mastery for \`replacementProgramForHour[s]\`.

CAREGIVER / PRESENT PEOPLE:
- Do NOT mention caregivers, parents, guardians, or any name from presentPeople in the clinical body. Presence is already stated in the system's fixed opening only.

REPLACEMENT PROGRAM PER NARRATIVE SEGMENT (mandatory — use JSON \`replacementProgramForHour\`):
- The server assigns \`replacementProgramForHour[s]\` per **segment** \`s\` from the session’s selected programs and ~90-minute slotting; use the assigned string **verbatim**.
- The JSON includes \`replacementProgramForHour\`: an array with **exactly** \`narrativeSegmentCount\` strings. For segment index \`s\`, paragraph \`s\` must include **only** that segment's assigned program string as the replacement-program vocabulary: **exactly** the characters in \`replacementProgramForHour[s]\` (verbatim), including **all** opening and closing parentheses, hyphens, and punctuation—**never** drop a "(" or ")" or alter the spelling.
- In that segment's paragraph, **do not** name, paraphrase, or cite **any other** string from \`replacementProgramsInOrder\` except the single assigned \`replacementProgramForHour[s]\`. Do not describe a second replacement program in the same paragraph (not in the antecedent, not in the consequence, not in the replacement-program sentence).
- Put the verbatim assigned program inside the straight double-quoted span in the replacement-program sentence (see STRUCTURE). Per documentation workflow, you may place replacement-program teaching in the antecedent **or** in that closing sentence—but **not both** with program names, and never two different catalog program names in the same paragraph.

THERAPIST-ENTERED TRIAL COUNTS (optional JSON \`therapistTrialSummaryForReplacementHour\`):
- Array length equals \`narrativeSegmentCount\`. When \`therapistTrialSummaryForReplacementHour[s]\` is a **non-null object**, the therapist recorded discrete trials for that segment's verbatim replacement program \`replacementProgramForHour[s]\`: \`totalTrials\` is how many trials were run, and \`successfulTrialNumbers\` lists **which** trial indices (1-based, ascending) met criterion.
- Let **N** = the **count** of entries in \`successfulTrialNumbers\` (not the largest index). In paragraph \`s\`, after the quoted replacement-program sentence, you **must** state outcomes in **rollup** form tied to that program: **"N out of totalTrials trials were successful"** or **"N of totalTrials trials were successful"** using the **exact** integers from JSON (\`successfulTrialNumbers.length\` for **N**, \`totalTrials\` for the denominator). When **N** is **1**, you may use **was** instead of **were** for agreement. **Do not** use phrasing like "**X** trials were conducted for …; trial **1** was successful" or listing individual successful trial numbers in prose—use the rollup only.
- **Do not** change **N** or \`totalTrials\`; they must match the JSON object exactly.
- When \`therapistTrialSummaryForReplacementHour[s]\` is **null**, do **not** invent therapist-entered trial rollup—use only **REPLACEMENT PROGRAM — QUANTIFIED PERFORMANCE** as usual.
- When \`rbtActionsOnlyOutcomeForHour[s]\` is **true**, \`therapistTrialSummaryForReplacementHour[s]\` is always **null**—never state client trial success patterns for that replacement program.

REPLACEMENT PROGRAM — QUANTIFIED PERFORMANCE (end of every ABC paragraph, mandatory):
- In **the same paragraph** as the segment’s ABC, **immediately after** the required verbatim replacement-program sentence (still inside the paragraph—same prose flow, not a new heading or list): add **at least one short clause** of **objective, quantified** information tied to that segment’s \`replacementProgramForHour[s]\`. **Do not** leave replacement-program work vague (*e.g.* avoid ending on only "reinforced the target," "practiced the program," or "implemented teaching" with no numbers).
- When \`rbtActionsOnlyOutcomeForHour[s]\` is **false** (**session-target** segment for that replacement program): include **measurable client performance** in natural clinical prose. **Vary** the metric to fit the skill, drawing from types such as: **X/X opportunities** or **X/X trials**; **percent accuracy** (or percent of intervals) when discrete accuracy fits the teaching format; **duration** of engagement or compliance (**seconds** or **minutes**, often approximate); **number of prompts** delivered or needed before a correct response; **count of independent or successful responses** (*e.g.* *requested help independently on 2 occasions*). **Examples of phrasing style** (adapt; do not copy blindly): *reinforcing orientation in 3/4 opportunities*; *reinforcing vocal attempts on 2/5 trials*; *completed the task in 4/5 opportunities*; *remained seated for approximately 3-minute intervals*; *responded after the first prompt in 4/5 trials*. Use **plausible rounded** figures when the JSON has no raw data (*approximately*, *about*). When \`therapistTrialSummaryForReplacementHour[s]\` is non-null, the **therapist-entered rollup** (**N out of M trials were/was successful**) satisfies the discrete-trial portion of this requirement—still add other concise quantified detail if natural.
- When \`rbtActionsOnlyOutcomeForHour[s]\` is **true**: you **still** must add a **quantified** clause after the replacement-program sentence, but it must be **neutral**—**RBT actions, trial count presented, duration of the teaching block, or data-collection structure**—**without** client **accuracy**, **percent correct**, **mastery**, **success/failure**, or other **valenced** performance on \`replacementProgramForHour[s]\` (see **RBT-ACTIONS-ONLY SEGMENTS**). Example shapes: *the RBT ran five consecutive trials with full physical prompts over about 4 minutes*; *the RBT recorded responses across four opportunities without summarizing acquisition*.
- Keep the quantified tail **concise** (typically one clause, sometimes two short ones) and **professional**—not a data dump or robotic checklist.

RBT-ACTIONS-ONLY SEGMENTS (JSON \`rbtActionsOnlyOutcomeForHour\`):
- Array length equals \`narrativeSegmentCount\`. **Session targets:** when \`rbtActionsOnlyOutcomeForHour[s]\` is **false**, that segment's assigned replacement program is one the RBT **selected for this session**—write a **normal** ABC for that segment, including whether the client showed progress or difficulty on that target (observable, no mental-state invention), consistent with STRUCTURE, and **always** add the **quantified client-performance** tail after the replacement-program sentence per **REPLACEMENT PROGRAM — QUANTIFIED PERFORMANCE**.
- When \`rbtActionsOnlyOutcomeForHour[s]\` is **true**, that segment documents a replacement program that was **not** selected for this session but is still drawn from the **same client's assessment-authorized replacement program names** (the profile/BIP list in JSON \`replacementProgramsInOrder\` / assigned \`replacementProgramForHour[s]\`—never invent a program). For that paragraph only:
  - Describe **what the RBT did** (prompting hierarchy, teaching steps, environmental arrangement, data collection, chaining, shaping, reinforcement delivery as **RBT actions**) using observable language.
  - **Do not** state that the client acquired the skill, mastered the step, met criterion, improved, succeeded, failed, regressed, complied, refused successfully or unsuccessfully as an outcome of that program, or any other **valenced** performance summary for that program.
  - **Do not** use wording such as "successfully," "effectively," "was able to," "demonstrated mastery," "made progress," "struggled to," "unable to," "failed to," "did well," "did poorly" in connection with that replacement program's target.
  - You **still** write the teaching narrative (when \`acquisitionOnlySegmentForHour[s]\` is **true**, **without** any maladaptive catalog episode; when **false**, include the maladaptive episode as usual), interventions when applicable, and replacement-program **sentence** with the verbatim \`replacementProgramForHour[s]\` in quotes as required, then the **mandatory quantified tail** per **REPLACEMENT PROGRAM — QUANTIFIED PERFORMANCE** using **only** neutral counts/durations/RBT process—**no** valenced client performance on that program. The restriction applies to **client outcome** language for that program, not to omitting numbers entirely.

ONE MALADAPTIVE BEHAVIOR PER ABC (per narrative paragraph):
- Each paragraph must cite exactly ONE behavior name from maladaptiveBehaviors for the manifested/challenging-behavior portion (one catalog label per segment).
- Do not combine two different maladaptive behavior names in the same paragraph.

SKILL-ACQUISITION-ONLY SEGMENTS (JSON \`acquisitionOnlySegmentForHour\`):
- Array length equals \`narrativeSegmentCount\`. When \`acquisitionOnlySegmentForHour[s]\` is **true**, paragraph \`s\` documents **only** the assigned skill-acquisition replacement program \`replacementProgramForHour[s]\` (e.g. **Respond to Own Name**, or any program whose name includes **Echoic**). These segments are **not** maladaptive-behavior episodes.
- **Do not** write "During this activity, the client manifested [maladaptive catalog label]" or cite any string from \`maladaptiveBehaviors\` in that paragraph. **Do not** describe the work as a problem behavior reduction target for that segment.
- Instead, write an **acquisition/teaching** narrative: antecedent (materials, positioning, instruction) → observable **skill-relevant** client responses (e.g. for **Respond to Own Name**: orienting or not orienting to name, latency to attend, glances toward speaker—**instructional** attention targets, **not** labeled as a maladaptive "inattention" catalog behavior). For **Echoic** programs: vocal imitation attempts, approximations, echo of model sounds—**instructional** vocal targets, **not** framed as a maladaptive catalog label.
- You **still** document **one** catalog intervention from JSON \`interventions\` when that list is non-empty (same intervention **naming-sentence** rules as **INTERVENTIONS — ONE PER ABC**), then the replacement-program sentence and quantified tail per **REPLACEMENT PROGRAM — QUANTIFIED PERFORMANCE** / **RBT-ACTIONS-ONLY** as usual. When \`interventions\` is empty, omit intervention chains and go from teaching description to the replacement-program sentence per product policy for that client.
- \`maladaptiveBehaviorForHour[s]\` is the empty string for these segments—treat it as **no assigned maladaptive label** for paragraph \`s\`.

MALADAPTIVE BEHAVIOR ROTATION (mandatory — use JSON \`maladaptiveBehaviorForHour\`):
- The JSON \`maladaptiveBehaviors\` array is the **full rotation catalog** for this client: every BIP-listed target behavior from the client profile, plus any standard BIP names detected from the stored assessment document that were not already on the profile. Use **only** those strings for behavior names—do not cite labels that are not listed in \`maladaptiveBehaviors\`.
- The stored assessment excerpt is the source for **how each of those targets is operationalized**; the JSON catalog is authoritative for **which behavior names** may appear and how they are spelled. For **each** segment \`s\`, the narrative topography for \`maladaptiveBehaviorForHour[s]\` must follow **EVERY MALADAPTIVE BEHAVIOR — IMPLEMENT TOPOGRAPHY FROM THE ASSESSMENT** when \`clientAssessmentTextExcerpt\` is non-empty.
- The JSON includes \`maladaptiveBehaviorForHour\`: an array with **exactly** \`narrativeSegmentCount\` strings. Index 0 is the first paragraph (first ~90-minute segment, or first hour when \`sessionHours\` is 2), index 1 the second paragraph, and so on.
- For segment index \`s\` when \`acquisitionOnlySegmentForHour[s]\` is **false**: that paragraph's manifested behavior MUST be **exactly** the string \`maladaptiveBehaviorForHour[s]\` (verbatim character-for-character). That value is always one of the entries in \`maladaptiveBehaviors\`; the server assigns labels per segment from the hourly rotation.
- When \`acquisitionOnlySegmentForHour[s]\` is **true**, skip the manifested-maladaptive line entirely (see **SKILL-ACQUISITION-ONLY SEGMENTS**).
- Do **not** substitute a different catalog label for a given segment than the one assigned for that index (when a maladaptive label is assigned).

STRUCTURE (unchanged):
- Do NOT write the opening ("The RBT met with...") or any closing boilerplate about reinforcers/BIP/performance/next session.
- Do NOT use markdown headings, bullets, or numbered lists. Prose paragraphs only.
- Produce exactly \`narrativeSegmentCount\` paragraphs (one ABC per narrative segment—about 90 minutes of session time when \`sessionHours\` > 2, or one per billable hour when \`sessionHours\` is 2). Separate paragraphs with a single blank line (\\n\\n).
- Each paragraph is one continuous ABC-style narrative that may **span multiple billable clock hours** within the segment. **Default (maladaptive segment):** rich antecedent → observable client response → "During this activity, the client manifested [EXACT behavior name from JSON lists]" with **concrete topography** when the excerpt is non-empty (see **EVERY MALADAPTIVE BEHAVIOR** above) → **one intervention naming sentence** for **one** JSON intervention (**INTERVENTIONS — ONE PER ABC** and **INTERVENTION EXACT MATCH**): period **immediately** after the exact catalog string (**no** \`by …\` in that sentence), **or** (safety-priority segment with Response Block in JSON) **Response Block first** then additional **separate** naming sentences as allowed—each catalog name exactly as in JSON \`interventions\`, each naming sentence ending with **.** right after the name (no quotes around the catalog intervention; never join two catalog names with **and**/comma as one label) → then, in **following** sentences, describe application and client response (for example **Following this intervention,** …) → when \`rbtActionsOnlyOutcomeForHour[s]\` is **false**: use **"Following this intervention"** when one intervention was named; use **"Following these interventions"** only when the paragraph documents **more than one** intervention naming sentence (safety chain) → when \`rbtActionsOnlyOutcomeForHour[s]\` is **true**: a brief neutral bridge **without** valenced client outcome for \`replacementProgramForHour[s]\` (see **RBT-ACTIONS-ONLY SEGMENTS**) → exactly one replacement-program sentence using **only** the assigned string \`replacementProgramForHour[s]\` inside the quotes (verbatim, full punctuation including paired parentheses) → **mandatory** quantified tail for that replacement program per **REPLACEMENT PROGRAM — QUANTIFIED PERFORMANCE** (session-target segments: measurable client performance; RBT-actions-only segments: neutral counts/durations only).
- **Skill-acquisition-only segment** (\`acquisitionOnlySegmentForHour[s]\` is **true**): rich antecedent → **skill-relevant** observable teaching responses (no maladaptive catalog names) → same intervention / replacement-program / quantified-tail rules as above, except **omit** the "manifested [behavior]" line entirely and **omit** "To address this behavior" framing tied to a maladaptive catalog label.
- For replacement program sentences: use "Additionally, the RBT implemented the replacement program \\"...\\" by ..." for **even** segment indices 0,2,4... and "The RBT implemented the replacement program \\"...\\" by ..." for **odd** segment indices 1,3,5... (0-based within this body). The \\"...\\" must be **character-identical** to \`replacementProgramForHour[s]\` for that paragraph—not a shortened form, not missing a parenthesis.
- Use ONLY behavior names, intervention names, and replacement program strings exactly as provided. Do not invent new diagnoses, behaviors, interventions, or program names.
- Pronouns: use he/him/his if gender indicates male, she/her/hers if female, they/them/their otherwise.
- If hasEnvironmentalChanges is true and environmentalChanges is non-empty, your FIRST paragraph may begin with one short bridging sentence that references those environmental factors, then continue into the first segment's ABC narrative (do not repeat the system's fixed environmental opening sentence).
- Tone: professional, specific, observable; no generic filler like "aligned with session targets" without concrete detail. Where appropriate, include **objective, measurable** detail per **OBJECTIVE, MEASURABLE DATA** (durations, trial counts, latency, or discrete accuracy/percent when the scenario supports it).
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
  };
}

/** Resolved model: OPENAI_MODEL env, else GPT 5.3 default. */
export function resolvedOpenAIModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_NOTE_MODEL;
}

function defaultModel(): string {
  return resolvedOpenAIModel();
}

export function isOpenAINoteGenerationConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export type GenerateClinicalBodyResult = {
  body: string;
  /** Non-fatal compliance notes (includes auto-revision status). */
  warnings: string[];
};

/**
 * GPT-5.x chat models (e.g. gpt-5.3-chat-latest) reject:
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

REVISION MODE: You are correcting an existing draft. Preserve observable content aligned with the JSON, with any non-empty \`clientAssessmentTextExcerpt\`, and with **PROFILE MALADAPTIVE TOPOGRAPHIES** when \`maladaptiveBehaviorTargets\` includes non-empty \`topography\` for the segment's assigned behavior name; remove all interpretation and mental-state language; enforce caregiver exclusion from this body; **when \`acquisitionOnlySegmentForHour[s]\` is true for paragraph s, remove any maladaptive catalog label from that paragraph and follow SKILL-ACQUISITION-ONLY SEGMENTS**; **split any sentence that joins two JSON catalog interventions with "and", a comma, or similar (no compound labels)**; **by default keep only one catalog intervention naming sentence per paragraph** (one **The RBT implemented [exact label].** / **… applied [exact label].** ending with a period right after the name)—**remove extra intervention naming sentences** unless the segment is safety-priority with Response Block in JSON (then Response Block first, then optional additional **separate** naming sentences); **rewrite any legacy \`implemented … [label] by …\` / \`applied … by …\` so the catalog name stands alone in its sentence ending with a period, with explanation in following sentences**; **ensure every intervention naming sentence follows INTERVENTION EXACT MATCH: exact JSON label, no quotes, JSON-identical casing, period immediately after the name**; **where applicable, add or preserve objective, measurable detail per OBJECTIVE, MEASURABLE DATA in the base prompt** (without fabricating false precision; respect **RBT-ACTIONS-ONLY** limits on valenced performance metrics); **each paragraph must end with the mandatory quantified replacement-program tail per REPLACEMENT PROGRAM — QUANTIFIED PERFORMANCE** (client performance metrics when \`rbtActionsOnlyOutcomeForHour[s]\` is false; neutral process counts/durations when true); **when \`therapistTrialSummaryForReplacementHour[s]\` is non-null, rewrite trial wording to the rollup form ("N out of M trials were/was successful") per THERAPIST-ENTERED TRIAL COUNTS—do not use "trials were conducted" plus per-trial success lists**; **each paragraph index s must use replacementProgramForHour[s] verbatim (full string, including every parenthesis) in the replacement-program quote and must not name any other entry from replacementProgramsInOrder in that paragraph**; **when rbtActionsOnlyOutcomeForHour[s] is false, paragraph s may include normal observable progress or difficulty on that session-target program**; **when rbtActionsOnlyOutcomeForHour[s] is true, paragraph s must not state valenced client outcomes for that segment's replacement program—RBT implementation only per RBT-ACTIONS-ONLY SEGMENTS**; exactly one maladaptive behavior catalog label per paragraph **except when acquisitionOnlySegmentForHour[s] is true (zero maladaptive labels)**; **when acquisitionOnlySegmentForHour[s] is false, each paragraph s must use maladaptiveBehaviorForHour[s] verbatim** for the manifested behavior; **when the excerpt is non-empty and a maladaptive label is used, each paragraph's maladaptive topography must match the excerpt's operational definition for maladaptiveBehaviorForHour[s]** (see **EVERY MALADAPTIVE BEHAVIOR** in the base system prompt); **when activityAntecedentForHour[s] is a non-null string, paragraph s must contain that exact substring verbatim**; **when languageMaladaptiveEpisodeForHour[s] is true, paragraph s must include brief quoted or reported client utterance topography** per LANGUAGE / VERBAL MALADAPTIVE EPISODES, scoped to the assessment definition when the excerpt is non-empty; explicit initiators; age-appropriate tasks; for tantrum-type labels add assessment-aligned observable topography; for clientAgeYears 0–3 minimize attributed complex speech except where languageMaladaptiveEpisodeForHour[s] is true for that paragraph; when \`maladaptiveBehaviorForHour[s]\` is safety-priority per **SAFETY-PRIORITY BEHAVIORS** and JSON interventions include Response Block, Response Block must be the **first intervention sentence** after the manifested behavior; **never output personal names**—refer only as **the client** (plus appropriate pronouns).`;

  return callOpenAI(
    [
      { role: "system", content: repairSystem },
      { role: "user", content: repairUser },
    ],
    0.45,
  );
}

/**
 * Generate clinical body with one automatic repair pass if compliance checks fail.
 */
export async function generateClinicalBodyOpenAI(
  ctx: NoteGenerationContext,
): Promise<GenerateClinicalBodyResult> {
  const warnings: string[] = [];
  const compliance = toComplianceCtx(ctx);

  let body = await generateInitialBody(ctx);
  let issues = validateClinicalBodyCompliance(body, compliance);

  if (issues.length > 0) {
    warnings.push(
      `Clinical narrative pre-check flagged: ${issues.join(" | ")}. Attempting one automatic revision.`,
    );
    try {
      const revised = await generateRepairBody(ctx, body, issues);
      if (revised.trim().length > 0) {
        body = revised;
        issues = validateClinicalBodyCompliance(body, compliance);
        if (issues.length === 0) {
          warnings.push("Automatic revision satisfied automated compliance checks.");
        } else {
          warnings.push(
            `After automatic revision, remaining automated checks: ${issues.join(" | ")}. Please review and edit the note before finalizing.`,
          );
        }
      }
    } catch (e) {
      warnings.push(
        `Automatic revision failed (${e instanceof Error ? e.message : String(e)}); using prior draft. Please review manually.`,
      );
    }
  }

  return { body, warnings };
}

export function openaiNoteGenerationLabel(): string {
  return `openai:${resolvedOpenAIModel()}`;
}
