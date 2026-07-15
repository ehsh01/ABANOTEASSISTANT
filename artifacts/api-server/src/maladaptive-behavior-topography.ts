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
