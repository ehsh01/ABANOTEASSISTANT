/**
 * Extract structured intake fields from assessment PDF text using OpenAI.
 * Text layer only — scanned PDFs without OCR will yield little or no text.
 */

import OpenAI from "openai";
import { z } from "zod";

import { DEFAULT_OPENAI_NOTE_MODEL } from "./openai-notes";

const ExtractedTopographySchema = z.object({
  name: z.string(),
  topography: z.string().nullable().optional(),
});

const ExtractedSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  /** Prefer MM/dd/yyyy to match the intake form; yyyy-MM-dd is also accepted. */
  dateOfBirth: z.string().optional(),
  /** One of: Male, Female, Non-binary, Prefer not to say — omit if unknown. */
  gender: z.string().optional(),
  maladaptiveBehaviors: z.array(z.string()).default([]),
  /**
   * Optional per-behavior operational definition / topography (what the behavior looks like for this learner).
   * Each `name` should match an entry in `maladaptiveBehaviors` exactly; the server aligns by name and falls back
   * to case-insensitive match. `topography` is the short clinical description copied from the assessment.
   */
  maladaptiveBehaviorTopographies: z.array(ExtractedTopographySchema).default([]),
  replacementPrograms: z.array(z.string()).default([]),
  interventions: z.array(z.string()).default([]),
  /**
   * Authorization / treatment-plan expiration date pulled from the assessment (e.g. "Authorization Period",
   * "Auth Expires", "Plan ends", "Expiration Date"). Output as **ISO `yyyy-MM-dd`** when possible; `MM/dd/yyyy`
   * is also accepted. Omit when the document does not state an expiration date.
   */
  assessmentAuthorizationExpiresOn: z.string().optional(),
  /** Brief note on uncertainty or missing sections (optional). */
  confidenceNotes: z.string().optional(),
});

export type AssessmentExtracted = z.infer<typeof ExtractedSchema>;

export type AssessmentExtractResult = {
  extracted: AssessmentExtracted;
  warnings: string[];
  pdfPageCount: number;
  pdfCharCount: number;
};

const MAX_PDF_CHARS = 120_000;

/** Max characters stored in `profile.assessmentTextSnapshot` (aligns with extract truncation). */
export const MAX_ASSESSMENT_TEXT_STORAGE_CHARS = MAX_PDF_CHARS;

/** Max characters injected into the note-generation prompt (leave room for instructions + JSON). */
export const MAX_ASSESSMENT_TEXT_NOTE_CONTEXT_CHARS = 28_000;

export function truncateAssessmentTextForStorage(text: string): { text: string; truncated: boolean } {
  const t = text.trim();
  if (t.length <= MAX_ASSESSMENT_TEXT_STORAGE_CHARS) return { text: t, truncated: false };
  return { text: t.slice(0, MAX_ASSESSMENT_TEXT_STORAGE_CHARS), truncated: true };
}

export function truncateAssessmentTextForNoteContext(text: string): { text: string; truncated: boolean } {
  const t = text.trim();
  if (t.length <= MAX_ASSESSMENT_TEXT_NOTE_CONTEXT_CHARS) return { text: t, truncated: false };
  return { text: t.slice(0, MAX_ASSESSMENT_TEXT_NOTE_CONTEXT_CHARS), truncated: true };
}

function resolveExtractModel(): string {
  return (
    process.env["OPENAI_ASSESSMENT_EXTRACT_MODEL"]?.trim() ||
    process.env["OPENAI_MODEL"]?.trim() ||
    DEFAULT_OPENAI_NOTE_MODEL
  );
}

/**
 * GPT-5.x chat models (e.g. `gpt-5.3-chat-latest`) reject custom `temperature` and `max_tokens`; only
 * the default temperature (1) is accepted, and `max_completion_tokens` replaces `max_tokens`. Mirrors
 * `isGpt5FamilyNoteModel` in `openai-notes.ts`.
 */
function isGpt5FamilyExtractModel(modelId: string): boolean {
  return modelId.toLowerCase().includes("gpt-5");
}

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<{
  text: string;
  numpages: number;
}> {
  const pdfParse = (await import("pdf-parse")).default as (b: Buffer) => Promise<{
    text: string;
    numpages: number;
  }>;
  const data = await pdfParse(buffer);
  return { text: data.text ?? "", numpages: data.numpages ?? 0 };
}

function truncateForModel(text: string): { text: string; truncated: boolean } {
  const t = text.trim();
  if (t.length <= MAX_PDF_CHARS) return { text: t, truncated: false };
  return { text: t.slice(0, MAX_PDF_CHARS), truncated: true };
}

const SYSTEM = `You extract structured intake data from text pasted from an ABA / FBA / BIP or similar client assessment PDF.

Rules:
- Use ONLY information explicitly present in the document. Do not invent diagnoses, behaviors, or programs.
- Copy behavior and program names closely from the document when possible (short phrases, not long paragraphs).
- maladaptiveBehaviors: target behaviors, problem behaviors, or behavior definitions listed in the plan.
- maladaptiveBehaviorTopographies: for each behavior name in \`maladaptiveBehaviors\`, copy the short operational definition / observable description (the assessment's "topography" or "operational definition" text) when one is present. Use the SAME exact \`name\` string as the matching entry in \`maladaptiveBehaviors\` and put the description in \`topography\`. Keep it concise (one or two sentences); do not invent definitions when the document does not give one (omit that name's topography in that case). Use a JSON array of \`{ "name": "<behavior>", "topography": "<short description>" }\` objects.
- replacementPrograms: replacement skills, target behaviors to increase, BIP goals, or teaching programs (names only).
- interventions: strategies, antecedent modifications, consequence procedures, prompts, token systems, DRA/DRI/DRA, redirection, etc.
- dateOfBirth: output as MM/dd/yyyy if you can determine it; otherwise yyyy-MM-dd; omit if not in the text.
- gender: must be exactly one of "Male", "Female", "Non-binary", "Prefer not to say" if clearly stated; otherwise omit.
- firstName / lastName: client name if clearly labeled (not assessor names).
- assessmentAuthorizationExpiresOn: the date the client's authorization / treatment plan / assessment authorization period expires. Look for sections labeled "Authorization Period", "Authorization Expires", "Auth End Date", "End of Authorization", "Plan End Date", "Expiration Date", "Expires On", or similar. Output as ISO **yyyy-MM-dd** when possible; MM/dd/yyyy is also acceptable. Omit when no expiration date is stated.
- Omit empty arrays; use [] only when truly nothing found for that category.
- confidenceNotes: one short sentence if text was partial, ambiguous, or lists were merged from multiple sections.

Respond with a single JSON object only (no markdown).`;

export async function extractAssessmentFromPdfText(
  rawText: string,
  pdfPageCount: number,
): Promise<AssessmentExtractResult> {
  const apiKey = process.env["OPENAI_API_KEY"]?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const { text, truncated } = truncateForModel(rawText);
  const warnings: string[] = [];
  if (truncated) {
    warnings.push(`PDF text was truncated to ${MAX_PDF_CHARS} characters for processing.`);
  }

  if (text.length < 80) {
    warnings.push(
      "Very little text was extracted from the PDF. If this is a scanned document, OCR is required before extraction.",
    );
  }

  const client = new OpenAI({ apiKey });
  const model = resolveExtractModel();

  const userContent = `PDF page count (from parser): ${pdfPageCount}

Document text:
"""
${text}
"""

Return JSON with keys: firstName, lastName, dateOfBirth, gender, maladaptiveBehaviors, maladaptiveBehaviorTopographies, replacementPrograms, interventions, assessmentAuthorizationExpiresOn, confidenceNotes (all optional except arrays default to []).`;

  // GPT-5.x chat models only accept the default temperature; older models still benefit from a low value
  // (0.2) for deterministic JSON extraction. Branch the request shape so we don't trigger
  // `Unsupported value: 'temperature' does not support 0.2 with this model` on the new family.
  const completion = isGpt5FamilyExtractModel(model)
    ? await client.chat.completions.create({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userContent },
        ],
      })
    : await client.chat.completions.create({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userContent },
        ],
      });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error("Empty model response");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Model returned non-JSON");
  }

  const extracted = ExtractedSchema.parse(parsed);

  const dedupedBehaviors = [
    ...new Set(extracted.maladaptiveBehaviors.map((s) => s.trim()).filter(Boolean)),
  ];

  // Keep one topography per (case-insensitive) behavior name; align names back to the deduped list when possible.
  const behaviorByLower = new Map(dedupedBehaviors.map((n) => [n.toLowerCase(), n] as const));
  const seenTopographyNames = new Set<string>();
  const topographies: { name: string; topography: string }[] = [];
  for (const t of extracted.maladaptiveBehaviorTopographies) {
    const rawName = (t.name ?? "").trim();
    const desc = (t.topography ?? "").trim();
    if (!rawName || !desc) continue;
    const aligned = behaviorByLower.get(rawName.toLowerCase()) ?? rawName;
    const key = aligned.toLowerCase();
    if (seenTopographyNames.has(key)) continue;
    seenTopographyNames.add(key);
    topographies.push({ name: aligned, topography: desc });
  }

  return {
    extracted: {
      ...extracted,
      maladaptiveBehaviors: dedupedBehaviors,
      maladaptiveBehaviorTopographies: topographies,
      replacementPrograms: [...new Set(extracted.replacementPrograms.map((s) => s.trim()).filter(Boolean))],
      interventions: [...new Set(extracted.interventions.map((s) => s.trim()).filter(Boolean))],
      assessmentAuthorizationExpiresOn: normalizeIsoDateOrUndef(extracted.assessmentAuthorizationExpiresOn),
    },
    warnings,
    pdfPageCount,
    pdfCharCount: text.length,
  };
}

/**
 * Accept ISO `yyyy-MM-dd` or US `MM/dd/yyyy` strings (with optional 1-digit month/day) from the model and return
 * `yyyy-MM-dd` when the date is valid; return undefined when the input is missing/unparseable.
 */
function normalizeIsoDateOrUndef(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const t = raw.trim();
  if (!t) return undefined;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (iso) {
    const [, y, mo, d] = iso;
    return formatIsoDateParts(Number(y), Number(mo), Number(d));
  }

  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (us) {
    const [, mo, d, y] = us;
    return formatIsoDateParts(Number(y), Number(mo), Number(d));
  }

  return undefined;
}

function formatIsoDateParts(y: number, mo: number, d: number): string | undefined {
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return undefined;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  )
    return undefined;
  const mmStr = String(mo).padStart(2, "0");
  const ddStr = String(d).padStart(2, "0");
  return `${y}-${mmStr}-${ddStr}`;
}

export async function extractAssessmentFromPdfBuffer(buffer: Buffer): Promise<AssessmentExtractResult> {
  const { text, numpages } = await extractTextFromPdfBuffer(buffer);
  return extractAssessmentFromPdfText(text, numpages);
}
