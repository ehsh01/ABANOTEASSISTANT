/**
 * Reinforcement-preference helpers for session notes.
 *
 * - Prefer concrete toy/item names over the umbrella "Preferred toys".
 * - Never use YouTube as a reinforcer/activity when the client is under 14.
 */

export const YOUTUBE_MIN_AGE_YEARS = 14;

const YOUTUBE_TOKEN_RE = /\byou\s*tube\b/i;

/** Preference (or prose) that refers to YouTube. */
export function mentionsYouTube(text: string): boolean {
  return YOUTUBE_TOKEN_RE.test(text);
}

export function isYouTubePreference(name: string): boolean {
  return mentionsYouTube(name);
}

/** When DOB/age is known and under 14, YouTube must not appear as a reinforcer or activity. */
export function isYouTubeBannedForAge(clientAgeYears: number | null | undefined): boolean {
  return clientAgeYears != null && clientAgeYears >= 0 && clientAgeYears < YOUTUBE_MIN_AGE_YEARS;
}

function normalizePreferenceLabel(raw: string): string {
  return raw
    .trim()
    .replace(/^[\s,;:([]+/g, "")
    .replace(/[\s,;:)\]]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** People / family roles are never valid tangible reinforcers. */
function isPersonRolePreference(name: string): boolean {
  const n = normalizePreferenceLabel(name).toLowerCase();
  if (!n) return false;
  if (
    /^(?:the\s+)?(?:caregiver|caregivers|parents?|guardians?|mother|father|mom|dad|mommy|daddy|stepmother|stepfather|grandmother|grandfather|grandma|grandpa|aunt|uncle|cousin|siblings?|brother|sister|(?:maternal|paternal)\s+(?:uncle|aunt|grandmother|grandfather)|family members?)$/i.test(
      n,
    )
  ) {
    return true;
  }
  if (
    /^(?:mother|father|mom|dad|caregiver|parent|guardian)(?:\s*\/\s*(?:mother|father|mom|dad|caregiver|parent|guardian))+$/i.test(
      n,
    )
  ) {
    return true;
  }
  if (/^(?:hugs?|kisses?)\b/i.test(n)) return true;
  if (/\b(?:mother'?s|father'?s|mom'?s|dad'?s|caregiver'?s)\s+phone\b/i.test(n)) return true;
  return false;
}

/**
 * Raw BIP section dumps ("Food: snacks…", "Tangibles: electronics such as tablet and mother's phone…")
 * must not be pasted verbatim into the locked closing. When possible, expand into short concrete items.
 */
function isBipReinforcerDumpLine(name: string): boolean {
  const n = name.trim();
  if (!n) return false;
  if (/^(?:food|edibles?|tangibles?|items?|activities?|attention|social|toys?)\s*:/i.test(n)) {
    return true;
  }
  // Long narrative preference sentences (e.g. "…; he doesn't like sweets.")
  if (
    n.length > 80 ||
    /\bdoesn[''\u2019]?t\s+like\b/i.test(n) ||
    /;\s*he\b/i.test(n) ||
    /^he\s+doesn/i.test(n)
  ) {
    return true;
  }
  return false;
}

/**
 * Expand BIP dump lines into short concrete reinforcer labels when possible.
 * Returns [] when nothing concrete can be recovered.
 */
function expandBipReinforcerDump(name: string): string[] {
  const n = name.trim();
  if (!n) return [];

  // "Food: snacks, yogurt, cereal, pop start; he doesn't like sweets."
  const foodMatch = n.match(/^food\s*:\s*(.+)$/i);
  if (foodMatch?.[1]) {
    return foodMatch[1]
      .split(/[,;]/)
      .map((part) =>
        part
          .replace(/\bhe\s+doesn[''\u2019]?t\s+like\b.*$/i, "")
          .replace(/\bdoesn[''\u2019]?t\s+like\b.*$/i, "")
          .trim(),
      )
      .filter(
        (part) =>
          part.length >= 2 &&
          part.length <= 40 &&
          !/^he\b/i.test(part) &&
          !/\bdoesn[''\u2019]?t\s+like\b/i.test(part) &&
          // Drop OCR/garbled tokens (e.g. "pop start") rather than inventing a brand name.
          !/\bpop\s+start\b/i.test(part),
      );
  }

  // "Tangibles: electronics such as tablet and mother's phone; toys such as animals, sensory toys, or any spinning toy."
  const tangibleMatch = n.match(/^tangibles?\s*:\s*(.+)$/i);
  if (tangibleMatch?.[1]) {
    const body = tangibleMatch[1];
    const found: string[] = [];
    for (const candidate of [
      "tablet",
      "sensory toys",
      "spinning toy",
      "spinning toys",
      "animals",
      "animal toys",
    ]) {
      if (new RegExp(`\\b${candidate.replace(/\s+/g, "\\s+")}\\b`, "i").test(body)) {
        found.push(candidate === "animals" ? "animal toys" : candidate);
      }
    }
    return found;
  }

  return [];
}

const GENERIC_PREFERRED_TOYS_RE = /^preferred\s+toys?$/i;
const GENERIC_PREFERRED_ACTIVITY_OR_ITEM_RE =
  /^preferred\s+(?:activities|activity|items?|item|tangibles?)$/i;

export function isGenericPreferredToysLabel(name: string): boolean {
  return GENERIC_PREFERRED_TOYS_RE.test(name.trim());
}

/**
 * Concrete toy / toy-like preference suitable when the note describes giving a toy.
 * Excludes the umbrella label "Preferred toys".
 */
export function isConcreteToyPreference(name: string): boolean {
  const n = name.trim();
  if (!n || isGenericPreferredToysLabel(n) || isYouTubePreference(n)) return false;
  if (isPersonRolePreference(n)) return false;
  if (GENERIC_PREFERRED_ACTIVITY_OR_ITEM_RE.test(n)) return false;
  return /\b(?:toys?|dolls?|balls?|blocks?|legos?|puzzles?|figures?|cars?|bubbles?|sensory|spinning|plush|stuffed|musical\s+toy|shape\s+sorter|stacking\s+rings?)\b/i.test(
    n,
  );
}

export function concreteToyPreferences(prefs: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of prefs) {
    const t = raw.trim();
    if (!t || !isConcreteToyPreference(t)) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/**
 * Preferences safe to surface in the model context and locked closing for this client/session.
 * Drops caregiver role labels, YouTube when age < 14, and umbrella "Preferred toys" when
 * more specific toy prefs are available.
 */
export function filterReinforcementPreferencesForNote(
  prefs: string[] | null | undefined,
  options?: { clientAgeYears?: number | null },
): string[] {
  const age = options?.clientAgeYears ?? null;
  const youtubeBanned = isYouTubeBannedForAge(age);
  const expanded: string[] = [];
  for (const raw of prefs ?? []) {
    const p = raw.trim();
    if (!p) continue;
    if (isPersonRolePreference(p)) continue;
    if (youtubeBanned && isYouTubePreference(p)) continue;
    if (isBipReinforcerDumpLine(p)) {
      expanded.push(...expandBipReinforcerDump(p));
      continue;
    }
    expanded.push(p);
  }
  const cleaned = [...new Set(expanded.map((s) => s.trim()).filter(Boolean))].filter((p) => {
    if (isPersonRolePreference(p)) return false;
    if (youtubeBanned && isYouTubePreference(p)) return false;
    if (isBipReinforcerDumpLine(p)) return false;
    // OCR/garbled tokens that must never reach the locked closing (standalone or mid-list).
    if (/\bpop\s+start\b/i.test(p)) return false;
    if (/\b(?:mother|father|mom|dad|caregiver)(?:'s|’s)?\s+phone\b/i.test(p)) return false;
    return true;
  });
  const concreteToys = concreteToyPreferences(cleaned);
  if (concreteToys.length === 0) {
    return cleaned;
  }
  return cleaned.filter((p) => !isGenericPreferredToysLabel(p));
}

const GENERIC_PREFERRED_TOY_IN_PROSE_RE = /\b(?:a\s+|the\s+)?preferred\s+toys?\b/gi;

const CONCRETE_TOY_MODIFIER_BEFORE_TOYS_RE =
  /\b(?:sensory|spinning|musical|disney|stuffed|plush|soft|preferred)\s+toys?\b/i;

const NAMED_TOY_ITEM_IN_SPAN_RE =
  /\b(?:balls?|dolls?|blocks?|legos?|puzzles?|figures?|cars?|bubbles?|shape\s+sorter|stacking\s+rings?)\b/i;

/**
 * True when prose delivers an unspecified toy ("preferred toys", "a toy", bare "toys")
 * rather than a concrete named kind (e.g. sensory toys, spinning toys).
 */
export function clinicalBodyHasUnspecifiedToyDelivery(text: string): boolean {
  if (/\b(?:a\s+|the\s+)?preferred\s+toys?\b/i.test(text)) return true;
  const deliveryRe =
    /\b(?:delivered|provided|gave|giving|offered|presented|returned|earned|access(?:ed)? to)\b[^.!?]{0,60}?\b(?:a\s+|the\s+)?toys?\b/gi;
  let match: RegExpExecArray | null;
  while ((match = deliveryRe.exec(text)) !== null) {
    const span = match[0];
    if (CONCRETE_TOY_MODIFIER_BEFORE_TOYS_RE.test(span)) continue;
    if (NAMED_TOY_ITEM_IN_SPAN_RE.test(span)) continue;
    return true;
  }
  return false;
}

export function clinicalBodyNamesConcreteToy(text: string, concreteToys: string[]): boolean {
  return concreteToys.some((toy) => text.toLowerCase().includes(toy.toLowerCase()));
}

/**
 * Rewrite narrative reinforcer wording:
 * - under 14: remove YouTube references (swap in another allowed preference when possible)
 * - replace umbrella "preferred toy(s)" with a concrete toy preference when one is on file
 */
export function sanitizeReinforcerNarrativeText(
  text: string,
  prefs: string[],
  clientAgeYears: number | null | undefined,
): string {
  const filtered = filterReinforcementPreferencesForNote(prefs, { clientAgeYears });
  const concreteToys = concreteToyPreferences(filtered);
  const fallbackToy = concreteToys[0] ?? null;
  const nonYouTubeFallback =
    filtered.find((p) => !isYouTubePreference(p) && !isGenericPreferredToysLabel(p) && !isPraiseLike(p)) ??
    null;

  let out = text;

  if (isYouTubeBannedForAge(clientAgeYears) && mentionsYouTube(out)) {
    const replacement = nonYouTubeFallback ?? "a preferred activity documented for this client";
    out = out
      .replace(/\baccess to\s+YouTube(?:\s+videos?)?\b/gi, `access to ${replacement}`)
      .replace(/\bwatching\s+YouTube(?:\s+videos?)?\b/gi, `engaging with ${replacement}`)
      .replace(/\bYouTube(?:\s+videos?)?\b/gi, replacement)
      // Preserve blank-line ABC paragraph separators (\n\n); only collapse horizontal whitespace.
      .replace(/[^\S\n]{2,}/g, " ")
      .trim();
  }

  if (fallbackToy && clinicalBodyHasUnspecifiedToyDelivery(out)) {
    out = out
      .replace(GENERIC_PREFERRED_TOY_IN_PROSE_RE, fallbackToy)
      .replace(
        /\b((?:delivered|provided|gave|giving|offered|presented|returned|earned)\b[^.!?\n]{0,80}?)\s+(?:a\s+|the\s+)?toys?\b/gi,
        `$1 ${fallbackToy}`,
      )
      .replace(/\baccess to\s+(?:a\s+|the\s+)?toys?\b/gi, `access to ${fallbackToy}`)
      .replace(/[^\S\n]{2,}/g, " ")
      .trim();
  }

  return out;
}

function isPraiseLike(name: string): boolean {
  const n = name.trim().toLowerCase();
  return (
    /^(social )?praise$/.test(n) ||
    /^verbal praise$/.test(n) ||
    /^behavior-specific praise$/.test(n) ||
    /^contingent praise$/.test(n)
  );
}
