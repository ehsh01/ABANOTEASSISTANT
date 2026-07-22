/** Elopement / wandering / bolting / running away — need observable leaving-boundary topography in the B line. */
export function isElopementFamilyBehaviorLabel(behaviorName: string): boolean {
  const b = behaviorName.trim().toLowerCase();
  return (
    /\belope/.test(b) ||
    /\bwandering\b/.test(b) ||
    /\bbolting\b/.test(b) ||
    /\brunning\s+away\b/.test(b)
  );
}

export function isTaskRefusalBehaviorLabel(behaviorName: string): boolean {
  return /\btask\s+refusal\b/i.test(behaviorName.trim());
}

/**
 * True when Task Refusal topography describes the *appropriate* activity (e.g. "washing hands")
 * instead of an observable refusal (not initiating, pushing materials away, turning away, etc.).
 */
export function taskRefusalTopographyDescribesAppropriateBehavior(topography: string): boolean {
  const t = topography.trim().replace(/\s+/g, " ");
  if (!t) return false;
  const refusalCues =
    /\b(?:not\s+initiat|refus(?:ed|ing|al)?|push(?:ed|ing|es)?\s+(?:away|materials|items)|turn(?:ed|ing)\s+(?:away|from|his|her|their)\s+head|walk(?:ed|ing)\s+away|ignor(?:ed|ing)|did\s+not|does\s+not|doesn't|fail(?:ed|ing)?\s+to|without\s+(?:begin|start|initiat)|left\s+the\s+(?:table|task|area)|drop(?:ped|ping)\s+(?:materials|items)|threw\s+(?:materials|items)|no\s+response|remain(?:ed|ing)\s+(?:silent|still)|sit(?:ting)?\s+(?:idle|still))\b/i;
  if (refusalCues.test(t)) return false;
  // Leading compliance/engagement verbs used as if they were the maladaptive topography.
  if (
    /^(?:washing|brushing|cleaning|completing|writing|matching|sorting|putting|placing|picking|following|sitting|engaging|participating|performing|doing|starting|beginning|initiating)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  // Short activity noun phrases with no refusal framing ("handwashing", "the toothbrushing routine").
  if (
    t.length < 80 &&
    /\b(?:hand\s*-?\s*wash|toothbrush|brush(?:ing)?\s+teeth|cleanup|clean\s*-?\s*up|worksheet|matching|sorting|table\s*-?\s*work)\b/i.test(
      t,
    ) &&
    !refusalCues.test(t)
  ) {
    return true;
  }
  return false;
}

/**
 * BIP operational-definition dumps pasted into topography (scoring frames, "any instance", long
 * legalese). Session notes must use a single observed action, not the plan definition.
 */
export function looksLikePastedBipDefinitionTopography(topography: string): boolean {
  const t = topography.trim().replace(/\s+/g, " ");
  if (!t) return false;
  if (
    /\b(?:defined as|operational(?:ly)?\s+defined|any\s+instance|any\s+episode|characterized by|scored\s+after|episodes?\s+are\s+scored)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  // BIP measurement/criteria language leaking into topography. "for any duration of time" /
  // "for any length of time" is definition-metric wording, not an observed session action.
  // NOTE: a bare distance like "more than 2 feet away from the adult" is acceptable observable
  // topography (both approved example notes use it), so distance alone is NOT flagged here — only the
  // open-ended duration/generalization phrasing that signals a pasted BIP definition.
  if (
    /\bfor any (?:duration|length|period|amount)(?:\s+of\s+time)?\b/i.test(t) ||
    /\bany duration of time\b/i.test(t) ||
    /\bfor any duration\b/i.test(t)
  ) {
    return true;
  }
  // Long multi-clause definition style without a concrete single session action.
  if (
    t.length > 140 &&
    /\b(?:without permission|supervised area|designated area|expected to remain|when the client is)\b/i.test(t) &&
    /(?:and|or|,)/.test(t)
  ) {
    return true;
  }
  return false;
}

/**
 * BIP program-tracking / status lines and empty placeholders must never be used as topography.
 * Profile fields sometimes store "Status: To be initiated" which is not an observable form of the
 * behavior — and the word "initiated" falsely matches the observable-action lexicon.
 */
export function isUnusableStoredTopography(text: string | null | undefined): boolean {
  const t = (text ?? "").trim().replace(/\s+/g, " ");
  if (!t) return true;
  if (/^\s*status\s*:/i.test(t)) return true;
  if (/^(?:n\/a|na|none|tbd|pending|mastered|discontinued|unknown)\.?$/i.test(t)) return true;
  if (/\b(?:to be|not yet|not)\s+initiated\b/i.test(t)) {
    // Status phrases with no destruction/aggressive action words are unusable.
    if (!/\b(?:throw|threw|throwing|rip|ripped|ripping|tear|tearing|break|broke|breaking|kick|kicked|hit|hitting|slam|knock|destroy|destroying|push|pushed)\b/i.test(t)) {
      return true;
    }
  }
  if (/^\s*(?:to be\s+)?initiated\.?\s*$/i.test(t)) return true;
  // Very short admin labels ("Initiated", "Maintenance")
  if (t.length < 12 && !/\b(?:hit|kick|throw|rip|bite|scream|elope|grab|slap)\b/i.test(t)) {
    return true;
  }
  return false;
}

/**
 * Last-resort observable topography when the profile/BIP has only a status placeholder and the model
 * copied that status. Prefer assessment extract / model prose when available; these phrases exist so
 * notes never ship "Status: To be initiated" as the manifested-behavior form.
 * Keep these to a **single** action (not a comma/or list) so ABC paragraphs stay natural.
 */
export function lastResortObservableTopographyForBehavior(behaviorLabel: string): string | null {
  const b = behaviorLabel.trim().toLowerCase();
  if (!b) return null;
  if (/\btask\s+refusal\b/.test(b)) {
    return "not initiating the presented demand within 10 seconds after the instruction was delivered";
  }
  if (isElopementFamilyBehaviorLabel(behaviorLabel)) {
    return "walking several feet away from the RBT toward the hallway without permission";
  }
  if (/\bclimb/.test(b)) {
    return "placing a foot or knees on furniture or elevated surfaces to reach preferred items";
  }
  if (
    /\bstereotyp/.test(b) ||
    /\bstereotypy\b/.test(b) ||
    /\brepetitive\s+motor\b/.test(b) ||
    /\brepetitive\s+behaviou?r\b/.test(b)
  ) {
    return "engaging in repetitive motor movements with the hands unrelated to the presented task";
  }
  if (/\btantrum\b/.test(b) || /\bmeltdown\b/.test(b)) {
    return "crying, yelling, and dropping to the floor during the presented demand";
  }
  if (/\bproperty\s+destruction\b/.test(b)) {
    return "throwing or knocking session materials from the work surface";
  }
  if (/\bexcessive\s+motor\b/.test(b)) {
    return "flapping hands near the work materials";
  }
  if (/\bphysical\s+aggression\b/.test(b)) {
    return "contacting the RBT's arm with an open hand after the demand was presented";
  }
  return null;
}

/**
 * When Task Refusal topography wrongly names the activity, rebuild a refusal topography from the
 * antecedent's activity cues when possible (handwashing, toothbrushing, cleanup, etc.).
 */
export function taskRefusalTopographyFromAntecedent(antecedent: string): string | null {
  const a = antecedent.trim().replace(/\s+/g, " ");
  if (!a) return null;
  if (/\bhand\s*-?\s*wash|wash(?:ing)?\s+hands\b/i.test(a)) {
    return "not initiating the handwashing routine within 10 seconds after the instruction was delivered";
  }
  if (/\btooth\s*-?\s*brush|brush(?:ing)?\s+teeth\b/i.test(a)) {
    return "not initiating the toothbrushing routine within 10 seconds after the instruction was delivered";
  }
  // Generic hygiene/sink only when a more specific routine was not already matched above.
  if (/\bhygiene\b|\bat the sink\b/i.test(a)) {
    return "not initiating the hygiene routine within 10 seconds after the instruction was delivered";
  }
  if (/\bclean\s*-?\s*up|cleanup\b/i.test(a)) {
    return "not initiating the cleanup demand within 10 seconds after the instruction was delivered";
  }
  if (/\b(?:worksheet|writing|table\s*-?\s*work|matching|sorting)\b/i.test(a)) {
    return "not initiating the presented table-work demand within 10 seconds after the instruction was delivered";
  }
  return null;
}

/** Incomplete fragments like "with an open" must never ship in ABC topography. */
export function isIncompleteTopographyAction(action: string): boolean {
  const t = action.trim().replace(/\s+/g, " ");
  if (!t) return true;
  if (/\b(?:with\s+)?(?:an?|the)\s+(?:open|closed)$/i.test(t)) return true;
  if (/\bwith\s+(?:an?|the)?$/i.test(t)) return true;
  if (/\b(?:an?|the|or|and|and\/or)$/i.test(t)) return true;
  if (/\bopen or closed$/i.test(t)) return true;
  // Truncated example parenthetical: "... (e.g." / "... (i.e." / trailing "(".
  if (/\((?:e\.?g\.?|i\.?e\.?|such as|including|like)?\.?$/i.test(t)) return true;
  if (/\be\.?g\.?$/i.test(t)) return true;
  return false;
}

/**
 * Normalize an example parenthetical inside topography. A COMPLETE "(e.g. a, b, c)" after a generic
 * lead ("repeating leg/hand movements") is replaced by the concrete examples so a single observable
 * action can be selected. An UNTERMINATED "(e.g. …" (the truncation bug) is dropped entirely.
 */
export function normalizeExampleParenthetical(text: string): string {
  let t = text.trim().replace(/\s+/g, " ");
  if (!t) return t;
  // Unterminated example parenthetical (no closing paren) → drop it.
  if (/\((?:e\.?g\.?|i\.?e\.?|such as|including|like)\b[^)]*$/i.test(t)) {
    t = t.replace(/\s*\((?:e\.?g\.?|i\.?e\.?|such as|including|like)\b[^)]*$/i, "").trim();
  }
  const m = t.match(
    /^(.*?)\s*\(\s*(?:e\.?g\.?|i\.?e\.?|such as|including|like)\b[.:,]*\s*([^)]+)\)\s*(.*)$/i,
  );
  if (m) {
    const lead = m[1]!.trim();
    const inner = m[2]!.trim();
    const tail = m[3]!.trim();
    if (
      !tail &&
      /\b(?:movements?|behaviou?rs?|actions?|forms?|responses?|stereotypy|motions?)$/i.test(lead)
    ) {
      t = inner;
    } else {
      t = `${lead}${tail ? ` ${tail}` : ""}`.trim();
    }
  }
  return t
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;])/g, "$1")
    .replace(/\(\s*$/, "")
    .trim();
}

/**
 * True when the maladaptive topography is an interpretation ("refusing to comply", "was noncompliant",
 * "acted out") with no observable action. Auditors require what was actually observed, so these must be
 * recovered from the antecedent/last-resort observable topography.
 */
export function isVagueMaladaptiveTopography(text: string | null | undefined): boolean {
  const t = (text ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return true;
  const observableFollowUp =
    /\b(?:by|and|,)\s*(?:not\s+initiat|push|turn|walk|drop|throw|threw|leav|cross|put|plac|scream|hit|kick|slap|grab|bit|move|remain|sit|stay|ignor|point|refuse\s+to\s+touch)/i;
  const interpretationLead =
    /^(?:refus(?:ed|ing|al)?|did\s*n[o']t\s+want\s+to|would\s+not|was\s+non-?compliant|being\s+non-?compliant|non-?compliance|acted\s+out|misbehav(?:ed|ing)|not\s+complying|declined|was\s+defiant|was\s+uncooperative)\b/i;
  if (interpretationLead.test(t) && !observableFollowUp.test(t)) return true;
  if (/refus\w*\s+to\s+comply/.test(t) && !observableFollowUp.test(t)) return true;
  if (/\bnon-?compliant\b/.test(t) && !observableFollowUp.test(t)) return true;
  // Subjective intent / value judgments are not observable session topography.
  if (/\bintentionally\b/.test(t) || /\bvaluable objects?\b/.test(t)) return true;
  // Bare contact without a specific target ("pushing others", "hitting people").
  if (/^(?:pushing|hitting|kicking|slapping|grabbing)\s+(?:others?|people|someone|somebody)\.?$/i.test(t)) {
    return true;
  }
  // Incomplete BIP definition dumps (unclosed paren / mall-community template).
  if (/\([^)]*$/.test(t)) return true;
  if (/\bin the community\b/.test(t) && /\bmalls?\b/.test(t)) return true;
  return false;
}

/**
 * Expand "open or closed hand/fist" into concrete single-means alternatives so ABC text
 * names how contact occurred without the BIP hedge (and without truncating mid-phrase).
 */
function expandOpenClosedMeans(action: string): string[] {
  const m = action.match(
    /^(.*?\bwith\s+)(?:an?\s+)?open or closed\s+(hand|fist)(\b.*)?$/i,
  );
  if (!m) return [action];
  const stem = m[1]!;
  const noun = m[2]!.toLowerCase();
  const tail = m[3] ?? "";
  return [
    `${stem}an open ${noun}${tail}`.replace(/\s+/g, " ").trim(),
    `${stem}a closed ${noun}${tail}`.replace(/\s+/g, " ").trim(),
  ];
}

function normalizeContactMeans(raw: string): string {
  let m = raw
    .trim()
    .replace(/^(?:or|and|and\/or)\s+/i, "")
    .replace(/[.]+$/, "")
    .replace(/\s+/g, " ");
  if (!m) return "";
  if (/^(?:an?\s+)?open\s+hand$/i.test(m)) return "an open hand";
  if (/^(?:an?\s+)?closed\s+hand$/i.test(m)) return "a closed hand";
  if (/^(?:an?\s+)?open\s+fist$/i.test(m)) return "an open fist";
  if (/^(?:an?\s+)?closed\s+fist$/i.test(m)) return "a closed fist";
  if (/^fist$/i.test(m)) return "a fist";
  if (/^foot$/i.test(m)) return "a foot";
  if (/^object$/i.test(m)) return "an object";
  if (/^hand$/i.test(m)) return "a hand";
  return m;
}

/** Add a missing article to a bare "with <means>" clause: "with foot" → "with a foot". */
function normalizeBareMeansInPhrase(action: string): string {
  return action.replace(
    /\bwith\s+(foot|hand|fist|palm|knuckle|object|elbow|knee|shoulder|head)\b/gi,
    (_m, noun: string) => {
      const key = noun.toLowerCase();
      const article = /^[aeiou]/.test(key) ? "an" : "a";
      return `with ${article} ${key}`;
    },
  );
}

/** Aggression/contact verb forms → gerund, for semicolon action lists. */
const AGGRESSION_GERUND: Record<string, string> = {
  headbutt: "headbutting",
  headbutts: "headbutting",
  headbutted: "headbutting",
  headbutting: "headbutting",
  scratch: "scratching",
  scratches: "scratching",
  scratched: "scratching",
  scratching: "scratching",
  pinch: "pinching",
  pinches: "pinching",
  pinched: "pinching",
  pinching: "pinching",
  bite: "biting",
  bites: "biting",
  bit: "biting",
  biting: "biting",
  kick: "kicking",
  kicks: "kicking",
  kicked: "kicking",
  kicking: "kicking",
  hit: "hitting",
  hits: "hitting",
  hitting: "hitting",
  slap: "slapping",
  slaps: "slapping",
  slapped: "slapping",
  slapping: "slapping",
  push: "pushing",
  pushes: "pushing",
  pushed: "pushing",
  pushing: "pushing",
  grab: "grabbing",
  grabs: "grabbing",
  grabbed: "grabbing",
  grabbing: "grabbing",
  throw: "throwing",
  throws: "throwing",
  threw: "throwing",
  throwing: "throwing",
  spit: "spitting",
  spits: "spitting",
  spat: "spitting",
  spitting: "spitting",
  pull: "pulling",
  pulls: "pulling",
  pulled: "pulling",
  pulling: "pulling",
  contact: "contacting",
  contacts: "contacting",
  contacted: "contacting",
  contacting: "contacting",
};

function aggressionVerbToGerund(word: string): string {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (AGGRESSION_GERUND[w]) return AGGRESSION_GERUND[w]!;
  if (/ing$/.test(w)) return w;
  return w;
}

/**
 * BIP topographies are frequently written as semicolon-delimited alternative forms, e.g.
 * "contacting any part of another person's body with foot; headbutts; scratching; pinching;
 * throwing items at a person;". Split those into individual, grammatical single actions so ABC
 * paragraphs cite exactly one observable action (never the whole dump with a trailing semicolon).
 */
function expandSemicolonTopographyList(text: string): string[] | null {
  if (!/;/.test(text)) return null;
  const fragments = text
    .split(/\s*;\s*/)
    .map((f) => f.trim().replace(/[.;]+$/, "").trim())
    .filter(Boolean);
  if (fragments.length < 2) return null;

  const personDirected =
    /\b(?:another person|person['’]s body|the RBT|a person|adult)\b/i.test(text);

  const out: string[] = [];
  for (const raw of fragments) {
    let frag = normalizeBareMeansInPhrase(raw).replace(/\s+/g, " ").trim();
    const words = frag.split(/\s+/);
    const hasTarget =
      /\b(?:person|persons|people|body|rbt|adult|adults|item|items|object|objects|surface|floor|table|wall|material|materials|head|face|arm|arms|leg|legs|hand|hands|hair|another)\b/i.test(
        frag,
      );
    if (words.length <= 2 && !hasTarget) {
      // Bare verb fragment ("headbutts", "scratching") → complete person-directed action.
      const gerund = aggressionVerbToGerund(words[0] ?? "");
      frag = personDirected ? `${gerund} another person` : gerund;
    } else {
      // Ensure the leading verb reads as a gerund ("headbutts another person" → "headbutting …").
      frag = frag.replace(/^([A-Za-z]+)/, (lead) => aggressionVerbToGerund(lead));
    }
    frag = frag.replace(/\s+/g, " ").trim();
    if (frag.length >= 6 && !isIncompleteTopographyAction(frag)) out.push(frag);
  }
  return out.length > 0 ? out : null;
}

/**
 * "contacting … with an open hand, fist, foot, or object" → complete stem+means phrases.
 * Also handles "with an open or closed hand or with an object".
 */
function expandWithMeansAlternatives(text: string): string[] | null {
  const m = text.match(/^(.*?)\bwith\s+(.+)$/i);
  if (!m?.[1] || !m[2]) return null;
  const stem = m[1].trim();
  const meansBlob = m[2].trim();
  if (!/,|(?:\s+or\s+)/i.test(meansBlob)) return null;
  // Require a means-style list (hand/fist/foot/object), not arbitrary "with" clauses.
  if (!/\b(?:hand|fist|foot|object|palm|knuckle)\b/i.test(meansBlob)) return null;

  // "… or with an object" is a second complete with-clause, not a bare means token.
  const withClauses = meansBlob.split(/\s+or\s+with\s+/i);
  const meansParts: string[] = [];
  for (const clause of withClauses) {
    const pairPlaceholders: string[] = [];
    const protectedClause = clause.replace(
      /\b(open|closed|left|right|soft|hard)\s+or\s+(open|closed|left|right|soft|hard)\b/gi,
      (match) => {
        const idx = pairPlaceholders.length;
        pairPlaceholders.push(match);
        return `__ORPAIR${idx}__`;
      },
    );
    const parts = protectedClause
      .split(/\s*,\s*(?:or\s+|and\/or\s+|and\s+)?|\s+and\/or\s+|\s+or\s+/i)
      .map((part) =>
        part
          .replace(/__ORPAIR(\d+)__/g, (_, i) => pairPlaceholders[Number(i)] ?? "")
          .trim(),
      )
      .filter(Boolean);

    for (const part of parts) {
      // Expand "open or closed hand" into concrete means before normalizing.
      const openClosed = part.match(/^(?:an?\s+)?open or closed\s+(hand|fist)$/i);
      if (openClosed) {
        const noun = openClosed[1]!.toLowerCase();
        meansParts.push(`an open ${noun}`, `a closed ${noun}`);
        continue;
      }
      const normalized = normalizeContactMeans(part);
      if (normalized.length >= 4 && !isIncompleteTopographyAction(normalized)) {
        meansParts.push(normalized);
      }
    }
  }

  if (meansParts.length < 2) return null;
  return meansParts.map((means) => `${stem} with ${means}`.replace(/\s+/g, " ").trim());
}

/**
 * "hitting, kicking, pushing, or scratching another person" → one complete action each.
 */
function expandSharedComplementVerbList(text: string): string[] | null {
  const m = text.match(
    /^((?:[A-Za-z][A-Za-z'-]{2,}\s*,\s*)+)(?:or\s+|and\/or\s+|and\s+)?([A-Za-z][A-Za-z'-]{2,})\s+(.+)$/,
  );
  if (!m) return null;
  const head = m[1]!;
  const lastVerb = m[2]!;
  const complement = m[3]!.trim();
  if (!complement || complement.length < 4) return null;
  if (/^(?:to|on|into|from|during|when|while|for|after|before|at)\b/i.test(complement)) {
    return null;
  }
  // Shared complement should look like a target/context, not another action lead.
  if (
    /^(?:flapping|walking|moving|rocking|spinning|pacing|engaging|hitting|kicking)\b/i.test(
      complement,
    )
  ) {
    return null;
  }

  const verbs = [
    ...head.split(/\s*,\s*/).map((v) => v.trim()).filter(Boolean),
    lastVerb.trim(),
  ].filter((v) => /^[A-Za-z][A-Za-z'-]{2,}$/.test(v));

  if (verbs.length < 2) return null;
  if (
    !verbs.every((verb) =>
      /^(?:hit(?:ting)?|kick(?:ing)?|push(?:ing)?|scratch(?:ing)?|bit(?:ing)?|pinch(?:ing)?|slap(?:ping)?|strik(?:e|ing)|grabb?(?:ing)?|pull(?:ing)?|throw(?:ing)?|rip(?:ping)?|tear(?:ing)?|contact(?:ing)?)$/i.test(
        verb,
      ),
    )
  ) {
    return null;
  }
  return verbs.map((verb) => `${verb} ${complement}`.replace(/\s+/g, " ").trim());
}

/**
 * Split a BIP/assessment topography clause that lists several alternative observable actions
 * (e.g. "flapping his hands, side-to-side head movement, walking back and forth, or engaging
 * in the same activity repeatedly") into individual action phrases.
 * Does not split idioms like "back and forth", and does not truncate "open or closed hand".
 */
export function splitTopographyActionAlternatives(text: string): string[] {
  const cleaned = normalizeExampleParenthetical(text.trim().replace(/\s+/g, " "));
  if (!cleaned) return [];

  const semicolonList = expandSemicolonTopographyList(cleaned);
  if (semicolonList) {
    return finalizeActionList(semicolonList);
  }

  const withMeans = expandWithMeansAlternatives(cleaned);
  if (withMeans) {
    return finalizeActionList(
      withMeans.flatMap((action) => expandOpenClosedMeans(action)),
    );
  }

  const verbList = expandSharedComplementVerbList(cleaned);
  if (verbList) {
    return finalizeActionList(verbList);
  }

  // Protect modifier pairs that are not alternative actions ("open or closed hand").
  const pairPlaceholders: string[] = [];
  const protectedText = cleaned.replace(
    /\b(open|closed|left|right|soft|hard)\s+or\s+(open|closed|left|right|soft|hard)\b/gi,
    (match) => {
      const idx = pairPlaceholders.length;
      pairPlaceholders.push(match);
      return `__ORPAIR${idx}__`;
    },
  );

  const primary = protectedText
    .split(/\s*,\s*(?:or\s+|and\/or\s+|and\s+)?|\s+and\/or\s+|\s+or\s+/i)
    .map((part) =>
      part
        .replace(/__ORPAIR(\d+)__/g, (_, i) => pairPlaceholders[Number(i)] ?? "")
        .trim(),
    )
    .filter(Boolean);

  const ACTION_LEAD =
    "(?:flapping|walking|moving|rocking|spinning|pacing|engaging|repeating|waving|clapping|bouncing|jumping|shaking|stomping|crying|screaming|yelling|hitting|kicking|throwing|ripping|pulling|pushing|leaving|sprinting|running|placing|putting|reaching|contacting|contacts|striking|slapping|scratching|pinching)";

  const expanded: string[] = [];
  for (const part of primary) {
    const andSplit = part.split(
      new RegExp(`\\s+and\\s+(?=${ACTION_LEAD}\\b)`, "i"),
    );
    if (andSplit.length > 1) {
      expanded.push(...andSplit.map((s) => s.trim()).filter(Boolean));
    } else {
      expanded.push(part);
    }
  }

  const normalized = expanded.flatMap((raw) => {
    const action = raw
      .replace(/^(?:or|and|and\/or)\s+/i, "")
      .replace(/[.]+$/, "")
      .replace(/^(?:frequently|consistently|repeatedly|continuous(?:ly)?)\s+/i, "")
      .replace(/\s+without\s+interruption\b/gi, "")
      .replace(/\s+,?\s*repetitively\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!action) return [];
    return expandOpenClosedMeans(action);
  });

  return finalizeActionList(normalized);
}

function finalizeActionList(actions: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of actions) {
    const action = normalizeBareMeansInPhrase(raw.replace(/\s+/g, " ").trim()).trim();
    if (
      action.length < 8 &&
      !/^(?:crying|yelling|screaming|kicking|hitting|biting|spitting)$/i.test(action)
    ) {
      continue;
    }
    if (isIncompleteTopographyAction(action)) continue;
    const key = action.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(action);
  }
  return out;
}

/**
 * For ABC narrative, use **one** topography action per segment — not the full BIP alternative list.
 * Multi-hour notes rotate through the listed actions so consecutive hours do not all cite the same one.
 */
export function pickSingleTopographyActionForSegment(
  topography: string,
  segmentIndex: number,
): string {
  const cleaned = topography.trim().replace(/\s+/g, " ");
  const actions = splitTopographyActionAlternatives(cleaned);
  if (actions.length === 0) {
    // Last resort: never return a known-incomplete fragment; fix bare "with foot" grammar.
    const single = normalizeBareMeansInPhrase(cleaned).trim();
    return isIncompleteTopographyAction(single) ? "" : single;
  }
  const idx = ((segmentIndex % actions.length) + actions.length) % actions.length;
  return actions[idx]!;
}

/**
 * Same single-action selection used for frozen SessionContext / assembly, but starting from the raw
 * stored operational definition (including "Defined as … including A, B, or C" frames). Keeps prose
 * validation aligned with what the assembler was allowed to write for that hour.
 */
export function pickStoredTopographyActionForSegment(
  rawTopography: string,
  segmentIndex: number,
): string {
  let text = rawTopography.trim().replace(/\s+/g, " ");
  if (!text || isUnusableStoredTopography(text)) return "";

  const includingMatch = text.match(/\bincluding\s+(.+)$/i);
  if (
    includingMatch?.[1] &&
    /(?:movement pattern|motor (?:behavior|response)|specific (?:actions?|behaviors?|movements?)|the following)\b/i.test(
      text,
    )
  ) {
    text = includingMatch[1].trim();
  }

  text = text
    .replace(/[.!?]+$/, "")
    .replace(
      /^(?:operationally\s+)?(?:characterized by|defined as|definition(?:\s+is)?)\s+/i,
      "",
    )
    .replace(
      /^any\s+(?:instance|episode|incidence|occurrence)\s+(?:in which|when|where|of)\s+/i,
      "",
    )
    .replace(/^when\s+/i, "")
    .replace(/^the client(?!['’]s)\s+/i, "")
    .replace(/^(?:frequently|consistently|repeatedly)\s+/i, "")
    .replace(/\s+,?\s*repetitively\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "";
  return pickSingleTopographyActionForSegment(text, segmentIndex);
}

/**
 * Prefer concrete episode cues already present in other segment fields (application/response) when
 * the topography slot is only a BIP status placeholder.
 */
export function recoverTopographyFromSegmentProse(
  behaviorLabel: string,
  fields: string[],
): string | null {
  const pool = fields.join(" ").replace(/\s+/g, " ").trim();
  if (!pool) return null;
  const b = behaviorLabel.trim().toLowerCase();

  if (/\bclimb/.test(b)) {
    if (/\bone foot on the couch\b/i.test(pool)) {
      return "placing one foot on the couch to reach preferred items";
    }
    if (/\b(?:foot|feet|knee|knees)\b.*\b(?:couch|chair|shelf|furniture|table)\b/i.test(pool) ||
        /\b(?:couch|chair|shelf|furniture)\b.*\b(?:foot|feet|knee|knees|climb)\b/i.test(pool)) {
      return "placing a foot or knees onto furniture to reach preferred items";
    }
  }

  if (/\bstereotyp/.test(b) || /\bstereotypy\b/.test(b)) {
    if (/\b(?:flap|rock|spin|pace|hand(?:s)?\s+near\s+(?:the\s+)?(?:face|eyes)|finger)\b/i.test(pool)) {
      return "engaging in repetitive motor movements with the hands or body away from the presented task materials";
    }
  }

  return null;
}

const TOPOGRAPHY_STOP_WORDS = new Set([
  "that",
  "this",
  "with",
  "from",
  "when",
  "during",
  "client",
  "behavior",
  "without",
  "toward",
  "towards",
  "through",
  "their",
  "there",
  "where",
  "which",
  "while",
  "would",
  "could",
  "should",
  "about",
  "after",
  "before",
  "other",
  "being",
  "have",
  "been",
  "were",
  "will",
  "than",
  "into",
  "upon",
  "such",
  "area",
  "task",
]);

/** Significant tokens from stored profile/BIP topography for overlap checks. */
export function storedTopographyMatchTokens(topography: string): string[] {
  const words =
    topography
      .toLowerCase()
      .match(/\b[a-z][a-z'-]{3,}\b/g) ?? [];
  return [...new Set(words.filter((w) => !TOPOGRAPHY_STOP_WORDS.has(w)))];
}

/** Verb-form variants so BIP "uses"/"sprints" still match assembled "using"/"sprinting". */
function topographyTokenMatchVariants(token: string): string[] {
  const t = token.toLowerCase();
  const out = new Set<string>([t]);
  if (t.endsWith("ing") && t.length > 5) {
    const stem = t.slice(0, -3);
    out.add(stem);
    out.add(`${stem}e`);
    out.add(`${stem}es`);
    out.add(`${stem}s`);
    out.add(`${stem}ed`);
  } else if (t.endsWith("ies") && t.length > 5) {
    out.add(`${t.slice(0, -3)}y`);
    out.add(`${t.slice(0, -3)}ying`);
  } else if (t.endsWith("es") && t.length >= 4) {
    out.add(t.slice(0, -2));
    out.add(t.slice(0, -1));
    out.add(`${t.slice(0, -2)}ing`);
    out.add(`${t.slice(0, -1)}ing`);
  } else if (t.endsWith("ed") && t.length > 4) {
    out.add(t.slice(0, -2));
    out.add(`${t.slice(0, -2)}ing`);
    out.add(t.slice(0, -1));
  } else if (t.endsWith("s") && !t.endsWith("ss") && t.length > 3) {
    out.add(t.slice(0, -1));
    out.add(`${t.slice(0, -1)}ing`);
    out.add(`${t.slice(0, -1)}ed`);
  }
  return [...out].filter((v) => v.length >= 3);
}

export function paragraphReflectsStoredTopography(
  paragraph: string,
  storedTopography: string,
  minimumMatches = 2,
): boolean {
  const tokens = storedTopographyMatchTokens(storedTopography);
  if (tokens.length === 0) return true;
  const p = paragraph.toLowerCase();
  const hits = tokens.filter((t) =>
    topographyTokenMatchVariants(t).some((variant) => p.includes(variant)),
  );
  const required = Math.min(minimumMatches, tokens.length);
  return hits.length >= required;
}

/** Text from "manifested …" through the end of that sentence (behavior topography locus). */
export function manifestedBehaviorSentenceSpan(paragraph: string): string {
  const m = /\bthe client(?:\s+\w+){0,2}\s+manifested\b/i.exec(paragraph);
  if (!m || m.index === undefined) return "";
  const after = paragraph.slice(m.index);
  const dot = after.indexOf(".");
  return dot >= 0 ? after.slice(0, dot + 1) : after;
}

const ELOPEMENT_LEAVING_ACTION_CUES =
  /\b(ran|run|runs|running|left|leave|leaves|leaving|exited|exits|bolted|bolting|sprinted|sprints|sprinting|wandered|wandering|eloped|eloping)\b/i;
const ELOPEMENT_BOUNDARY_CUES =
  /\b(hallway|doorway|door|exit|boundary|beyond|outside|yard|pathway|supervised area|activity area|arm's reach|permission)\b/i;

export function elopementEpisodeLacksObservableTopography(
  paragraph: string,
  assignedBehavior: string,
): boolean {
  if (!isElopementFamilyBehaviorLabel(assignedBehavior)) return false;
  const span = manifestedBehaviorSentenceSpan(paragraph);
  if (!span) return true;
  if (!/\bmanifested\b/i.test(span)) return true;
  const afterManifested = span.replace(/^[\s\S]*?\bmanifested\b/i, "");
  if (afterManifested.trim().length < 20) return true;
  return !(
    ELOPEMENT_LEAVING_ACTION_CUES.test(span) ||
    (/\b(?:moved|moving|walked|walking|approached|approaching|stepped)\b/i.test(span) &&
      ELOPEMENT_BOUNDARY_CUES.test(span))
  );
}
