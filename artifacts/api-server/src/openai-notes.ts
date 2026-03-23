/**
 * OpenAI-powered clinical body for session notes.
 * Model defaults to GPT-5.3 family (override with OPENAI_MODEL).
 * Opening/closing locked prose is still assembled server-side in note-assembly.ts.
 */

import OpenAI from "openai";

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
};

const SYSTEM_PROMPT = `You write ABA session note clinical narratives for RBT documentation.

You will receive JSON "session context". Output ONLY the clinical body that goes BETWEEN:
(1) the fixed opening two sentences that the system adds separately, and
(2) the fixed closing reinforcer paragraph, performance line, and next-session line that the system adds separately.

STRICT RULES:
- Do NOT write the opening ("The RBT met with...") or any closing boilerplate about reinforcers/BIP/caregiver present/performance fair/next session.
- Do NOT use markdown headings, bullets, or numbered lists. Prose paragraphs only.
- Produce exactly sessionHours paragraphs (one per hour of service). Separate paragraphs with a single blank line (\\n\\n).
- Each paragraph is one continuous ABC-style narrative: rich antecedent (specific setting, materials, demand, timing) → observable client response → "During this activity, [ClientFirstName or full name] manifested [EXACT behavior name from JSON lists]" with concrete topography → "To address this behavior" or "To address these behaviors" with "the RBT implemented" or "the RBT applied" plus EXACT intervention name from JSON and a short, specific description of how it was used in that moment → "Following this intervention..." with observable reduction/re-engagement → a replacement-program sentence using EXACT program name from replacementProgramsInOrder for that hour (hour index h uses programs[h % programs.length] when fewer programs than hours).
- For replacement program sentences: use "Additionally, the RBT implemented the replacement program \\"...\\" by ..." for hour indices 0,2,4... and "The RBT implemented the replacement program \\"...\\" by ..." for hour indices 1,3,5... (0-based within this body).
- If maladaptiveBehaviors has at least two entries, the FIRST hour paragraph should incorporate TWO distinct behavior names from that list in one coherent episode (similar to documenting co-occurring responses), then one appropriate intervention; still end with the replacement program rule above.
- Use ONLY behavior names, intervention names, and replacement program strings exactly as provided. Do not invent new diagnoses, behaviors, interventions, or program names.
- Pronouns: use he/him/his if gender indicates male, she/her/hers if female, they/them/their otherwise.
- If hasEnvironmentalChanges is true and environmentalChanges is non-empty, your FIRST paragraph may begin with one short bridging sentence that references those environmental factors, then continue into the first hour's ABC narrative (do not repeat the system's fixed environmental opening sentence).
- Tone: professional, specific, observable; no generic filler like "aligned with session targets" without concrete detail.
- Client names: use the client's first name for most in-paragraph references after first mention if natural; use full clientName where appropriate for clarity.`;

function defaultModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-5.3-chat-latest";
}

export function isOpenAINoteGenerationConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function generateClinicalBodyOpenAI(ctx: NoteGenerationContext): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const model = defaultModel();
  const client = new OpenAI({ apiKey });

  const userContent = `Session context (JSON):\n${JSON.stringify(ctx, null, 2)}\n\nGenerate the clinical body now.`;

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    temperature: 0.65,
    max_tokens: 12000,
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("OpenAI returned empty message content");
  }

  return text;
}

export function openaiNoteGenerationLabel(): string {
  return `openai:${defaultModel()}`;
}
