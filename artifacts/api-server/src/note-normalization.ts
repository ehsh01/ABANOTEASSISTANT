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

/**
 * Bare clinical-function tokens that are sometimes mis-extracted into the interventions list
 * (e.g. BIP line "Hypothesized function: Escape" → profile intervention "Escape"). These are
 * **not** catalog interventions.
 */
export function isBareClinicalFunctionInterventionLabel(name: string): boolean {
  return /^(?:escape|attention|tangible|automatic|sensory)$/i.test(name.trim());
}

/**
 * Safe expansions when a bare function token appears where an intervention name is required.
 * Only map when the expanded form is the unambiguous BIP procedure for that function.
 */
const BARE_FUNCTION_INTERVENTION_ALIAS: Record<string, string> = {
  escape: "Escape Extinction",
};

/**
 * Rewrite a truncated / bare-function intervention label to its exact catalog form when possible.
 * - "Escape" → existing catalog "Escape Extinction" (or the canonical alias when the catalog lacks it)
 * - other bare function tokens (Attention, Tangible, …) → null (drop; not interventions)
 * - otherwise return the trimmed original
 */
export function canonicalizeInterventionLabel(
  label: string,
  interventionCatalog: readonly string[] = [],
): string | null {
  const trimmed = label.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  if (!isBareClinicalFunctionInterventionLabel(trimmed)) return trimmed;

  const key = trimmed.toLowerCase();
  const alias = BARE_FUNCTION_INTERVENTION_ALIAS[key];
  if (!alias) return null;

  const existing = interventionCatalog.find(
    (n) => n.trim().toLowerCase() === alias.toLowerCase(),
  );
  if (existing) return existing.trim();

  // Catalog may only have the bare token (mis-extraction). Promote to the canonical BIP name so
  // notes never document "Escape" as an intervention.
  return alias;
}

/**
 * Normalize a client's intervention list for note generation: expand bare function tokens to real
 * procedure names and drop unrecognized bare-function labels. Preserves first-seen order.
 */
export function canonicalizeInterventionCatalog(interventions: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of interventions) {
    const next = canonicalizeInterventionLabel(raw, interventions);
    if (!next) continue;
    const key = next.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(next);
  }
  return out;
}

/**
 * Longest catalog label that the given naming-sentence token is a strict word-prefix of
 * (e.g. "Escape" → "Escape Extinction"). Returns null when the token is already an exact catalog
 * entry or no longer catalog form starts with it as whole words.
 */
export function longerCatalogInterventionForPrefix(
  prefix: string,
  interventionCatalog: readonly string[],
): string | null {
  const p = prefix.trim().replace(/\s+/g, " ");
  if (!p || p.length < 4) return null;
  const pLower = p.toLowerCase();
  if (interventionCatalog.some((n) => n.trim().toLowerCase() === pLower)) {
    return null;
  }
  let best: string | null = null;
  for (const full of interventionCatalog) {
    const f = full.trim().replace(/\s+/g, " ");
    if (!f || f.toLowerCase() === pLower) continue;
    // Prefix must be a whole-word prefix of the catalog label ("Escape" ⊂ "Escape Extinction").
    if (!f.toLowerCase().startsWith(`${pLower} `) && !f.toLowerCase().startsWith(`${pLower}(`)) {
      continue;
    }
    if (!best || f.length > best.length) best = f;
  }
  return best;
}

export function phraseMatchesAuthorizedIntervention(phrase: string, interventionCatalog: string[]): boolean {
  const p = phrase.trim().toLowerCase();
  if (!p) return false;
  return interventionCatalog.some((name) => {
    const n = name.trim().toLowerCase();
    return n === p || n.includes(p) || p.includes(n);
  });
}

/** Common finite verbs → gerunds for "… by [clause]" assembly slots. */
const CLAUSE_AFTER_BY_GERUNDS: Record<string, string> = {
  made: "making",
  make: "making",
  makes: "making",
  swore: "swearing",
  swear: "swearing",
  swears: "swearing",
  spun: "spinning",
  spin: "spinning",
  spins: "spinning",
  ran: "running",
  run: "running",
  runs: "running",
  hit: "hitting",
  hits: "hitting",
  put: "putting",
  puts: "putting",
  set: "setting",
  sets: "setting",
  kept: "keeping",
  keep: "keeping",
  keeps: "keeping",
  left: "leaving",
  leave: "leaving",
  leaves: "leaving",
  took: "taking",
  take: "taking",
  takes: "taking",
  gave: "giving",
  give: "giving",
  gives: "giving",
  said: "saying",
  say: "saying",
  says: "saying",
  did: "doing",
  do: "doing",
  does: "doing",
  got: "getting",
  get: "getting",
  gets: "getting",
  sat: "sitting",
  sit: "sitting",
  sits: "sitting",
  stood: "standing",
  stand: "standing",
  stands: "standing",
  began: "beginning",
  begin: "beginning",
  begins: "beginning",
  held: "holding",
  hold: "holding",
  holds: "holding",
  went: "going",
  go: "going",
  goes: "going",
  came: "coming",
  come: "coming",
  comes: "coming",
  cried: "crying",
  cry: "crying",
  cries: "crying",
  tried: "trying",
  try: "trying",
  tries: "trying",
  used: "using",
  use: "using",
  uses: "using",
  placed: "placing",
  place: "placing",
  places: "placing",
  pointed: "pointing",
  point: "pointing",
  points: "pointing",
  prompted: "prompting",
  prompt: "prompting",
  prompts: "prompting",
  repeated: "repeating",
  repeat: "repeating",
  repeats: "repeating",
  restated: "restating",
  restate: "restating",
  restates: "restating",
  gestured: "gesturing",
  gesture: "gesturing",
  gestures: "gesturing",
  modeled: "modeling",
  model: "modeling",
  models: "modeling",
  presented: "presenting",
  present: "presenting",
  presents: "presenting",
  delivered: "delivering",
  deliver: "delivering",
  delivers: "delivering",
  provided: "providing",
  provide: "providing",
  provides: "providing",
  blocked: "blocking",
  block: "blocking",
  blocks: "blocking",
  redirected: "redirecting",
  redirect: "redirecting",
  redirects: "redirecting",
  arranged: "arranging",
  arrange: "arranging",
  arranges: "arranging",
  sprinted: "sprinting",
  sprint: "sprinting",
  sprints: "sprinting",
  contacting: "contacting",
  contacts: "contacting",
  contacted: "contacting",
  kicking: "kicking",
  kicks: "kicking",
  kicked: "kicking",
  pushing: "pushing",
  pushes: "pushing",
  pushed: "pushing",
  hitting: "hitting",
  throwing: "throwing",
  throws: "throwing",
  threw: "throwing",
  grabbing: "grabbing",
  grabs: "grabbing",
  grabbed: "grabbing",
  scratching: "scratching",
  scratches: "scratching",
  scratched: "scratching",
};

function finiteVerbToGerund(verb: string): string {
  const lower = verb.toLowerCase();
  if (CLAUSE_AFTER_BY_GERUNDS[lower]) return CLAUSE_AFTER_BY_GERUNDS[lower]!;
  if (/ing$/i.test(verb)) return lower;
  if (/ied$/i.test(verb)) return `${verb.slice(0, -3).toLowerCase()}ying`;
  if (/ies$/i.test(verb)) return `${verb.slice(0, -3).toLowerCase()}ying`;
  if (/ues$/i.test(verb)) return `${verb.slice(0, -1).toLowerCase()}ing`;
  if (/[^aeiou]es$/i.test(verb)) return `${verb.slice(0, -2).toLowerCase()}ing`;
  if (/s$/i.test(verb) && !/ss$/i.test(verb)) return `${verb.slice(0, -1).toLowerCase()}ing`;
  if (/ied$/i.test(verb)) return `${verb.slice(0, -3).toLowerCase()}ying`;
  if (/([^aeiou])\1ed$/i.test(verb)) return `${verb.slice(0, -2).toLowerCase()}ing`;
  if (/e$/i.test(verb)) return `${verb.slice(0, -1).toLowerCase()}ing`;
  if (/ed$/i.test(verb)) return `${verb.slice(0, -2).toLowerCase()}ing`;
  return lower;
}

/**
 * Gerund for a KNOWN base-form verb (safe only after "not", where "does/did not <base>" guarantees
 * a base form — never an irregular past like "swept"). Applies standard "-ing" spelling rules.
 */
function baseFormVerbToGerund(base: string): string {
  const w = base.toLowerCase();
  if (!w) return w;
  const mapped = finiteVerbToGerund(base);
  if (mapped.toLowerCase() !== w) return mapped;
  if (/ing$/.test(w)) return w;
  if (/[^aeiou]e$/.test(w)) return `${w.slice(0, -1)}ing`;
  return `${w}ing`;
}

/** Irregular gerund → simple-past forms that the spelling heuristic cannot derive. */
const GERUND_TO_PAST_IRREGULAR: Record<string, string> = {
  withholding: "withheld",
  keeping: "kept",
  holding: "held",
  setting: "set",
  putting: "put",
  letting: "let",
  leading: "led",
  giving: "gave",
  making: "made",
  taking: "took",
  bringing: "brought",
  telling: "told",
  meeting: "met",
  standing: "stood",
  sitting: "sat",
};

/** Apply the leading-capitalization of `sample` to `word`. */
function matchLeadingCase(sample: string, word: string): string {
  return sample[0] === sample[0]?.toUpperCase()
    ? word.charAt(0).toUpperCase() + word.slice(1)
    : word;
}

/**
 * Convert a gerund action verb ("moving", "requiring", "placing") to its simple past tense
 * ("moved", "required", "placed"). Returns null when the token is not a usable gerund. Handles
 * silent-e verbs, consonant doubling, and consonant+y automatically; irregulars use a small map.
 */
export function gerundActionToPast(word: string): string | null {
  const lower = word.toLowerCase();
  if (!/^[a-z][a-z-]{1,}ing$/.test(lower)) return null;
  const irregular = GERUND_TO_PAST_IRREGULAR[lower];
  if (irregular) return matchLeadingCase(word, irregular);
  const stem = lower.slice(0, -3);
  if (stem.length < 2) return null;
  let past: string;
  if (/[bcdfghjklmnpqrstvwxz]y$/.test(stem)) {
    // consonant + y → -ied (e.g. "trying" → "tried")
    past = `${stem.slice(0, -1)}ied`;
  } else if (/e$/.test(stem)) {
    // stem still ends in e (e.g. "cueing" → "cue" → "cued", "freeing" → "freed")
    past = `${stem}d`;
  } else {
    // Silent-e verbs ("mov" → "moved"), consonant doubling ("stopp" → "stopped"), and plain
    // regular verbs ("block" → "blocked") are all correct as stem + "ed".
    past = `${stem}ed`;
  }
  return matchLeadingCase(word, past);
}

// Subordinating conjunctions / prepositions that end the leading RBT-action list and begin
// contextual detail (often client behavior) that must NOT be reattributed to the RBT.
const ACTION_CLAUSE_BOUNDARY =
  /\b(?:when|while|after|before|until|once|because|since|although|though|if|unless|as|for|without|with|by|to|contingent|upon|so)\b/i;

/**
 * Ensure an intervention-application clause clearly attributes the action to the RBT.
 *
 * The clause is the text that follows "Following this intervention, …". When it begins with a
 * subjectless gerund action ("requiring cleanup …", "moving materials …, placing …"), prepend
 * "the RBT" and convert the leading action verb(s) to simple past. Only the leading action list is
 * reattributed — gerunds inside a following subordinate clause ("… when the client transitioned …
 * without engaging …") are left untouched so client behavior is never mislabeled as an RBT action.
 * Clauses that already have a subject (start with "the RBT", "attention was …", etc.) are unchanged.
 */
export function attributeActionClauseToRbt(clause: string): string {
  const trimmed = clause.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;
  const firstWordMatch = trimmed.match(/^([A-Za-z][A-Za-z-]*)/);
  if (!firstWordMatch) return trimmed;
  const firstWord = firstWordMatch[1]!;
  if (!/ing$/i.test(firstWord)) return trimmed;
  const firstPast = gerundActionToPast(firstWord);
  if (!firstPast) return trimmed;

  // Split the leading action list from any trailing subordinate/contextual clause.
  const afterFirstWord = trimmed.slice(firstWord.length);
  const boundary = ACTION_CLAUSE_BOUNDARY.exec(afterFirstWord);
  let head: string;
  let rest: string;
  if (boundary && boundary.index >= 0) {
    const cut = firstWord.length + boundary.index;
    head = trimmed.slice(0, cut).trimEnd();
    rest = trimmed.slice(cut);
  } else {
    head = trimmed;
    rest = "";
  }

  // Convert the leading gerund and any gerunds that head coordinated list items in the head.
  let newHead = head.replace(/^[A-Za-z][A-Za-z-]*/, firstPast);
  newHead = newHead.replace(
    /(,\s+(?:and\s+)?|\s+and\s+)([A-Za-z][A-Za-z-]*ing)\b/gi,
    (_m, sep: string, gerund: string) => {
      const past = gerundActionToPast(gerund);
      return `${sep}${past ?? gerund}`;
    },
  );

  const rebuilt = `${newHead}${rest ? ` ${rest}` : ""}`.replace(/\s+/g, " ").trim();
  return `the RBT ${rebuilt}`;
}

/**
 * Body-level guard: for every "Following this intervention[s], …" sentence whose action clause is a
 * subjectless gerund, insert "the RBT" as the implementing subject (see attributeActionClauseToRbt).
 */
export function normalizeClinicalBodyInterventionActionAttribution(body: string): string {
  return body.replace(
    /(Following (?:this intervention|these interventions),\s+)([^.?!]*)/g,
    (_m, lead: string, clause: string) => `${lead}${attributeActionClauseToRbt(clause)}`,
  );
}

/**
 * Normalize text that follows "… by" in manifested-behavior / replacement sentences.
 * Strips leading "the RBT"/"the client" subjects and converts the lead verb to a gerund so
 * assembly never emits "by the RBT repeated…" or "by the client swore…".
 */
export function normalizeClauseAfterBy(text: string): string {
  let t = text.trim().replace(/\s+/g, " ");
  if (!t) return t;
  t = t.replace(/^(?:the\s+)?(?:RBT|client)\s+/i, "");
  // Negative/stative BIP definitions ("Does not initiate the demand…", "did not respond…")
  // must read as "not initiating the demand…", never "doing not initiate…".
  const negative = t.match(
    /^(?:do|does|did|is|was|are|were|has|have|had)\s+not\s+([A-Za-z']+)\b([\s\S]*)$/i,
  );
  if (negative) {
    const gerund = baseFormVerbToGerund(negative[1]!);
    t = `not ${gerund}${negative[2] ?? ""}`.replace(/\s+/g, " ").trim();
  } else {
    t = t.replace(/^([A-Za-z']+)(?=\s|$)/, (verb) => finiteVerbToGerund(verb));
  }
  if (!/[.!?]$/.test(t)) t = `${t}.`;
  return t;
}

/** Fix partial intervention labels (e.g. DRI without parenthetical, Escape → Escape Extinction). */
export function normalizeClinicalBodyInterventionLabels(body: string, interventionCatalog: string[]): string {
  let out = body;
  for (const full of interventionCatalog) {
    const base = catalogInterventionBaseWithoutParenthetical(full);
    if (!base || out.includes(full)) continue;
    const re = new RegExp(`((?:implemented|applied)\\s+)${escapeRegExp(base)}(\\s*\\.)`, "gi");
    out = out.replace(re, `$1${full}$2`);
  }
  // Truncated multi-word catalog names: "implemented Escape." → "implemented Escape Extinction."
  // Prefer longer catalog forms; skip when the prefix is itself an exact catalog entry.
  const namingTokenRe = /((?:implemented|applied)\s+)([A-Za-z][A-Za-z0-9'/-]*(?:\s+[A-Za-z][A-Za-z0-9'/-]*){0,6})(\s*\.)/gi;
  out = out.replace(namingTokenRe, (match, lead: string, token: string, trail: string) => {
    const longer = longerCatalogInterventionForPrefix(token, interventionCatalog);
    if (!longer) return match;
    return `${lead}${longer}${trail}`;
  });
  // Bare function token with no longer catalog form yet (e.g. catalog only had "Escape"): promote alias.
  out = out.replace(
    /((?:implemented|applied)\s+)(Escape|Attention|Tangible|Automatic|Sensory)(\s*\.)/gi,
    (match, lead: string, token: string, trail: string) => {
      const canonical = canonicalizeInterventionLabel(token, interventionCatalog);
      if (!canonical || canonical.toLowerCase() === token.toLowerCase()) return match;
      return `${lead}${canonical}${trail}`;
    },
  );
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
 * Medication is out of scope for an RBT: RBTs never administer, deliver, prompt, or instruct
 * medication. Hard-remove any medication reference from note prose (any field or the assembled body),
 * rewriting it to a neutral session task so no note ever states the RBT gave, prompted, or instructed
 * medication. "tablet"/"capsule" are intentionally excluded — "tablet" is a common reinforcer here.
 */
const MEDICATION_NOUN_SOURCE =
  "(?:medications?|medicine|medicines|meds|pills?|prescriptions?|inhalers?|dosages?|doses?)";

export function scrubMedicationReferences(text: string): string {
  if (!text) return text;
  const med = MEDICATION_NOUN_SOURCE;
  let out = text;

  // "instruction/task/prompt (related to|regarding|about|involving|concerning|pertaining to)
  //  (taking|administering|giving) (his/her/their/the) medication" → drop the whole medication
  //  prepositional phrase. Bare "to"/"for" are intentionally excluded so infinitive verb phrases
  //  ("to take his medication") fall through to the verb rewrite below instead of being deleted.
  out = out.replace(
    new RegExp(
      `\\s*(?:related to|regarding|about|involving|concerning|pertaining to)\\s+(?:take|taking|administer|administering|give|giving|dispense|dispensing|receive|receiving)?\\s*(?:his|her|their|the|a|an)?\\s*${med}\\b`,
      "gi",
    ),
    "",
  );

  // "take/administer/give/dispense (his/her/their/the) medication" → complete the task.
  out = out.replace(
    new RegExp(
      `\\b(take|taking|administer|administering|give|giving|dispense|dispensing)\\s+(?:his|her|their|the|a|an)?\\s*${med}\\b`,
      "gi",
    ),
    (_m, verb: string) => (/ing$/i.test(verb) ? "completing the task" : "complete the task"),
  );

  // "medication routine/administration/schedule/task/activity/time/management" → the scheduled task.
  out = out.replace(
    new RegExp(
      `\\b(?:his|her|their|the|a|an)?\\s*${med}\\s+(?:routine|administration|schedule|task|activity|time|management)\\b`,
      "gi",
    ),
    "the scheduled task",
  );

  // Catch-all: neutralize any remaining medication noun so the word never appears in a saved note.
  out = out
    .replace(/\b(?:pills?|inhalers?)\b/gi, "item")
    .replace(/\b(?:dosages?|doses?)\b/gi, "step")
    .replace(/\bprescriptions?\b/gi, "plan")
    .replace(/\b(?:medications?|medicine|medicines|meds)\b/gi, "scheduled task");

  return out
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;])/g, "$1")
    .trim();
}

/**
 * Auditors flag environmental details that are not documented (marked play spaces, visual boundaries,
 * marked lines/zones). Replace those invented references with a neutral, observable location phrase.
 * "marked" as a verb ("marked a response on the worksheet") is untouched — only the invented
 * "marked <space/area/boundary>" noun phrase is rewritten.
 */
export function scrubInventedEnvironmentDetails(text: string): string {
  if (!text) return text;
  return text
    .replace(
      /\b(?:the|a|an|his|her|their)?\s*marked\s+(?:play\s+|work\s+|activity\s+)?(?:space|spaces|area|areas|boundary|boundaries|spot|spots|line|lines|zone|zones|circle|square|mat)\b/gi,
      "the designated activity area",
    )
    .replace(
      /\b(?:the|a|an)?\s*visual\s+(?:boundary|boundaries|line|lines|marker|markers)\b/gi,
      "the designated activity area",
    )
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;])/g, "$1");
}

/**
 * Final scrub for full assembled notes (clinical body + locked closing): never leave "social praise",
 * BIP status-placeholder topography, medication references, or invented environmental details.
 */
export function scrubAssembledNoteQcHotspots(noteText: string): string {
  return collapseDuplicateAdjacentWords(
    scrubFirstThenProcedureLabels(
      scrubInventedEnvironmentDetails(scrubMedicationReferences(noteText))
        .replace(/\bsocial praise\b/gi, "praise")
        .replace(
          /\bby\s+Status\s*:\s*To be initiated\.?/gi,
          "by engaging in the targeted motor actions for this episode.",
        )
        .replace(/\bStatus\s*:\s*To be initiated\.?/gi, "")
        .replace(/\bTo be initiated\.?/gi, "")
        .replace(/\bPlaying with (?:his|her|their)\s+/gi, "Playing with the ")
        .replace(/[ \t]{2,}/g, " ")
        .replace(/ \./g, "."),
    ),
  ).trim();
}

/**
 * Reinforcer wording: never list "social praise", "verbal praise", or "behavior-specific praise"
 * (reviewers misread those compounds as catalog intervention names). Prefer plain "praise" /
 * "brief praise" in the clinical body. Locked closing always uses plain "praise" as well.
 */
export function normalizeClinicalBodyPraiseWording(body: string): string {
  const briefPraise = (match: string) =>
    match[0] === match[0]?.toUpperCase() ? "Brief praise" : "brief praise";
  const praise = (match: string) =>
    match[0] === match[0]?.toUpperCase() ? "Praise" : "praise";
  // Compound praise labels ("social/verbal/behavior-specific praise") are treated by external
  // reviewers as unauthorized intervention names, so collapse them to plain "praise". Plain
  // "praise" is allowed everywhere, so we do NOT rewrite grammatical "delivered praise …"
  // sentences (earlier rewrites here dropped governing verbs and injected mid-sentence capitals,
  // producing "acknowledged the response and brief access to sensory toys").
  const withheld = (match: string) =>
    match[0] === match[0]?.toUpperCase()
      ? "The RBT maintained neutral attention during"
      : "the RBT maintained neutral attention during";
  return body
    .replace(/\bbrief social praise\b/gi, briefPraise)
    .replace(/\bsocial praise\b/gi, praise)
    .replace(/\bbrief behavior-specific praise\b/gi, briefPraise)
    .replace(/\bbehavior-specific praise\b/gi, praise)
    .replace(/\bbrief verbal praise\b/gi, briefPraise)
    .replace(/\bverbal praise\b/gi, praise)
    .replace(
      /\b((?:brief )?praise) (?:was )?withheld during\b/gi,
      (m) => withheld(m),
    );
}

/** Phrases in "Following this intervention" detail that reviewers treat as invented intervention names. */
export const DEFAULT_UNAUTHORIZED_INTERVENTION_LIKE_PHRASES: RegExp[] = [
  /\bfirst[\s\-\/]*then(?:\s+(?:statement|board|visual|contingency|cue))?\b/i,
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
 * Rewrite Premack application prose that names "first-then" as if it were a catalog intervention.
 * Keep only the contingency description (demand before preferred access).
 */
export function scrubFirstThenProcedureLabels(text: string): string {
  return text
    .replace(
      /\b(?:the RBT\s+)?(?:used|delivered|presented|stated|provided)\s+a\s+first[\s\-\/]*then\s+(?:statement|board|visual|contingency|cue)?\s*(?:linking|pairing|connecting)\s+(.+?)\s+with\s+(?:access to\s+)?([^.;]+)([.;])/gi,
      "the RBT required $1 before access to $2$3",
    )
    .replace(
      /\b(?:the RBT\s+)?(?:used|delivered|presented|stated|provided)\s+a\s+first[\s\-\/]*then\s+(?:statement|board|visual|contingency|cue)\b/gi,
      "the RBT required completion of the presented demand before access to the preferred item",
    )
    .replace(
      /\ba\s+first[\s\-\/]*then\s+(?:statement|board|visual|contingency|cue)\b/gi,
      "a contingency requiring the demand before the preferred item",
    )
    .replace(/\bfirst[\s\-\/]*then\b/gi, "demand-before-reinforcer");
}

/** Collapse accidental repeated tokens (e.g. "sensory sensory toys"). */
export function collapseDuplicateAdjacentWords(text: string): string {
  return text.replace(/\b([A-Za-z][A-Za-z'-]{1,})\s+\1\b/gi, "$1");
}

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

  let out = scrubFirstThenProcedureLabels(body);
  for (const [pat, substitute] of replacements) {
    pat.lastIndex = 0;
    const m = pat.exec(out);
    if (!m) continue;
    if (phraseMatchesAuthorizedIntervention(m[0], interventionCatalog)) {
      continue;
    }
    out = out.replace(pat, substitute);
  }
  return collapseDuplicateAdjacentWords(out);
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
