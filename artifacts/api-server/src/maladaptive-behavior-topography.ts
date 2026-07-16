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
  return null;
}

/**
 * Split a BIP/assessment topography clause that lists several alternative observable actions
 * (e.g. "flapping his hands, side-to-side head movement, walking back and forth, or engaging
 * in the same activity repeatedly") into individual action phrases.
 * Does not split idioms like "back and forth".
 */
export function splitTopographyActionAlternatives(text: string): string[] {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (!cleaned) return [];

  const primary = cleaned
    .split(/\s*,\s*(?:or\s+|and\/or\s+|and\s+)?|\s+and\/or\s+|\s+or\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  const ACTION_LEAD =
    "(?:flapping|walking|moving|rocking|spinning|pacing|engaging|repeating|waving|clapping|bouncing|jumping|shaking|stomping|crying|screaming|yelling|hitting|kicking|throwing|ripping|pulling|pushing|leaving|sprinting|running|placing|putting|reaching)";

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

  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of expanded) {
    const action = raw
      .replace(/^(?:or|and|and\/or)\s+/i, "")
      .replace(/[.]+$/, "")
      .replace(/^(?:frequently|consistently|repeatedly|continuous(?:ly)?)\s+/i, "")
      .replace(/\s+without\s+interruption\b/gi, "")
      .replace(/\s+,?\s*repetitively\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    if (action.length < 8) continue;
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
  const actions = splitTopographyActionAlternatives(topography);
  if (actions.length <= 1) {
    return topography.trim().replace(/\s+/g, " ");
  }
  const idx = ((segmentIndex % actions.length) + actions.length) % actions.length;
  return actions[idx]!;
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
