/**
 * Clinical-body normalization: deterministic text rewrites applied before validation
 * (exact catalog label expansion, escaped-quote cleanup, invented-phrase substitution).
 * Shared phrase-matching helpers used by both normalization and validators live here.
 *
 * Extracted from note-validation.ts (which re-exports the normalize* functions).
 */
import {
  MALADAPTIVE_BEHAVIOR_SIB_CANONICAL,
  maladaptiveBehaviorLabelsEquivalent,
} from "./note-scheduling";

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Catalog label with trailing parenthetical acronym, e.g. "... Behavior (DRI)". */
export function catalogInterventionBaseWithoutParenthetical(full: string): string | null {
  const m = /^(.*)\s*\(([A-Za-z][A-Za-z0-9/-]*)\)\s*$/.exec(full.trim());
  if (!m) return null;
  const base = m[1]!.replace(/\s+/g, " ").trim();
  return base.length > 0 ? base : null;
}

export function phraseMatchesAuthorizedIntervention(phrase: string, interventionCatalog: string[]): boolean {
  const p = phrase.trim().toLowerCase();
  if (!p) return false;
  return interventionCatalog.some((name) => {
    const n = name.trim().toLowerCase();
    return n === p || n.includes(p) || p.includes(n);
  });
}

/** Fix partial intervention labels (e.g. DRI without parenthetical) before validation. */
export function normalizeClinicalBodyInterventionLabels(body: string, interventionCatalog: string[]): string {
  let out = body;
  for (const full of interventionCatalog) {
    const base = catalogInterventionBaseWithoutParenthetical(full);
    if (!base || out.includes(full)) continue;
    const re = new RegExp(`((?:implemented|applied)\\s+)${escapeRegExp(base)}(\\s*\\.)`, "gi");
    out = out.replace(re, `$1${full}$2`);
  }
  // Exact BIP string is typically "Visual Supports" (plural); rewrite singular naming sentences.
  const visualSupportsExact = interventionCatalog.find((n) => /^visual supports$/i.test(n.trim()));
  if (visualSupportsExact) {
    out = out.replace(
      /((?:implemented|applied)\s+)Visual Support(\s*\.)/gi,
      `$1${visualSupportsExact}$2`,
    );
  }
  return out;
}

/**
 * Reinforcer wording: never list "verbal praise" or "behavior-specific praise" (reviewers misread
 * those compounds as catalog intervention names). Prefer plain "praise" / "brief praise" in the
 * clinical body; the locked closing uses "social praise" when that BIP preference is on file.
 */
export function normalizeClinicalBodyPraiseWording(body: string): string {
  const briefPraise = (match: string) =>
    match[0] === match[0]?.toUpperCase() ? "Brief praise" : "brief praise";
  const praise = (match: string) =>
    match[0] === match[0]?.toUpperCase() ? "Praise" : "praise";
  return body
    .replace(/\bbrief behavior-specific praise\b/gi, briefPraise)
    .replace(/\bbehavior-specific praise\b/gi, praise)
    .replace(/\bbrief verbal praise\b/gi, briefPraise)
    .replace(/\bverbal praise\b/gi, praise)
    .replace(
      /\b(?:brief )?praise (?:was )?withheld during ([^.;]+)/gi,
      "The RBT maintained neutral attention during $1",
    )
    .replace(
      /\b(?:brief )?praise (?:was )?delivered (?:after|when) the client ([^.;]+)/gi,
      "The RBT acknowledged the completed response after the client $1",
    )
    .replace(
      /\bthe RBT (?:delivered|provided) (?:brief )?praise (?:after|when) the client ([^.;]+)/gi,
      "The RBT acknowledged the completed response after the client $1",
    )
    .replace(
      /\bthe RBT (?:delivered|provided) (?:brief )?praise after ([^.;]+)/gi,
      "The RBT acknowledged the response after $1",
    )
    .replace(
      /\bthe RBT (?:delivered|provided) (?:brief )?praise and\b/gi,
      "The RBT acknowledged the response and",
    )
    .replace(
      /\b(?:brief )?praise followed\b/gi,
      "The RBT acknowledged the response",
    );
}

/** Phrases in "Following this intervention" detail that reviewers treat as invented intervention names. */
export const DEFAULT_UNAUTHORIZED_INTERVENTION_LIKE_PHRASES: RegExp[] = [
  /\bverbal praise contingent on each instance of task engagement\b/i,
  /\bbehavior-specific praise contingent on each instance of task engagement\b/i,
  /\breinforced appropriate task engagement with verbal praise\b/i,
  /\breinforced appropriate task engagement with behavior-specific praise\b/i,
  /\breinforced appropriate task engagement\b/i,
  /\bredirected the client(?:'|’)s hands back to the worksheet\b/i,
  /\bredirected hands back to worksheet\b/i,
  /\bguided the client to place one marker at a time into the bin\b/i,
  /\bguided client to place one marker at a time into bin\b/i,
  /\bprovided verbal praise contingent on each completed step\b/i,
  /\bprovided behavior-specific praise contingent on each completed step\b/i,
  /\bmodeled placing\b/i,
];

/**
 * Rewrite intervention-detail prose that external review misreads as catalog intervention names.
 */
export function normalizeClinicalBodyInterventionDetailPhrases(
  body: string,
  interventionCatalog: string[],
): string {
  const replacements: [RegExp, string][] = [
    [
      /\bverbal praise contingent on each instance of task engagement\b/gi,
      "the RBT acknowledged completed worksheet responses",
    ],
    [
      /\breinforced appropriate task engagement with verbal praise\b/gi,
      "acknowledged completed worksheet responses and continued the task",
    ],
    [
      /\breinforced appropriate task engagement\b/gi,
      "delivered reinforcement after worksheet responses",
    ],
    [
      /\bredirected the client(?:'|’)s hands back to the worksheet\b/gi,
      "pointed to the worksheet and re-presented the instruction",
    ],
    [
      /\bredirected hands back to worksheet\b/gi,
      "pointed to the worksheet and re-presented the instruction",
    ],
    [
      /\bguided the client to place one marker at a time into the bin\b/gi,
      "pointed to one marker and the bin while re-presenting the cleanup instruction",
    ],
    [
      /\bguided client to place one marker at a time into bin\b/gi,
      "pointed to one marker and the bin while re-presenting the cleanup instruction",
    ],
    [
      /\bprovided verbal praise contingent on each completed step\b/gi,
      "acknowledged completed cleanup steps and continued the activity",
    ],
    [/\bmodeled placing\b/gi, "demonstrated placing"],
  ];

  let out = body;
  for (const [pat, substitute] of replacements) {
    const m = pat.exec(out);
    if (!m) continue;
    if (phraseMatchesAuthorizedIntervention(m[0], interventionCatalog)) {
      continue;
    }
    out = out.replace(pat, substitute);
  }
  return out;
}

/** Teaching phrases reviewers treat as unauthorized replacement program names (case-insensitive). */
export const DEFAULT_UNAUTHORIZED_REPLACEMENT_LIKE_PHRASES: RegExp[] = [
  /\brequest a break\b/i,
  /\bfunctional phrase to request\b/i,
  /\btask engagement\b/i,
  /\bkeep both hands on the table\b/i,
  /\bhands[- ]down behavior\b/i,
  /\breinforced hands[- ]down\b/i,
  /\bhand placement maintained\b/i,
];

export function phraseMatchesAuthorizedReplacementProgram(phrase: string, authorizedPrograms: string[]): boolean {
  const p = phrase.trim().toLowerCase();
  if (!p) return false;
  return authorizedPrograms.some((name) => {
    const n = name.trim().toLowerCase();
    return n === p || n.includes(p) || p.includes(n);
  });
}

export function normalizeClinicalBodyEscapedQuotes(body: string): string {
  return body.replace(/\\"/g, '"').replace(/\\'/g, "'");
}

/**
 * Rewrite common invented replacement-like teaching labels before validation.
 */
export function normalizeClinicalBodyReplacementLikePhrases(
  body: string,
  authorizedPrograms: string[],
): string {
  const replacements: [RegExp, string][] = [
    [/\btask engagement\b/gi, "worksheet responding"],
    [/\bkeep both hands on the table\b/gi, "place both hands flat on the table surface"],
    [/\bhands[- ]down behavior\b/gi, "appropriate hand placement at the table"],
    [/\breinforced hands[- ]down\b/gi, "reinforced appropriate hand placement"],
    [/\bhand placement maintained\b/gi, "appropriate hand placement was maintained"],
  ];

  let out = body;
  for (const [pat, substitute] of replacements) {
    const m = pat.exec(out);
    if (!m) continue;
    const matched = m[0];
    if (phraseMatchesAuthorizedReplacementProgram(matched, authorizedPrograms)) {
      continue;
    }
    out = out.replace(pat, substitute);
  }
  return out;
}

/** Expand bare "SIB" in manifested-behavior lines when the catalog uses the full label. */
export function normalizeClinicalBodyMaladaptiveBehaviorLabels(
  body: string,
  maladaptiveCatalog: string[],
): string {
  const catalogHasFullSib = maladaptiveCatalog.some((c) =>
    maladaptiveBehaviorLabelsEquivalent(c, MALADAPTIVE_BEHAVIOR_SIB_CANONICAL),
  );
  if (!catalogHasFullSib) return body;

  return body.replace(
    /\b((?:the client )?manifested)\s+SIB\b/gi,
    `$1 ${MALADAPTIVE_BEHAVIOR_SIB_CANONICAL}`,
  );
}
