import type { ClinicalFunction } from "@workspace/db/schema";
import { isUnusableStoredTopography } from "./maladaptive-behavior-topography";
import { sanitizeTextForJsonStorage } from "./sanitize-text-for-json";

export const CLINICAL_FUNCTIONS: readonly ClinicalFunction[] = [
  "attention",
  "escape",
  "tangible",
  "automatic",
] as const;

const FUNCTION_LABEL: Record<ClinicalFunction, string> = {
  attention: "Attention",
  escape: "Escape",
  tangible: "Tangible",
  automatic: "Sensory/Automatic",
};

/** Display order for comma-separated function lists. */
const FUNCTION_DISPLAY_ORDER: ClinicalFunction[] = [
  "attention",
  "escape",
  "tangible",
  "automatic",
];

const FUNCTION_TOKEN_PATTERNS: { fn: ClinicalFunction; re: RegExp }[] = [
  { fn: "attention", re: /\battention(?:\s*[-/]?\s*seeking)?\b/i },
  { fn: "escape", re: /\bescape\b/i },
  { fn: "tangible", re: /\btangible\b/i },
  {
    fn: "automatic",
    re: /\b(?:automatic(?:\s+reinforcement)?|sensory(?:\s*\/\s*automatic)?|sensory\/automatic)\b/i,
  },
];

export function parseClinicalFunctionsFromText(raw: string | null | undefined): ClinicalFunction[] {
  const text = sanitizeTextForJsonStorage(raw ?? "").trim();
  if (!text) return [];

  const found = new Set<ClinicalFunction>();
  for (const { fn, re } of FUNCTION_TOKEN_PATTERNS) {
    if (re.test(text)) found.add(fn);
  }
  return FUNCTION_DISPLAY_ORDER.filter((f) => found.has(f));
}

export function sanitizeClinicalFunctionsInput(raw: unknown): ClinicalFunction[] | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!Array.isArray(raw)) return [];
  const found = new Set<ClinicalFunction>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const t = item.trim().toLowerCase();
    if (t === "attention") found.add("attention");
    else if (t === "escape") found.add("escape");
    else if (t === "tangible") found.add("tangible");
    else if (t === "automatic" || t === "sensory" || t === "sensory/automatic") found.add("automatic");
  }
  return FUNCTION_DISPLAY_ORDER.filter((f) => found.has(f));
}

export function formatClinicalFunctionsDisplay(
  functions: ClinicalFunction[] | null | undefined,
): string {
  if (!functions || functions.length === 0) {
    return "Not specified in assessment";
  }
  return FUNCTION_DISPLAY_ORDER.filter((f) => functions.includes(f))
    .map((f) => FUNCTION_LABEL[f])
    .join(", ");
}

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeBehaviorHeading(name: string): string {
  return name
    .replace(/[\u2018\u2019\u201C\u201D]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Best-effort: read `Hypothesized function:` (or similar) under a behavior heading in BIP text.
 * Returns `[]` when the section exists but names no recognizable function; `null` when not found.
 */
export function extractBehaviorFunctionsFromBipText(
  rawText: string,
  behaviorName: string,
): ClinicalFunction[] | null {
  const text = rawText ?? "";
  if (!text) return null;

  const heading = normalizeBehaviorHeading(behaviorName);
  if (!heading) return null;

  const headingPattern = new RegExp(
    String.raw`(?:^|\n)\s*${escapeForRegex(heading)}\s*(?:\r?\n|\s*$)`,
    "gi",
  );
  const funcPattern =
    /(?:Hypothesized\s+function|Function\s+of\s+behavior|Maintaining\s+function|Behavior\s+function)\s*:\s*([^\n]+)/i;

  let match: RegExpExecArray | null;
  while ((match = headingPattern.exec(text)) !== null) {
    const start = match.index + match[0].length;
    const window = text.slice(start, start + 5000);
    const func = funcPattern.exec(window);
    if (!func) continue;
    return parseClinicalFunctionsFromText(func[1]);
  }
  return null;
}

/**
 * Parse **Preference Assessment** (or similar) tables listing behavior → function(s).
 * Returns a map of behavior label → functions (empty array when row exists but function blank).
 */
export function extractBehaviorFunctionsFromPreferenceAssessment(
  rawText: string,
): Map<string, ClinicalFunction[]> {
  const out = new Map<string, ClinicalFunction[]>();
  const text = rawText ?? "";
  if (!text) return out;

  const sectionStart = text.search(
    /(?:^|\n)\s*(?:Preference\s+Assessment|Functional\s+Assessment\s+Summary|Behavior\s+Function\s+Summary)\s*(?:\r?\n|:)/i,
  );
  if (sectionStart < 0) return out;

  const tail = text.slice(sectionStart);
  const sectionEnd = tail.search(
    /\n\s*(?:Reinforcement\s+Preferences|Precursor\s+Behaviors|Crisis\s+Protocol|Medical\s+History|Recommendations|Diagnosis|Skill\s+Acquisition|Behavior\s+Profiles|Supervisor\s+Requirements|Parent\s+Training)\b/i,
  );
  const chunk = sectionEnd > 0 ? tail.slice(0, sectionEnd) : tail.slice(0, 12_000);

  for (const line of chunk.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || /^preference\s+assessment/i.test(trimmed)) continue;
    if (/^behavior\b/i.test(trimmed) && /function/i.test(trimmed)) continue;

    const arrow = trimmed.match(/^(.+?)\s*(?:→|->|—|–|:)\s*(.+)$/);
    if (!arrow) continue;

    const behavior = arrow[1]!.trim();
    const funcText = arrow[2]!.trim();
    if (!behavior || behavior.length > 120) continue;
    if (/^(attention|escape|tangible|automatic|sensory)/i.test(behavior) && !funcText) continue;

    const key = behavior.toLowerCase();
    if (out.has(key)) continue;
    out.set(key, parseClinicalFunctionsFromText(funcText));
  }

  return out;
}

export function resolveBehaviorFunctionsForName(
  behaviorName: string,
  preferenceMap: Map<string, ClinicalFunction[]>,
  rawText: string,
): ClinicalFunction[] | null {
  const key = behaviorName.trim().toLowerCase();
  if (preferenceMap.has(key)) {
    return preferenceMap.get(key) ?? [];
  }
  for (const [k, fns] of preferenceMap) {
    if (k === key) return fns;
    if (behaviorName.toLowerCase().includes(k) || k.includes(key)) return fns;
  }
  const bip = extractBehaviorFunctionsFromBipText(rawText, behaviorName);
  if (bip !== null) return bip;
  return null;
}

export function maladaptiveBehaviorFunctionsForHourLabels(
  maladaptiveBehaviorForHour: string[],
  targets: { name: string; functions?: ClinicalFunction[] | null }[],
  labelsEquivalent: (a: string, b: string) => boolean,
): (ClinicalFunction[] | null)[] {
  return maladaptiveBehaviorForHour.map((behaviorLabel) => {
    const b = behaviorLabel.trim();
    if (!b) return null;
    const hit = targets.find((t) => labelsEquivalent(t.name, b));
    if (!hit || hit.functions === undefined) return null;
    if (!hit.functions || hit.functions.length === 0) return [];
    return hit.functions;
  });
}

/**
 * Fill missing `functions` on profile targets from Preference Assessment / BIP text
 * when the RBT profile row has topography or name but no function array yet.
 */
export function enrichMaladaptiveTargetsWithAssessmentFunctions<
  T extends { name: string; topography?: string | null; functions?: ClinicalFunction[] | null },
>(targets: T[], rawAssessmentText: string | null | undefined): T[] {
  const text = rawAssessmentText?.trim() ?? "";
  if (!text) return targets;

  const preferenceMap = extractBehaviorFunctionsFromPreferenceAssessment(text);
  return targets.map((t) => {
    if (t.functions && t.functions.length > 0) return t;
    const resolved = resolveBehaviorFunctionsForName(t.name, preferenceMap, text);
    if (resolved === null || resolved.length === 0) return t;
    return { ...t, functions: resolved };
  });
}

export function maladaptiveBehaviorTopographyForHourLabels(
  maladaptiveBehaviorForHour: string[],
  targets: { name: string; topography?: string | null }[],
  labelsEquivalent: (a: string, b: string) => boolean,
): (string | null)[] {
  return maladaptiveBehaviorForHour.map((behaviorLabel) => {
    const b = behaviorLabel.trim();
    if (!b) return null;
    const hit = targets.find((t) => labelsEquivalent(t.name, b));
    const topo = hit?.topography?.trim();
    if (!topo || isUnusableStoredTopography(topo)) return null;
    return topo;
  });
}
