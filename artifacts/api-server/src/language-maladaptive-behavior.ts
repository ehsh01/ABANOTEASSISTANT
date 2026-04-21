/**
 * Heuristic: BIP labels that imply verbal / language topography for prompt routing
 * (languageMaladaptiveEpisodeForHour in note generation JSON).
 */
const LANGUAGE_LABEL_SUBSTRINGS = [
  "language",
  "profan",
  "curse",
  "cursing",
  "obscen",
  "verbal aggression",
  "maladaptive verbal",
  "inappropriate verbal",
  "sexual verbal",
  "vocal stereotypy",
  "inappropriate vocalization",
  "vocal outburst",
  "echolalia",
  "scripting",
  "perseverative speech",
  "threatening statement",
] as const;

export function isLanguageMaladaptiveBehaviorLabel(label: string): boolean {
  const s = label.trim().toLowerCase();
  if (s.length === 0) return false;
  if (/\bnon[-\s]?verbal\b/.test(s)) return false;
  return LANGUAGE_LABEL_SUBSTRINGS.some((frag) => s.includes(frag));
}
