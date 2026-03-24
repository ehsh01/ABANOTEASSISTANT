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

/** Chat Completions model id for note clinical body when OPENAI_MODEL is unset. */
export const DEFAULT_OPENAI_NOTE_MODEL = "gpt-5.3-chat-latest";

export type NoteGenerationContext = {
  clientName: string;
  firstName: string;
  gender: string | null | undefined;
  sessionHours: number;
  sessionDate: string;
  presentPeople: string[];
  hasEnvironmentalChanges: boolean;
  environmentalChanges: string;
  maladaptiveBehaviors: string[];
  interventions: string[];
  /** Replacement program names in wizard order (one focal program per hour when possible) */
  replacementProgramsInOrder: string[];
  /** Unique per request so the model does not replay identical scenarios across regenerations */
  requestNonce: string;
  /** Approximate age at session (from profile DOB); null if unknown */
  clientAgeYears: number | null;
  /** Optional client.age_band from DB for extra prompt context */
  ageBand: string | null | undefined;
};

const SYSTEM_PROMPT = `You write ABA session note clinical narratives for RBT documentation.

You will receive JSON "session context". Output ONLY the clinical body that goes BETWEEN:
(1) the fixed opening two sentences that the system adds separately, and
(2) the fixed closing reinforcer paragraph, performance line, and next-session line that the system adds separately.

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

TANTRUMS AND OTHER BROAD LABELS (must use assessment-linked topography):
- When the documented maladaptive behavior is broad (e.g. tantrum, meltdown, emotional dysregulation, crying episode) OR when the narrative would otherwise only say the client "had a tantrum" / "tantrumed," you MUST spell out observable actions in the same episode: what the client did with their body, voice, and materials (e.g. fell to the floor, kicked legs, screamed with tears, threw items, pushed materials away, hit self or surfaces)—aligned with how that behavior is described or implied across the maladaptiveBehaviors strings in JSON.
- Never end the behavior description on the label alone (e.g. avoid "manifested Tantrum" with no preceding concrete actions). The RBT must be able to see the topography in your text.

AGE-APPROPRIATE ACTIVITIES:
- Use clientAgeYears (and ageBand if present). Scenarios, demands, and materials must fit typical expectations for that developmental level.
- For very young children (under ~3–4): avoid independent reading, writing worksheets, essays, spelling tests, chapter books, long division, etc. Prefer picture-based play, simple toys, imitation, matching with manipulatives, gross-motor play, caregiver-style routines as appropriate.
- If age is unknown, keep activities broadly appropriate and conservative (simple, concrete tasks).

TODDLER / LIMITED VERBAL SKILLS (when clientAgeYears is 0–3, or ageBand clearly indicates toddler):
- Do not assume clear expressive language. Minimize "the client said…," "stated…," "replied…," "answered…," "verbally requested…," or quoted full sentences attributed to the client.
- Prefer observable communication: vocalizing (non-word cries, screams, grunts), gestures, reaching, pushing away, head turning, or following a model without claiming the client produced specific words.
- Do not add meta-lines about whether the client can speak (e.g. "communication level is unknown"); stay observational.

INITIATION OF INTERACTION:
- When an interaction or invitation happens, state WHO initiated it explicitly (e.g. "The therapist presented…", "A peer said…", "The RBT placed…").
- Avoid passive voice that hides the actor: do not write "The client was invited…" without naming who invited them in that same clause or an adjacent clear phrase.

CAREGIVER / PRESENT PEOPLE:
- Do NOT mention caregivers, parents, guardians, or any name from presentPeople in the clinical body. Presence is already stated in the system's fixed opening only.

ONE PROGRAM PER ABC (per hour paragraph):
- Each paragraph (one service hour) must reference exactly ONE replacement program name from replacementProgramsInOrder for that hour (index h uses programs[h % length] when fewer programs than hours).
- Do not combine two different program names in the same hour paragraph.

ONE MALADAPTIVE BEHAVIOR PER ABC (per hour paragraph):
- Each paragraph must cite exactly ONE behavior name from maladaptiveBehaviors for the manifested/challenging-behavior portion (one catalog label per hour).
- Do not combine two different maladaptive behavior names in the same hour paragraph. If the session involved multiple behavior types, distribute them across different hours.

STRUCTURE (unchanged):
- Do NOT write the opening ("The RBT met with...") or any closing boilerplate about reinforcers/BIP/performance/next session.
- Do NOT use markdown headings, bullets, or numbered lists. Prose paragraphs only.
- Produce exactly sessionHours paragraphs (one per hour of service). Separate paragraphs with a single blank line (\\n\\n).
- Each paragraph is one continuous ABC-style narrative: rich antecedent (specific setting, materials, demand, timing) → observable client response → "During this activity, [ClientFirstName or full name] manifested [EXACT behavior name from JSON lists]" with concrete topography → "To address this behavior" or "To address these behaviors" with "the RBT implemented" or "the RBT applied" plus EXACT intervention name from JSON and a short, specific description of how it was used in that moment → "Following this intervention..." with observable reduction/re-engagement → exactly one replacement-program sentence using EXACT program name for that hour.
- For replacement program sentences: use "Additionally, the RBT implemented the replacement program \\"...\\" by ..." for hour indices 0,2,4... and "The RBT implemented the replacement program \\"...\\" by ..." for hour indices 1,3,5... (0-based within this body).
- Use ONLY behavior names, intervention names, and replacement program strings exactly as provided. Do not invent new diagnoses, behaviors, interventions, or program names.
- Pronouns: use he/him/his if gender indicates male, she/her/hers if female, they/them/their otherwise.
- If hasEnvironmentalChanges is true and environmentalChanges is non-empty, your FIRST paragraph may begin with one short bridging sentence that references those environmental factors, then continue into the first hour's ABC narrative (do not repeat the system's fixed environmental opening sentence).
- Tone: professional, specific, observable; no generic filler like "aligned with session targets" without concrete detail.
- Client names: use the client's first name for most in-paragraph references after first mention if natural; use full clientName where appropriate for clarity.
- VARIETY: Each hour paragraph MUST use a clearly different activity, setting, materials, social context, or instructional demand from every other hour.
- The JSON includes requestNonce — treat it only as a uniqueness hint; do not quote it in the note.`;

function toComplianceCtx(ctx: NoteGenerationContext): NoteComplianceContext {
  return {
    sessionHours: ctx.sessionHours,
    replacementProgramsInOrder: ctx.replacementProgramsInOrder,
    maladaptiveBehaviors: ctx.maladaptiveBehaviors,
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

async function callOpenAI(messages: ChatCompletionMessageParam[], temperature: number): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  const model = defaultModel();
  const client = new OpenAI({ apiKey });
  // GPT-5.x chat models return 400 if `max_tokens` is sent; they require `max_completion_tokens`.
  const completion = await client.chat.completions.create({
    model,
    messages,
    temperature,
    max_completion_tokens: 12000,
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

REVISION MODE: You are correcting an existing draft. Preserve observable content aligned with the JSON; remove all interpretation and mental-state language; enforce caregiver exclusion from this body; one replacement program and exactly one maladaptive behavior catalog label per paragraph; explicit initiators; age-appropriate tasks; for tantrum-type labels add assessment-aligned observable topography; for clientAgeYears 0–3 minimize attributed complex speech to the client.`;

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
