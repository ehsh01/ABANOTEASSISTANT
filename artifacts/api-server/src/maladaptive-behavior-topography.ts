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
  const m = /\bthe client manifested\b/i.exec(paragraph);
  if (!m || m.index === undefined) return "";
  const after = paragraph.slice(m.index);
  const dot = after.indexOf(".");
  return dot >= 0 ? after.slice(0, dot + 1) : after;
}

const ELOPEMENT_TOPOGRAPHY_CUES =
  /\b(ran|running|run|moved|moving|walked|walking|left|leaving|approached|approaching|hallway|doorway|door|exit|boundary|boundaries|supervised|unsupervised|permission|feet|yard|distance|pathway|hall|bolted|bolting|wandered|wandering|elope|eloped|eloping)\b/i;

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
  return !ELOPEMENT_TOPOGRAPHY_CUES.test(span);
}
