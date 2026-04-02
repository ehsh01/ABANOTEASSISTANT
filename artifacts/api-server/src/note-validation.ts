/**
 * Post-generation compliance checks for session note clinical bodies and full notes.
 * Complements prompt rules in openai-notes.ts; does not replace clinical judgment by the RBT.
 */

export type NoteComplianceContext = {
  sessionHours: number;
  replacementProgramsInOrder: string[];
  /**
   * Exact replacement program name for each hour (length = sessionHours), cycling `replacementProgramsInOrder`.
   * Clinical body must include this substring verbatim in paragraph h when non-empty.
   */
  replacementProgramForHour: string[];
  /** BIP maladaptive behavior names (exact strings) — used for one-behavior-per-paragraph checks */
  maladaptiveBehaviors: string[];
  /**
   * Exact catalog label assigned to each hour (length = sessionHours), cycling the full client list in order.
   * Used to enforce rotation across all listed behaviors over multi-hour sessions.
   */
  maladaptiveBehaviorForHour: string[];
  /**
   * Optional ABC Builder: per hour, exact activity/antecedent catalog string that must appear verbatim in the paragraph, or null for AI-chosen antecedent.
   */
  activityAntecedentForHour?: (string | null)[] | undefined;
  /** BIP intervention names (exact strings) — used for physical-aggression / Response Block ordering */
  interventions: string[];
  /** Approximate age in years from DOB + session date; null if unknown */
  clientAgeYears: number | null;
  presentPeople: string[];
};

const MENTAL_STATE_PATTERNS: RegExp[] = [
  /\bthe client felt\b/i,
  /\bclient felt\b/i,
  /\bthe client feels\b/i,
  /\bthe client wanted\b/i,
  /\bclient wanted\b/i,
  /\bthe client wants\b/i,
  /\bwas frustrated because\b/i,
  /\bfrustrated because\b/i,
  /\bthe client was trying to\b/i,
  /\bclient was trying to\b/i,
  /\bthe client thought\b/i,
  /\bclient thought\b/i,
  /\bthe client believed\b/i,
  /\bappeared (upset|angry|frustrated|sad|anxious)\b/i,
  /\bseemed (upset|angry|frustrated|sad|anxious)\b/i,
  /\bwas upset because\b/i,
  /\binternal(ly)?\s+(upset|distressed|frustrated)\b/i,
  /\bmust have been\b/i,
  /\bprobably felt\b/i,
];

/** Activities unlikely for very young clients (observable-task framing, not mental state). */
function ageInappropriatePatterns(ageYears: number): RegExp[] {
  if (ageYears < 3) {
    return [
      /\bread(ing)?\s+(a\s+)?(passage|chapter|story|aloud)\b/i,
      /\bwriting\s+(sentences|words|answers|a\s+paragraph)\b/i,
      /\bworksheet\b/i,
      /\bessay\b/i,
      /\bspelling\s+test\b/i,
      /\blong division\b/i,
      /\bhomework\s+assignment\b/i,
    ];
  }
  if (ageYears < 5) {
    return [
      /\bessay\b/i,
      /\bworksheet\s+with\s+written\b/i,
      /\bchapter\s+book\b/i,
      /\breading comprehension\b/i,
    ];
  }
  if (ageYears < 8) {
    return [/\bessay\b/i, /\bresearch\s+project\b/i];
  }
  return [];
}

/**
 * How many distinct catalog strings appear as substrings in a paragraph (longest matched first to reduce nested double-counts).
 * Use for behaviors, replacement programs, or any exact-match catalog list.
 */
export function countDistinctCatalogLabelsInParagraph(paragraph: string, catalog: string[]): number {
  const names = [...new Set(catalog.map((s) => s.trim()).filter((s) => s.length > 0))].sort(
    (a, b) => b.length - a.length,
  );
  if (names.length === 0) return 0;
  let masked = paragraph;
  let count = 0;
  for (const n of names) {
    if (masked.includes(n)) {
      count++;
      masked = masked.split(n).join(" ");
    }
  }
  return count;
}

/** How many distinct catalog behavior names appear in a paragraph. */
export function countCatalogBehaviorsInParagraph(paragraph: string, catalog: string[]): number {
  return countDistinctCatalogLabelsInParagraph(paragraph, catalog);
}

const TODDLER_ATTRIBUTED_SPEECH: RegExp[] = [
  /\bthe client (said|stated|replied|answered|asked|exclaimed|reported|mentioned)\b/i,
  /\bclient (said|stated|replied|answered|asked|exclaimed)\b/i,
  /\bverbally (said|asked|requested|responded|answered|stated)\b/i,
];

/** Tantrum/meltdown wording without nearby observable topography cues. */
function tantrumWithoutTopography(paragraph: string): boolean {
  if (!/\b(tantrum|meltdown)\b/i.test(paragraph)) {
    return false;
  }
  const topographyCue =
    /\b(cried|cry|crying|sob|sobbed|tear|tears|scream|screamed|wail|flop|flopped|floor|dropped|kicked|kicking|threw|throwing|thrown|hit|hitting|slam|slammed|banged|scratch|bit|bite|pushed|pushing|materials|items|toys)\b/i;
  return !topographyCue.test(paragraph);
}

const CAREGIVER_LEXICON =
  /\b(caregiver|caregivers|parent|parents|guardian|guardians|mother|father|mom|dad|mommy|daddy|stepmother|stepfather)\b/i;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Canonical rotation order for common BIP maladaptive behavior names (exact spelling for substring match in assessment text). */
export const STANDARD_MALADAPTIVE_BEHAVIOR_ROTATION_ORDER: readonly string[] = [
  "Physical Aggression",
  "Task Refusal",
  "Property Destruction",
  "SIB",
  "Inappropriate Social Behavior",
  "Bolting",
  "Disruption",
] as const;

function dedupeMaladaptiveBehaviorOrder(catalog: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const raw of catalog) {
    const s = raw.trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    ordered.push(s);
  }
  return ordered;
}

export type MaladaptiveBehaviorsCatalogForRotationResult = {
  /** Labels used for maladaptiveBehaviorForHour + compliance (exact strings for the model). */
  catalog: string[];
  /** Standard-order names found in assessment text but not on the client profile. */
  labelsAddedFromAssessmentText: string[];
  /**
   * Catalog labels whose exact text does not appear verbatim in the stored assessment snapshot (OCR/wording drift).
   * They remain in rotation when listed on the client profile; the RBT should verify BIP wording if this is non-empty.
   */
  labelsOmittedNotFoundInAssessment: string[];
};

/**
 * Build the maladaptive-behavior rotation list:
 * - Order profile entries using STANDARD_MALADAPTIVE_BEHAVIOR_ROTATION_ORDER when names match exactly.
 * - Append other profile labels (custom BIP wording) after that block.
 * - When assessment text is non-empty: add standard names that appear verbatim in the text but were missing from the profile.
 * - **All profile-listed behaviors stay in the catalog** even when the PDF snapshot does not contain that exact substring
 *   (common with OCR, line breaks, or alternate wording). Narrowing to “verbatim in text only” caused notes to repeat the same
 *   few behaviors; rotation must cover the full client/BIP list from the profile plus assessment-detected standards.
 */
export function maladaptiveBehaviorsCatalogForRotation(
  profileBehaviors: string[],
  assessmentTextFull: string,
): MaladaptiveBehaviorsCatalogForRotationResult {
  const profile = dedupeMaladaptiveBehaviorOrder(profileBehaviors);
  const assessment = assessmentTextFull.trim();

  const head = STANDARD_MALADAPTIVE_BEHAVIOR_ROTATION_ORDER.filter((s) => profile.some((p) => p === s));
  const profileRemainder = profile.filter((p) => !head.includes(p));

  const labelsAddedFromAssessmentText: string[] = [];
  if (assessment.length > 0) {
    for (const s of STANDARD_MALADAPTIVE_BEHAVIOR_ROTATION_ORDER) {
      if (assessment.includes(s) && !profile.some((p) => p === s)) {
        labelsAddedFromAssessmentText.push(s);
      }
    }
  }

  const standardBlock = dedupeMaladaptiveBehaviorOrder([...head, ...labelsAddedFromAssessmentText]);

  const catalog = dedupeMaladaptiveBehaviorOrder([...standardBlock, ...profileRemainder]);

  const labelsOmittedNotFoundInAssessment =
    assessment.length > 0 && catalog.length > 0
      ? catalog.filter((c) => !assessment.includes(c))
      : [];

  return {
    catalog,
    labelsAddedFromAssessmentText,
    labelsOmittedNotFoundInAssessment,
  };
}

/** Non-cryptographic hash for rotating which catalog behavior starts hour 0 (variety across regenerations). */
export function hashStringForRotation(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * One assigned behavior label per service hour, cycling `catalog` in order (deduped, first-seen order preserved).
 * Ensures multi-hour notes rotate through the full BIP list before repeating (e.g. all seven behaviors across seven hours).
 * When `rotationSeed` is set, hour 0 starts at a pseudorandom offset into the catalog so the same three labels are not
 * always the first block for short sessions.
 */
export function maladaptiveBehaviorsForSessionHours(
  catalog: string[],
  sessionHours: number,
  rotationSeed?: string,
): string[] {
  const ordered = dedupeMaladaptiveBehaviorOrder(catalog);
  if (sessionHours <= 0) return [];
  if (ordered.length === 0) {
    return Array.from({ length: sessionHours }, () => "");
  }
  const start =
    rotationSeed && rotationSeed.length > 0 ? hashStringForRotation(rotationSeed) % ordered.length : 0;
  return Array.from(
    { length: sessionHours },
    (_, h) => ordered[(start + h) % ordered.length]!,
  );
}

/**
 * One assigned replacement program per service hour, cycling the wizard-ordered list.
 */
export function replacementProgramsForSessionHours(programNames: string[], sessionHours: number): string[] {
  const names = programNames.map((s) => s.trim()).filter((s) => s.length > 0);
  if (sessionHours <= 0) return [];
  if (names.length === 0) {
    return Array.from({ length: sessionHours }, () => "");
  }
  return Array.from({ length: sessionHours }, (_, h) => names[h % names.length]!);
}

/** Catalog label denotes physical aggression (person-directed); match is on the catalog string, not free text. */
function isPhysicalAggressionCatalogLabel(behaviorName: string): boolean {
  return /\bphysical\s+aggression\b/i.test(behaviorName.trim());
}

/** Exact intervention string from the client's list when it is the canonical Response Block label. */
function findResponseBlockInterventionLabel(interventions: string[]): string | null {
  for (const raw of interventions) {
    const s = raw.trim();
    if (s.length > 0 && /^response block$/i.test(s)) {
      return s;
    }
  }
  return null;
}

/** Smallest index in `text` among catalog intervention names that appear; longest names first to reduce substring ambiguity. */
function firstInterventionMentionInText(text: string, interventionNames: string[]): string | null {
  const names = [...new Set(interventionNames.map((s) => s.trim()).filter((s) => s.length > 0))].sort(
    (a, b) => b.length - a.length,
  );
  let bestIdx = Infinity;
  let bestName: string | null = null;
  for (const n of names) {
    const idx = text.indexOf(n);
    if (idx !== -1 && idx < bestIdx) {
      bestIdx = idx;
      bestName = n;
    }
  }
  return bestName;
}

/** First sentence = text up to first ". " (MVP; avoids most abbreviations in our locked prose). */
export function splitFirstSentence(fullNote: string): { first: string; rest: string } {
  const t = fullNote.trim();
  const idx = t.indexOf(". ");
  if (idx === -1) {
    return { first: t, rest: "" };
  }
  return { first: t.slice(0, idx + 1), rest: t.slice(idx + 2) };
}

/**
 * Caregiver / family roles and anyone listed as present must not appear after the note's first sentence.
 */
export function validateCaregiverMentionRule(fullNote: string, presentPeople: string[]): string[] {
  const issues: string[] = [];
  const { first, rest } = splitFirstSentence(fullNote);
  if (!rest.trim()) {
    return issues;
  }

  if (CAREGIVER_LEXICON.test(rest)) {
    issues.push(
      "Caregiver/family role language appears after the first sentence; it must appear only in the opening sentence.",
    );
  }

  for (const name of presentPeople) {
    const n = name.trim();
    if (n.length < 2) continue;
    const re = new RegExp(`\\b${escapeRegExp(n)}\\b`, "i");
    if (re.test(rest)) {
      issues.push(
        `A listed present person ("${n}") appears after the first sentence; caregivers/present people must only appear in the first sentence.`,
      );
    }
  }

  return issues;
}

export function validateClinicalBodyCompliance(clinicalBody: string, ctx: NoteComplianceContext): string[] {
  const issues: string[] = [];

  let mentalHits = 0;
  for (const re of MENTAL_STATE_PATTERNS) {
    if (re.test(clinicalBody)) {
      issues.push(
        `Observational-only rule: remove mental-state / interpretation phrasing (pattern "${re.source.slice(0, 48)}…") — document only observable actions and events.`,
      );
      if (++mentalHits >= 3) {
        break;
      }
    }
  }

  if (ctx.clientAgeYears !== null && ctx.clientAgeYears >= 0) {
    for (const re of ageInappropriatePatterns(ctx.clientAgeYears)) {
      if (re.test(clinicalBody)) {
        issues.push(
          `Age-appropriate activities: narrative may describe tasks unsuitable for approximately ${ctx.clientAgeYears} years old; use toddler/early-childhood activities only when age is low.`,
        );
        break;
      }
    }
  }

  if (ctx.clientAgeYears !== null && ctx.clientAgeYears <= 3) {
    let speechHits = 0;
    for (const re of TODDLER_ATTRIBUTED_SPEECH) {
      if (re.test(clinicalBody)) {
        issues.push(
          `Toddler / limited verbal: for very young clients, minimize complex speech attributed to the client (e.g. avoid "the client said/stated/replied…"); use vocalizations, gestures, and observable actions instead.`,
        );
        if (++speechHits >= 1) {
          break;
        }
      }
    }
  }

  const paragraphs = clinicalBody
    .trim()
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length !== ctx.sessionHours) {
    issues.push(
      `Expected exactly ${ctx.sessionHours} clinical paragraph(s) separated by blank lines; found ${paragraphs.length}.`,
    );
  }

  const programs = ctx.replacementProgramsInOrder.filter((p) => p.trim().length > 0);
  const replacementPerHour = ctx.replacementProgramForHour ?? [];
  const behaviorCatalog = ctx.maladaptiveBehaviors ?? [];

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i]!;
    if (programs.length === 0) {
      continue;
    }
    const progCount = countDistinctCatalogLabelsInParagraph(p, programs);
    if (progCount > 1) {
      issues.push(
        `One program per ABC: paragraph ${i + 1} references more than one distinct replacement program name from the catalog; that hour must name only the assigned program and must not describe or cite a second program from the list.`,
      );
    }
    const assignedRp = replacementPerHour[i]?.trim() ?? "";
    if (assignedRp.length > 0 && !p.includes(assignedRp)) {
      issues.push(
        `Replacement program for hour ${i + 1}: include the assigned program exactly as given (character-for-character, including every "(" and ")"): "${assignedRp}".`,
      );
    }
  }

  const assignedPerHour = ctx.maladaptiveBehaviorForHour ?? [];
  const activityLockedPerHour = ctx.activityAntecedentForHour ?? [];

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i]!;
    const lockedActivity = activityLockedPerHour[i];
    if (typeof lockedActivity === "string" && lockedActivity.length > 0 && !p.includes(lockedActivity)) {
      issues.push(
        `ABC Builder: paragraph ${i + 1} must include the selected activity/antecedent string verbatim (character-for-character): "${lockedActivity.slice(0, 80)}${lockedActivity.length > 80 ? "…" : ""}".`,
      );
      break;
    }
    if (behaviorCatalog.length > 0) {
      const bCount = countCatalogBehaviorsInParagraph(p, behaviorCatalog);
      if (bCount > 1) {
        issues.push(
          `One maladaptive behavior per ABC: paragraph ${i + 1} references more than one behavior name from the client catalog; use exactly one catalog behavior per hour.`,
        );
        break;
      }
    }
    const assigned = assignedPerHour[i]?.trim();
    if (assigned && !p.includes(assigned)) {
      issues.push(
        `Maladaptive behavior rotation: paragraph ${i + 1} must cite the assigned catalog label "${assigned}" (maladaptiveBehaviorForHour[${i}]) verbatim in the manifested-behavior portion.`,
      );
      break;
    }
    if (tantrumWithoutTopography(p)) {
      issues.push(
        `Tantrum topography: paragraph ${i + 1} mentions tantrum/meltdown without enough observable detail; describe what the client did (sounds, movements, materials) consistent with the assessment behavior definitions.`,
      );
      break;
    }
  }

  const responseBlockLabel = findResponseBlockInterventionLabel(ctx.interventions ?? []);
  const paBehaviorLabels = behaviorCatalog.filter(isPhysicalAggressionCatalogLabel);
  if (responseBlockLabel && paBehaviorLabels.length > 0) {
    const interventionList = ctx.interventions ?? [];
    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i]!;
      const citesPa = paBehaviorLabels.some((label) => p.includes(label));
      if (!citesPa) continue;
      const m = /\bto address this behavior\b|\bto address these behaviors\b/i.exec(p);
      if (!m || m.index === undefined) {
        issues.push(
          `Physical aggression: paragraph ${i + 1} cites a physical-aggression catalog behavior; use "To address this behavior" or "To address these behaviors" before consequence interventions.`,
        );
        break;
      }
      const tail = p.slice(m.index);
      const firstNamed = firstInterventionMentionInText(tail, interventionList);
      if (firstNamed !== responseBlockLabel) {
        issues.push(
          `Physical aggression: paragraph ${i + 1} must describe "${responseBlockLabel}" as the first implemented intervention after "To address this behavior" (before other listed interventions such as environmental manipulation).`,
        );
        break;
      }
    }
  }

  if (CAREGIVER_LEXICON.test(clinicalBody)) {
    issues.push(
      "Clinical body must not mention caregivers, parents, or guardians; the fixed opening already covers presence once.",
    );
  }

  for (const name of ctx.presentPeople) {
    const n = name.trim();
    if (n.length < 2) continue;
    const re = new RegExp(`\\b${escapeRegExp(n)}\\b`, "i");
    if (re.test(clinicalBody)) {
      issues.push(
        `Clinical body must not name present people (e.g. "${n}"); only the system opening sentence lists who was present.`,
      );
      break;
    }
  }

  return issues;
}

type Ymd = { y: number; mo: number; d: number };

/** Parse leading yyyy-MM-dd or MM/dd/yyyy (or M/d/yyyy). */
function parseFlexibleYmd(s: string | undefined | null): Ymd | null {
  if (!s?.trim()) return null;
  const t = s.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    return Number.isFinite(y) && Number.isFinite(mo) && Number.isFinite(d) ? { y, mo, d } : null;
  }
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\b/.exec(t);
  if (m) {
    const mo = Number(m[1]);
    const d = Number(m[2]);
    const y = Number(m[3]);
    return Number.isFinite(y) && Number.isFinite(mo) && Number.isFinite(d) ? { y, mo, d } : null;
  }
  return null;
}

/** Approximate whole years between DOB and session date (supports yyyy-MM-dd or MM/dd/yyyy). */
export function approximateAgeYearsAtSession(dateOfBirth: string | undefined | null, sessionDate: string): number | null {
  const dob = parseFlexibleYmd(dateOfBirth);
  const ses = parseFlexibleYmd(sessionDate);
  if (!dob || !ses) return null;
  const { y, mo, d } = dob;
  const { y: sy, mo: smo, d: sd } = ses;
  if ([y, mo, d, sy, smo, sd].some((n) => Number.isNaN(n))) return null;
  let age = sy - y;
  if (smo < mo || (smo === mo && sd < d)) {
    age--;
  }
  return age >= 0 && age < 120 ? age : null;
}
