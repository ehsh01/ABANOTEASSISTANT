/**
 * Extract structured intake fields from assessment PDF text using OpenAI.
 * Text layer only — scanned PDFs without OCR will yield little or no text.
 */

import OpenAI from "openai";
import { z } from "zod";

import { DEFAULT_OPENAI_NOTE_MODEL } from "./openai-notes";

const ExtractedSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  /** Prefer MM/dd/yyyy to match the intake form; yyyy-MM-dd is also accepted. */
  dateOfBirth: z.string().optional(),
  /** One of: Male, Female, Non-binary, Prefer not to say — omit if unknown. */
  gender: z.string().optional(),
  maladaptiveBehaviors: z.array(z.string()).default([]),
  replacementPrograms: z.array(z.string()).default([]),
  interventions: z.array(z.string()).default([]),
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
- replacementPrograms: replacement skills, target behaviors to increase, BIP goals, or teaching programs (names only).
- interventions: strategies, antecedent modifications, consequence procedures, prompts, token systems, DRA/DRI/DRA, redirection, etc.
- dateOfBirth: output as MM/dd/yyyy if you can determine it; otherwise yyyy-MM-dd; omit if not in the text.
- gender: must be exactly one of "Male", "Female", "Non-binary", "Prefer not to say" if clearly stated; otherwise omit.
- firstName / lastName: client name if clearly labeled (not assessor names).
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

Return JSON with keys: firstName, lastName, dateOfBirth, gender, maladaptiveBehaviors, replacementPrograms, interventions, confidenceNotes (all optional except arrays default to []).`;

  const completion = await client.chat.completions.create({
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

  return {
    extracted: {
      ...extracted,
      maladaptiveBehaviors: [...new Set(extracted.maladaptiveBehaviors.map((s) => s.trim()).filter(Boolean))],
      replacementPrograms: [...new Set(extracted.replacementPrograms.map((s) => s.trim()).filter(Boolean))],
      interventions: [...new Set(extracted.interventions.map((s) => s.trim()).filter(Boolean))],
    },
    warnings,
    pdfPageCount,
    pdfCharCount: text.length,
  };
}

export async function extractAssessmentFromPdfBuffer(buffer: Buffer): Promise<AssessmentExtractResult> {
  const { text, numpages } = await extractTextFromPdfBuffer(buffer);
  return extractAssessmentFromPdfText(text, numpages);
}
