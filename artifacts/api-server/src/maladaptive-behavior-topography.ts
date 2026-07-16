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
  if (/\bclimb/.test(b)) {
    return "placing a foot or knees on furniture or elevated surfaces to reach preferred items";
  }
  if (/\bstereotyp/.test(b) || /\bstereotypy\b/.test(b) || /\brepetitive\s+motor\b/.test(b)) {
    return "engaging in repetitive motor movements with the hands unrelated to the presented task";
  }
  if (/\bproperty\s+destruction\b/.test(b)) {
    return "throwing or knocking session materials from the work surface";
  }
  if (/\bexcessive\s+motor\b/.test(b)) {
    return "flapping hands near the work materials";
  }
  if (/\bphysical\s+aggression\b/.test(b)) {
    return "contacting another person's body with an open hand";
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
  return verbs.map((verb) => `${verb} ${complement}`.replace(/\s+/g, " ").trim());
}

/**
 * Split a BIP/assessment topography clause that lists several alternative observable actions
 * (e.g. "flapping his hands, side-to-side head movement, walking back and forth, or engaging
 * in the same activity repeatedly") into individual action phrases.
 * Does not split idioms like "back and forth", and does not truncate "open or closed hand".
 */
export function splitTopographyActionAlternatives(text: string): string[] {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (!cleaned) return [];

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
    const action = raw.replace(/\s+/g, " ").trim();
    if (action.length < 8) continue;
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
    // Last resort: never return a known-incomplete fragment.
    return isIncompleteTopographyAction(cleaned) ? "" : cleaned;
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

export function paragraphReflectsStoredTopography(
  paragraph: string,
  storedTopography: string,
  minimumMatches = 2,
): boolean {
  const tokens = storedTopographyMatchTokens(storedTopography);
  if (tokens.length === 0) return true;
  const p = paragraph.toLowerCase();
  const hits = tokens.filter((t) => p.includes(t));
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
