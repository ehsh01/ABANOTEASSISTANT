/**
 * Extract structured intake fields from assessment PDF text using OpenAI.
 * Text layer only — scanned PDFs without OCR will yield little or no text.
 */

import OpenAI from "openai";
import { z } from "zod";

import { DEFAULT_OPENAI_NOTE_MODEL } from "./openai-notes";
import { sanitizeClientAssessmentSummary, assessmentSummaryForExtractPayload } from "./client-assessment-summary";
import { sanitizeTextForJsonStorage } from "./sanitize-text-for-json";
import {
  extractBehaviorFunctionsFromBipText,
  extractBehaviorFunctionsFromPreferenceAssessment,
  resolveBehaviorFunctionsForName,
  sanitizeClinicalFunctionsInput,
} from "./clinical-behavior-function";
import type { ClinicalFunction } from "@workspace/db/schema";

const ClinicalFunctionExtractEnum = z.enum(["escape", "attention", "tangible", "automatic"]);

const ExtractedTopographySchema = z.object({
  name: z.string(),
  topography: z.string().nullable().optional(),
  /** FBA function(s) when stated in Preference Assessment or Hypothesized function — omit when not in document. */
  functions: z.array(ClinicalFunctionExtractEnum).optional(),
});

const AssessmentSummaryExtractSchema = z.object({
  assessor: z.string().optional(),
  assessmentDate: z.string().optional(),
  authorizedHours: z.string().optional(),
  summary: z.string().optional(),
  diagnoses: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  medicalHistory: z.string().optional(),
  behaviorProfiles: z.array(z.string()).default([]),
  reinforcementPreferences: z.array(z.string()).default([]),
  precursorBehaviors: z.array(z.string()).default([]),
  crisisProtocol: z.string().optional(),
  parentTrainingGoals: z.array(z.string()).default([]),
  supervisorRequirements: z.string().optional(),
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
  skillAcquisitionPrograms: z.array(z.string()).default([]),
  interventions: z.array(z.string()).default([]),
  /**
   * Authorization / treatment-plan expiration date pulled from the assessment (e.g. "Authorization Period",
   * "Auth Expires", "Plan ends", "Expiration Date"). Output as **ISO `yyyy-MM-dd`** when possible; `MM/dd/yyyy`
   * is also accepted. Omit when the document does not state an expiration date.
   */
  assessmentAuthorizationExpiresOn: z.string().optional(),
  /** Structured overview sections from the assessment (summary, diagnosis, recommendations, etc.). */
  assessmentSummary: AssessmentSummaryExtractSchema.optional(),
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
  const t = sanitizeTextForJsonStorage(text).trim();
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
- maladaptiveBehaviorTopographies: for EVERY behavior name in \`maladaptiveBehaviors\`, copy the short operational definition / observable description from the document when one is present. BIP/FBA documents commonly label this paragraph "Description", "Operational Definition", or "Topography" inside each behavior's section, often followed by "Onset" and "Offset". When you find such a paragraph for a behavior, include it. Use the SAME exact \`name\` string as the matching entry in \`maladaptiveBehaviors\` and put the description in \`topography\`. Keep it concise (one to three sentences). Do not invent definitions when the document does not give one (omit that name's topography in that case). Use a JSON array of \`{ "name": "<behavior>", "topography": "<short description>", "functions": ["escape"|"attention"|"tangible"|"automatic"] }\` objects. Do not skip behaviors that have a clear definition — emit one entry per behavior whenever the document supplies one.
- maladaptiveBehaviorTopographies.functions: when the document states why a behavior occurs, copy **only** what is explicitly listed. Look under **Preference Assessment**, **Functional Assessment**, **Hypothesized function**, **Maintaining function**, or behavior-specific function lines (e.g. "Physical Aggression → Tangible, Escape"). Map document wording to these exact JSON tokens only: **attention** (Attention / attention-seeking), **escape** (Escape), **tangible** (Tangible), **automatic** (Sensory, Automatic, Sensory/Automatic, automatic reinforcement). Multiple functions are allowed when the document lists more than one. Use \`[]\` only when the document names the behavior in a function section but lists no recognizable function. **Omit** the \`functions\` key entirely when the document does not address function for that behavior. **Never guess** a function.
- replacementPrograms: replacement skills, target behaviors to increase, BIP goals, or teaching programs (names only). Do **not** put skill-acquisition-only programs here when the document has a separate **Skill Acquisition Programs** section — use \`skillAcquisitionPrograms\` for those instead.
- skillAcquisitionPrograms: under a section explicitly titled **Skill Acquisition Programs**, include **only** the short skill name from each \`Goal # N: …\` line — the text **after** \`Goal # N:\` on that same line. Example: \`Goal # 2: Sharing: Allows Others to Manipulate/Touch Toys\` → \`Sharing: Allows Others to Manipulate/Touch Toys\`. Do **not** include BL/LTO/STO objectives, procedures, barriers, narrative paragraphs, addresses, page numbers, or any text that is not the goal-title fragment on a \`Goal #\` line. If the document has no **Skill Acquisition Programs** section, return [].
- interventions: strategies, antecedent modifications, consequence procedures, prompts, token systems, DRA/DRI/DRA, redirection, etc.
- dateOfBirth: output as MM/dd/yyyy if you can determine it; otherwise yyyy-MM-dd; omit if not in the text.
- gender: must be exactly one of "Male", "Female", "Non-binary", "Prefer not to say" if clearly stated; otherwise omit.
- firstName / lastName: client name if clearly labeled (not assessor names).
- assessmentAuthorizationExpiresOn: the date the client's authorization / treatment plan / assessment authorization period expires. Look for sections labeled "Authorization Period", "Authorization Expires", "Auth End Date", "End of Authorization", "Plan End Date", "Expiration Date", "Expires On", or similar. Output as ISO **yyyy-MM-dd** when possible; MM/dd/yyyy is also acceptable. Omit when no expiration date is stated.
- assessmentSummary: object with structured overview sections when present in the document. Copy text closely; use concise bullets/lists where the PDF uses lists. Fields:
  - assessor: lead assessor name and credentials (e.g. "Annia Soto, BCBA") when labeled Assessor / Completed by / BCBA.
  - assessmentDate: date of assessment or report (ISO **yyyy-MM-dd** when possible).
  - authorizedHours: authorized weekly service hours as one block (RBT, BCBA, analyst codes, etc.) when stated.
  - summary: the narrative **Summary** / clinical overview paragraph (age, diagnoses, presenting concerns, service need)—not the behavior list alone.
  - diagnoses: array of diagnosis lines with codes when listed under **Diagnosis** (e.g. "ADHD, combined type (F90.2)").
  - recommendations: bullet strings under **Recommendations** (data collection, caregiver training, hours, generalization, etc.).
  - medicalHistory: prose under **Medical History** (medications, sleep, eating, health concerns).
  - behaviorProfiles: short behavior names under **Behavior Profiles** / target behavior list when distinct from detailed BIP behavior sections (e.g. "Elopement", "Tantrum").
  - reinforcementPreferences: people, items, activities, praise phrases under **Reinforcement Preferences**.
  - precursorBehaviors: items under **Precursor Behaviors** when listed.
  - crisisProtocol: prose under **Crisis Protocol** / crisis plan (prevention, de-escalation, post-incident steps).
  - parentTrainingGoals: caregiver training goal bullets under **Parent Training Goals**.
  - supervisorRequirements: prose under **Supervisor Requirements** / BCBA supervision expectations.
  Omit empty strings; use [] for empty lists. Omit the whole \`assessmentSummary\` key only when none of these sections appear.
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

Return JSON with keys: firstName, lastName, dateOfBirth, gender, maladaptiveBehaviors, maladaptiveBehaviorTopographies, replacementPrograms, skillAcquisitionPrograms, interventions, assessmentAuthorizationExpiresOn, assessmentSummary, confidenceNotes (all optional except arrays default to []).`;

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
  const topographies: { name: string; topography: string; functions?: ClinicalFunction[] }[] = [];
  const functionsByBehaviorLower = new Map<string, ClinicalFunction[] | null>();

  for (const t of extracted.maladaptiveBehaviorTopographies) {
    const rawName = (t.name ?? "").trim();
    const desc = (t.topography ?? "").trim();
    const aligned = behaviorByLower.get(rawName.toLowerCase()) ?? rawName;
    const key = aligned.toLowerCase();
    if (t.functions !== undefined) {
      const fns = sanitizeClinicalFunctionsInput(t.functions) ?? [];
      functionsByBehaviorLower.set(key, fns);
    }
    if (!rawName || !desc) continue;
    if (seenTopographyNames.has(key)) continue;
    seenTopographyNames.add(key);
    const row: { name: string; topography: string; functions?: ClinicalFunction[] } = {
      name: aligned,
      topography: desc,
    };
    if (functionsByBehaviorLower.has(key)) {
      row.functions = functionsByBehaviorLower.get(key) ?? [];
    }
    topographies.push(row);
  }

  const preferenceFunctionMap = extractBehaviorFunctionsFromPreferenceAssessment(rawText);

  // Deterministic fallback: large BIPs (e.g. 100+ pages) routinely cause the LLM to drop entries from
  // `maladaptiveBehaviorTopographies` even when each behavior section spells out a clear "Description:".
  // For any behavior with no LLM-supplied topography, scan the raw PDF text for the standard
  // `Behavior Name` / `Description:` BIP layout and pull the operational definition straight from the source.
  // The full (untruncated) `rawText` is searched here so we don't miss late sections that the
  // model-context truncation would otherwise hide.
  for (const behaviorName of dedupedBehaviors) {
    const key = behaviorName.toLowerCase();
    if (seenTopographyNames.has(key)) continue;
    const found = extractTopographyFromBipText(rawText, behaviorName);
    if (found) {
      seenTopographyNames.add(key);
      const row: { name: string; topography: string; functions?: ClinicalFunction[] } = {
        name: behaviorName,
        topography: found,
      };
      if (functionsByBehaviorLower.has(key)) {
        row.functions = functionsByBehaviorLower.get(key) ?? [];
      }
      topographies.push(row);
    }
  }

  // Resolve behavior functions: Preference Assessment first, then per-behavior Hypothesized function in BIP.
  for (const behaviorName of dedupedBehaviors) {
    const key = behaviorName.toLowerCase();
    if (functionsByBehaviorLower.has(key)) continue;
    const resolved = resolveBehaviorFunctionsForName(
      behaviorName,
      preferenceFunctionMap,
      rawText,
    );
    if (resolved === null) continue;
    functionsByBehaviorLower.set(key, resolved);
  }

  // Ensure every imported behavior has a topography row when we only have function data.
  for (const behaviorName of dedupedBehaviors) {
    const key = behaviorName.toLowerCase();
    if (!functionsByBehaviorLower.has(key)) continue;
    const existing = topographies.find((t) => t.name.toLowerCase() === key);
    if (existing) {
      existing.functions = functionsByBehaviorLower.get(key) ?? [];
      continue;
    }
    topographies.push({
      name: behaviorName,
      topography: extractTopographyFromBipText(rawText, behaviorName) ?? "",
      functions: functionsByBehaviorLower.get(key) ?? [],
    });
  }

  // Attach functions to rows that already exist without them.
  for (const row of topographies) {
    const key = row.name.toLowerCase();
    if (row.functions !== undefined) continue;
    if (functionsByBehaviorLower.has(key)) {
      row.functions = functionsByBehaviorLower.get(key) ?? [];
    }
  }

  const skillAcquisitionPrograms = resolveSkillAcquisitionProgramsFromAssessment(
    rawText,
    extracted.skillAcquisitionPrograms,
  );

  const assessmentSummary = sanitizeClientAssessmentSummary(extracted.assessmentSummary ?? null);

  return {
    extracted: {
      ...extracted,
      maladaptiveBehaviors: dedupedBehaviors,
      maladaptiveBehaviorTopographies: topographies,
      replacementPrograms: [...new Set(extracted.replacementPrograms.map((s) => s.trim()).filter(Boolean))],
      skillAcquisitionPrograms,
      interventions: [...new Set(extracted.interventions.map((s) => s.trim()).filter(Boolean))],
      assessmentAuthorizationExpiresOn: normalizeIsoDateOrUndef(extracted.assessmentAuthorizationExpiresOn),
      assessmentSummary: assessmentSummary
        ? assessmentSummaryForExtractPayload(assessmentSummary)
        : undefined,
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

/**
 * Headings that mark the **end** of a behavior's `Description:` paragraph in standard BIP layouts
 * (Project Minds Care template and similar). Matched at line-start, case-insensitive, and tolerant
 * of trailing whitespace/colon. Order matters only insofar as the longest distinctive phrase
 * should be preferred — we still rely on `RegExp` alternation so any of these can terminate the
 * capture.
 */
const BIP_DESCRIPTION_STOP_HEADINGS = [
  "Onset",
  "Offset",
  "Intensity Key",
  "Intensity Description",
  "Instructions/Procedures",
  "Hypothesized function",
  "Hypothesized Function",
  "Prevalent Setting",
  "Possible Antecedents",
  "Recommended Interventions",
  "Interventions/Teaching methodologies",
  "Replacement Skills",
  "Replacement Programs",
  "Preventive Strategies",
  "Management Strategies",
  "Objectives",
  "Start Date",
  "Baselines",
  "Collection Method",
];

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Strip generic word-boundary noise from a behavior name (extra spaces, smart quotes, parenthetical
 * abbreviations) so the regex below matches headings like `SIB` or `Off-Task Behavior` written with
 * varying punctuation.
 */
function normalizeBehaviorHeading(name: string): string {
  return name
    .replace(/[\u2018\u2019\u201C\u201D]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Best-effort deterministic topography extraction for a single behavior name from raw BIP text.
 * Looks for a heading line containing the behavior name followed (within ~5KB) by a
 * `Description:` block, then captures until the next standard BIP sub-heading. Returns `null`
 * when no clean match is found — callers should leave the topography empty in that case rather
 * than fabricate one.
 */
export function extractTopographyFromBipText(rawText: string, behaviorName: string): string | null {
  const text = rawText ?? "";
  if (!text) return null;

  const heading = normalizeBehaviorHeading(behaviorName);
  if (!heading) return null;

  const headingPattern = new RegExp(
    String.raw`(?:^|\n)\s*${escapeForRegex(heading)}\s*(?:\r?\n|\s*$)`,
    "gi",
  );
  const stopAlternation = BIP_DESCRIPTION_STOP_HEADINGS.map(escapeForRegex).join("|");
  const descPattern = new RegExp(
    String.raw`Description\s*:\s*([\s\S]*?)(?:\n\s*(?:${stopAlternation})\s*[:.\n])`,
    "i",
  );

  let match: RegExpExecArray | null;
  while ((match = headingPattern.exec(text)) !== null) {
    const start = match.index + match[0].length;
    const window = text.slice(start, start + 5000);
    const desc = descPattern.exec(window);
    if (!desc) continue;
    const cleaned = (desc[1] ?? "")
      .replace(/\r/g, "")
      .replace(/\n+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (cleaned.length >= 30) return cleaned;
  }
  return null;
}

/** Section headings that terminate the Skill Acquisition Programs block. */
const SKILL_ACQUISITION_SECTION_STOP_HEADINGS = [
  "Maladaptive Behaviors",
  "Maladaptive Behavior",
  "Behavior Reduction",
  "Replacement Programs",
  "Replacement Skills",
  "Replacement Program",
  "Interventions",
  "Intervention Strategies",
  "Authorization Period",
  "Authorization Expires",
  "Client Information",
  "Therapist Information",
  "Caregiver Information",
  "Preventive Strategies",
  "Management Strategies",
  "Parent Training",
  "Caregiver Training",
  "Discharge Plan",
  "Appendix",
];

function dedupePreserveOrderTrimmed(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const s = raw.trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/** Parse `Goal # 2: Sharing: Allows Others to Manipulate/Touch Toys` → skill title after the goal number. */
export function parseSkillAcquisitionGoalTitle(line: string): string | null {
  const m = /^Goal\s*#\s*\d+\s*:\s*(.+?)\s*$/i.exec(line.trim());
  if (!m) return null;
  const name = m[1]!.trim();
  if (!name || name.length > 240) return null;
  return name;
}

function findSkillAcquisitionSectionText(rawText: string): string | null {
  const text = rawText ?? "";
  const headingRe = /(?:^|\n)\s*Skill Acquisition Programs?\s*(?:\n|$)/gi;
  let match: RegExpExecArray | null;
  while ((match = headingRe.exec(text)) !== null) {
    const start = match.index + match[0].length;
    const preview = text.slice(start, start + 600);
    if (!/Goal\s*#\s*\d+\s*:/i.test(preview)) continue;

    const tail = text.slice(start);
    const stopRes = new RegExp(
      `(?:^|\\n)\\s*(?:${SKILL_ACQUISITION_SECTION_STOP_HEADINGS.map(escapeForRegex).join("|")})\\b`,
      "im",
    ).exec(tail);
    return stopRes ? tail.slice(0, stopRes.index) : tail;
  }
  return null;
}

/** Collect goal titles from a section chunk or from noisy LLM output (one title per Goal # line). */
function extractSkillAcquisitionGoalTitlesFromText(chunk: string): string[] {
  const programs: string[] = [];
  const goalLineRe = /^Goal\s*#\s*\d+\s*:\s*(.+?)\s*$/gim;
  let m: RegExpExecArray | null;
  while ((m = goalLineRe.exec(chunk)) !== null) {
    const name = m[1]!.trim();
    if (name) programs.push(name);
  }
  return dedupePreserveOrderTrimmed(programs);
}

/**
 * Deterministic parse of skill-acquisition program names under a BIP section titled
 * "Skill Acquisition Programs". Uses only `Goal # N: <skill name>` lines.
 */
export function extractSkillAcquisitionProgramsFromBipText(rawText: string): string[] {
  const section = findSkillAcquisitionSectionText(rawText);
  if (!section) return [];
  return extractSkillAcquisitionGoalTitlesFromText(section);
}

/**
 * Import skill-acquisition programs only when the assessment document contains a
 * "Skill Acquisition Programs" section; otherwise return [].
 */
function resolveSkillAcquisitionProgramsFromAssessment(
  rawText: string,
  llmPrograms: string[],
): string[] {
  const section = findSkillAcquisitionSectionText(rawText);
  if (!section) return [];

  const fromSection = extractSkillAcquisitionGoalTitlesFromText(section);
  if (fromSection.length > 0) return fromSection;

  const fromLlm = extractSkillAcquisitionGoalTitlesFromText(llmPrograms.join("\n"));
  if (fromLlm.length > 0) return fromLlm;

  return dedupePreserveOrderTrimmed(
    llmPrograms
      .flatMap((entry) => entry.split(/\r?\n/))
      .map((line) => parseSkillAcquisitionGoalTitle(line))
      .filter((name): name is string => Boolean(name)),
  );
}
