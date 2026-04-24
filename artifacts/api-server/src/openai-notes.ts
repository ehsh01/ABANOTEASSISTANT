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
  sessionHours: number;
  sessionDate: string;
  /** Approved session location label; align antecedents and setting with this. */
  therapySetting: TherapySetting;
  presentPeople: string[];
  hasEnvironmentalChanges: boolean;
  environmentalChanges: string;
  maladaptiveBehaviors: string[];
  /**
   * Exact catalog behavior for each hour (length = sessionHours), server-computed by cycling `maladaptiveBehaviors` in order.
   */
  maladaptiveBehaviorForHour: string[];
  interventions: string[];
  /** Authorized replacement program names for this client (compliance / “no extra program names” checks). */
  replacementProgramsInOrder: string[];
  /**
   * Exact replacement program string for each hour (length = sessionHours); server assigns from linked programs
   * (selected first, then others) for hours without an explicit ABC Builder program id.
   * The clinical body must use only this name for replacement-program content in paragraph h (verbatim, all punctuation).
   */
  replacementProgramForHour: string[];
  /**
   * Per hour: when true, that hour documents a linked replacement program that was **not** among the session's
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
   * Optional ABC Builder: length = sessionHours. Non-null entries are exact activity/antecedent catalog strings the RBT selected; null = AI chooses antecedent for that hour.
   */
  activityAntecedentForHour: (string | null)[];
  /**
   * Per hour: true when maladaptiveBehaviorForHour[h] is classified as verbal/language-type — narrative must include brief generated client-utterance topography (quoted or reported speech) for that hour.
   */
  languageMaladaptiveEpisodeForHour: boolean[];
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

EVERY MALADAPTIVE BEHAVIOR — IMPLEMENT TOPOGRAPHY FROM THE ASSESSMENT (mandatory when excerpt is non-empty):
- **Before** you write the maladaptive episode for hour \`h\`, use \`clientAssessmentTextExcerpt\` to find how **\`maladaptiveBehaviorForHour[h]\`** is **defined, operationalized, and exemplified** (headings, "defined as," examples, onset/offset, settings). You still cite the behavior using the **exact JSON catalog string**; the excerpt tells you **what counts** as that behavior and **what observable forms** are in scope.
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

PHYSICAL AGGRESSION — RESPONSE BLOCK FIRST (when listed in JSON):
- When the hour's manifested maladaptive behavior is person-directed physical aggression (including when the exact catalog label contains "Physical Aggression"), the **first** intervention after "To address this behavior" (or "these behaviors") must be **Response Block** — but **only** if the exact string \`Response Block\` appears in the JSON \`interventions\` array (use that exact spelling/capitalization from JSON). Do not invent Response Block if it is not in the list.
- Phrase the first consequence sentence like: "To address this behavior, the RBT immediately implemented [exact Response Block string from JSON] by [observable blocking action to prevent further contact]."
- After immediate safety is addressed, additional interventions may follow in separate clauses (e.g. "Once the immediate safety concern was addressed, the RBT then implemented [exact second intervention name from JSON] by ..."). Do not place another listed intervention before Response Block in that sequence when Response Block is in the JSON list.

TANTRUMS AND OTHER BROAD LABELS (must use assessment-linked topography):
- When the documented maladaptive behavior is broad (e.g. tantrum, meltdown, emotional dysregulation, crying episode) OR when the narrative would otherwise only say the client "had a tantrum" / "tantrumed," you MUST spell out observable actions in the same episode: what the client did with their body, voice, and materials (e.g. fell to the floor, kicked legs, screamed with tears, threw items, pushed materials away, hit self or surfaces)—aligned with how that behavior is described or implied across the maladaptiveBehaviors strings in JSON.
- Never end the behavior description on the label alone (e.g. avoid "manifested Tantrum" with no preceding concrete actions). The RBT must be able to see the topography in your text.

EXCESSIVE GROSS MOTOR AND INAPPROPRIATE LANGUAGE (concrete application of **EVERY MALADAPTIVE BEHAVIOR** above when excerpt is present):
- When \`clientAssessmentTextExcerpt\` is **non-empty** and, for hour \`h\`, \`maladaptiveBehaviorForHour[h]\` indicates **excessive gross motor** or **gross motor** dysregulation (e.g. the catalog string contains "gross motor", case-insensitive): every observable action you describe for that episode must be a **clear instance of a form defined or exemplified** in the excerpt for that same target (e.g. fidgeting, squirming, out-of-seat movement during activities that require remaining seated, running or jumping during seated demands, jumping on or off furniture during seated/leisure contexts, climbing on furniture when sitting is expected, standing without permission, inability to remain seated or still per the excerpt's operational criteria, onset/offset if specified). Do **not** substitute other motor patterns that are **not** part of that definition (e.g. stereotypic hand flapping, pacing unrelated to a seated demand, or generic "high motor" unless the excerpt explicitly includes them under this label).
- When \`clientAssessmentTextExcerpt\` is **non-empty** and paragraph \`h\` addresses **inappropriate language**, **profanity**, **cursing**, **obscene language**, **verbal threats**, **verbal aggression**, or similar catalog wording—or when \`languageMaladaptiveEpisodeForHour[h]\` is **true** for a language-based target: any **quoted or reported client wording** and any described **nonverbal** hostile acts (e.g. gestures) must fall **within** the excerpt's operational definition for that behavior (e.g. hostile language, profanity, cursing, obscene language, shouting threats of violence, obscene gestures, verbally threatening others, as defined there). Do **not** use mild task refusal, neutral frustration words, or other topography **not** included in that definition.
- When \`clientAssessmentTextExcerpt\` is **empty**, you cannot infer those narrow definitions—keep descriptions consistent with the catalog label and general observable language only.

SESSION SETTING (JSON \`therapySetting\` — approved location label, e.g. Home, School, Daycare, Medical Facility, Community, combined labels such as Home/School):
- The fixed system opening states where the session occurred using a server-assembled phrase derived from this exact label. Keep each hour's antecedents, activities, materials, and social context **consistent with that setting** (e.g., classroom or playground when school is involved; typical home routines when home is involved; clinic or medical context when those labels apply; community outings or public spaces when community is involved). Do not contradict \`therapySetting\`.

AGE-APPROPRIATE ACTIVITIES:
- Use clientAgeYears (and ageBand if present). Scenarios, demands, and materials must fit typical expectations for that developmental level.
- For very young children (under ~3–4): avoid independent reading, writing worksheets, essays, spelling tests, chapter books, long division, etc. Prefer picture-based play, simple toys, imitation, matching with manipulatives, gross-motor play, caregiver-style routines as appropriate.
- If age is unknown, keep activities broadly appropriate and conservative (simple, concrete tasks).

TODDLER / LIMITED VERBAL SKILLS (when clientAgeYears is 0–3, or ageBand clearly indicates toddler):
- Do not assume clear expressive language. Minimize "the client said…," "stated…," "replied…," "answered…," "verbally requested…," or quoted full sentences attributed to the client **except** where LANGUAGE / VERBAL MALADAPTIVE EPISODES requires brief quoted utterance for that hour.
- Prefer observable communication: vocalizing (non-word cries, screams, grunts), gestures, reaching, pushing away, head turning, or following a model without claiming the client produced specific words.
- Do not add meta-lines about whether the client can speak (e.g. "communication level is unknown"); stay observational.

LANGUAGE / VERBAL MALADAPTIVE EPISODES (JSON \`languageMaladaptiveEpisodeForHour\`):
- Array length equals \`sessionHours\`. When \`languageMaladaptiveEpisodeForHour[h]\` is **true**, paragraph \`h\` is a **verbal or language-based** maladaptive target (see \`maladaptiveBehaviorForHour[h]\`).
- For those hours: in the behavior/topography portion (while still citing \`maladaptiveBehaviorForHour[h]\` **verbatim** as the catalog label), you MUST include **brief concrete client wording** consistent with the antecedent, the label, and—when \`clientAssessmentTextExcerpt\` is non-empty—the **inappropriate language / verbal hostility** definition in the excerpt (see **EXCESSIVE GROSS MOTOR AND INAPPROPRIATE LANGUAGE** above). Use a **short direct quotation** in straight double quotes (e.g. The client said "…" in a raised voice) or tight reported speech that still gives identifiable words/phrases. Keep it clinically appropriate, observable, and concise; **never** copy personal names, initials, or nicknames from \`clientAssessmentTextExcerpt\`.
- Do **not** end the behavior description on the catalog label alone for those hours (include the sample utterance or quoted words).
- When \`languageMaladaptiveEpisodeForHour[h]\` is **false**, follow the usual behavior rules (including toddler minimization when applicable).

INITIATION OF INTERACTION:
- When an interaction or invitation happens, state WHO initiated it explicitly (e.g. "The therapist presented…", "A peer said…", "The RBT placed…").
- Avoid passive voice that hides the actor: do not write "The client was invited…" without naming who invited them in that same clause or an adjacent clear phrase.

CAREGIVER / PRESENT PEOPLE:
- Do NOT mention caregivers, parents, guardians, or any name from presentPeople in the clinical body. Presence is already stated in the system's fixed opening only.

REPLACEMENT PROGRAM PER HOUR (mandatory — use JSON \`replacementProgramForHour\`):
- The JSON includes \`replacementProgramForHour\`: an array with **exactly** \`sessionHours\` strings. For hour index \`h\`, paragraph \`h\` must include **only** that hour's assigned program string as the replacement-program vocabulary: **exactly** the characters in \`replacementProgramForHour[h]\` (verbatim), including **all** opening and closing parentheses, hyphens, and punctuation—**never** drop a "(" or ")" or alter the spelling.
- In that hour's paragraph, **do not** name, paraphrase, or cite **any other** string from \`replacementProgramsInOrder\` except the single assigned \`replacementProgramForHour[h]\`. Do not describe a second replacement program in the same hour (not in the antecedent, not in the consequence, not in the replacement-program sentence).
- Put the verbatim assigned program inside the straight double-quoted span in the replacement-program sentence (see STRUCTURE). Per documentation workflow, you may place replacement-program teaching in the antecedent **or** in that closing sentence—but **not both** with program names, and never two different catalog program names in the same paragraph.

RBT-ACTIONS-ONLY HOURS (JSON \`rbtActionsOnlyOutcomeForHour\`):
- Array length equals \`sessionHours\`. **Session targets:** when \`rbtActionsOnlyOutcomeForHour[h]\` is **false**, that hour's assigned replacement program is one the RBT **selected for this session**—write a **normal** ABC for that hour, including whether the client showed progress or difficulty on that target (observable, no mental-state invention), consistent with STRUCTURE.
- When \`rbtActionsOnlyOutcomeForHour[h]\` is **true**, that hour documents a replacement program that was **not** selected for this session but is still drawn from the **same client's assessment-authorized replacement program names** (the profile/BIP list in JSON \`replacementProgramsInOrder\` / assigned \`replacementProgramForHour[h]\`—never invent a program). For that paragraph only:
  - Describe **what the RBT did** (prompting hierarchy, teaching steps, environmental arrangement, data collection, chaining, shaping, reinforcement delivery as **RBT actions**) using observable language.
  - **Do not** state that the client acquired the skill, mastered the step, met criterion, improved, succeeded, failed, regressed, complied, refused successfully or unsuccessfully as an outcome of that program, or any other **valenced** performance summary for that program.
  - **Do not** use wording such as "successfully," "effectively," "was able to," "demonstrated mastery," "made progress," "struggled to," "unable to," "failed to," "did well," "did poorly" in connection with that replacement program's target.
  - You **still** write the maladaptive episode, interventions, and replacement-program **sentence** with the verbatim \`replacementProgramForHour[h]\` in quotes as required; the restriction applies to **outcome framing after the intervention** for that program—keep it neutral and RBT-implementation-focused (e.g., continued teaching trials, prompted the next step, collected data, ended the teaching round) without evaluating the client's acquisition for that program.

ONE MALADAPTIVE BEHAVIOR PER ABC (per hour paragraph):
- Each paragraph must cite exactly ONE behavior name from maladaptiveBehaviors for the manifested/challenging-behavior portion (one catalog label per hour).
- Do not combine two different maladaptive behavior names in the same hour paragraph.

MALADAPTIVE BEHAVIOR ROTATION (mandatory — use JSON \`maladaptiveBehaviorForHour\`):
- The JSON \`maladaptiveBehaviors\` array is the **full rotation catalog** for this client: every BIP-listed target behavior from the client profile, plus any standard BIP names detected from the stored assessment document that were not already on the profile. Use **only** those strings for behavior names—do not cite labels that are not listed in \`maladaptiveBehaviors\`.
- The stored assessment excerpt is the source for **how each of those targets is operationalized**; the JSON catalog is authoritative for **which behavior names** may appear and how they are spelled. For **each** hour \`h\`, the narrative topography for \`maladaptiveBehaviorForHour[h]\` must follow **EVERY MALADAPTIVE BEHAVIOR — IMPLEMENT TOPOGRAPHY FROM THE ASSESSMENT** when \`clientAssessmentTextExcerpt\` is non-empty.
- The JSON includes \`maladaptiveBehaviorForHour\`: an array with **exactly** \`sessionHours\` strings. Index 0 is the first paragraph (first hour), index 1 the second paragraph, and so on.
- For hour index \`h\`, that paragraph's manifested behavior MUST be **exactly** the string \`maladaptiveBehaviorForHour[h]\` (verbatim character-for-character). That value is always one of the entries in \`maladaptiveBehaviors\`; the server cycles that list in order so **every** entry appears across a long enough session before any repeats.
- Do **not** substitute a different catalog label for a given hour than the one assigned for that index.

STRUCTURE (unchanged):
- Do NOT write the opening ("The RBT met with...") or any closing boilerplate about reinforcers/BIP/performance/next session.
- Do NOT use markdown headings, bullets, or numbered lists. Prose paragraphs only.
- Produce exactly sessionHours paragraphs (one per hour of service). Separate paragraphs with a single blank line (\\n\\n).
- Each paragraph is one continuous ABC-style narrative: rich antecedent (specific setting, materials, demand, timing) → observable client response → "During this activity, the client manifested [EXACT behavior name from JSON lists]" with **concrete topography that matches the assessment excerpt's specification for that catalog label** when the excerpt is non-empty (see **EVERY MALADAPTIVE BEHAVIOR** above) → "To address this behavior" or "To address these behaviors" with "the RBT implemented" or "the RBT applied" plus EXACT intervention name from JSON and a short, specific description of how it was used in that moment → when \`rbtActionsOnlyOutcomeForHour[h]\` is **false**: "Following this intervention..." with observable reduction/re-engagement → when \`rbtActionsOnlyOutcomeForHour[h]\` is **true**: a brief neutral bridge (e.g., continuing the teaching interaction / next RBT step) **without** valenced client outcome for \`replacementProgramForHour[h]\` (see **RBT-ACTIONS-ONLY HOURS**) → exactly one replacement-program sentence using **only** the assigned string \`replacementProgramForHour[h]\` inside the quotes (verbatim, full punctuation including paired parentheses).
- For replacement program sentences: use "Additionally, the RBT implemented the replacement program \\"...\\" by ..." for hour indices 0,2,4... and "The RBT implemented the replacement program \\"...\\" by ..." for hour indices 1,3,5... (0-based within this body). The \\"...\\" must be **character-identical** to \`replacementProgramForHour[h]\` for that paragraph—not a shortened form, not missing a parenthesis.
- Use ONLY behavior names, intervention names, and replacement program strings exactly as provided. Do not invent new diagnoses, behaviors, interventions, or program names.
- Pronouns: use he/him/his if gender indicates male, she/her/hers if female, they/them/their otherwise.
- If hasEnvironmentalChanges is true and environmentalChanges is non-empty, your FIRST paragraph may begin with one short bridging sentence that references those environmental factors, then continue into the first hour's ABC narrative (do not repeat the system's fixed environmental opening sentence).
- Tone: professional, specific, observable; no generic filler like "aligned with session targets" without concrete detail.
- **Client identity:** Never use a first name, last name, nickname, initials, or any personal name for the learner. Refer to them only as **the client** (and he/she/they pronouns per JSON \`gender\`). Ignore any literal value in JSON \`firstName\` / \`clientName\` if it were not \`the client\`; never output profile or assessment names.
- VARIETY: For hours where JSON \`activityAntecedentForHour[h]\` is null, each such paragraph MUST use a clearly different activity, setting, materials, social context, or instructional demand from every other null-guided hour. Hours with a non-null \`activityAntecedentForHour[h]\` MUST use that exact string (see ABC BUILDER) and are exempt from differing from each other or from AI-chosen hours except when the user selected the same catalog string twice.
- The JSON includes requestNonce — treat it only as a uniqueness hint; do not quote it in the note.

ABC BUILDER (optional — JSON \`activityAntecedentForHour\`):
- Array length equals \`sessionHours\`. When \`activityAntecedentForHour[h]\` is a non-null string, paragraph \`h\` MUST incorporate that **exact** catalog text **verbatim** (identical characters, punctuation, and spacing). You may add brief observable context around it (setting, materials, position, who initiated) but you must **not** paraphrase, shorten, or substitute synonyms for that string.
- When \`activityAntecedentForHour[h]\` is null, choose the antecedent/activity for that hour as usual (full AI).
- \`maladaptiveBehaviorForHour[h]\` always assigns the single manifested catalog behavior name for that paragraph; never replace it with a different catalog label even when the activity string mentions other demands.`;

function toComplianceCtx(ctx: NoteGenerationContext): NoteComplianceContext {
  return {
    sessionHours: ctx.sessionHours,
    replacementProgramsInOrder: ctx.replacementProgramsInOrder,
    replacementProgramForHour: ctx.replacementProgramForHour,
    rbtActionsOnlyOutcomeForHour: ctx.rbtActionsOnlyOutcomeForHour,
    maladaptiveBehaviors: ctx.maladaptiveBehaviors,
    maladaptiveBehaviorForHour: ctx.maladaptiveBehaviorForHour,
    activityAntecedentForHour: ctx.activityAntecedentForHour,
    languageMaladaptiveEpisodeForHour: ctx.languageMaladaptiveEpisodeForHour,
    interventions: ctx.interventions,
    clientAgeYears: ctx.clientAgeYears,
    presentPeople: ctx.presentPeople,
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

PREVIOUS BODY (replace completely — same number of paragraphs as sessionHours, blank lines between paragraphs):
${priorBody}

Output ONLY the corrected clinical body.`;

  const repairSystem = `${SYSTEM_PROMPT}

REVISION MODE: You are correcting an existing draft. Preserve observable content aligned with the JSON and with any non-empty \`clientAssessmentTextExcerpt\` in the JSON; remove all interpretation and mental-state language; enforce caregiver exclusion from this body; **each paragraph h must use replacementProgramForHour[h] verbatim (full string, including every parenthesis) in the replacement-program quote and must not name any other entry from replacementProgramsInOrder in that paragraph**; **when rbtActionsOnlyOutcomeForHour[h] is false, paragraph h may include normal observable progress or difficulty on that session-target program**; **when rbtActionsOnlyOutcomeForHour[h] is true, paragraph h must not state valenced client outcomes for that hour's replacement program—RBT implementation only per RBT-ACTIONS-ONLY HOURS**; exactly one maladaptive behavior catalog label per paragraph; **each paragraph h must use maladaptiveBehaviorForHour[h] verbatim** for the manifested behavior; **when the excerpt is non-empty, each paragraph's maladaptive topography must match the excerpt's operational definition for maladaptiveBehaviorForHour[h]** (see **EVERY MALADAPTIVE BEHAVIOR** in the base system prompt); **when activityAntecedentForHour[h] is a non-null string, paragraph h must contain that exact substring verbatim**; **when languageMaladaptiveEpisodeForHour[h] is true, paragraph h must include brief quoted or reported client utterance topography** per LANGUAGE / VERBAL MALADAPTIVE EPISODES, scoped to the assessment definition when the excerpt is non-empty; explicit initiators; age-appropriate tasks; for tantrum-type labels add assessment-aligned observable topography; for clientAgeYears 0–3 minimize attributed complex speech except where languageMaladaptiveEpisodeForHour[h] is true for that hour; when a paragraph cites physical aggression and JSON interventions include Response Block, describe Response Block immediately first after "To address this behavior," then other interventions; **never output personal names**—refer only as **the client** (plus appropriate pronouns).`;

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
