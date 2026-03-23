/**
 * Post-generation compliance checks for session note clinical bodies and full notes.
 * Complements prompt rules in openai-notes.ts; does not replace clinical judgment by the RBT.
 */

export type NoteComplianceContext = {
  sessionHours: number;
  replacementProgramsInOrder: string[];
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

const CAREGIVER_LEXICON =
  /\b(caregiver|caregivers|parent|parents|guardian|guardians|mother|father|mom|dad|mommy|daddy|stepmother|stepfather)\b/i;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i]!;
    let hitCount = 0;
    for (const prog of programs) {
      if (p.includes(prog)) {
        hitCount++;
      }
    }
    if (hitCount > 1) {
      issues.push(
        `One program per ABC: paragraph ${i + 1} references more than one replacement program name; keep exactly one program in that hour's narrative.`,
      );
      break;
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

/** Approximate whole years between DOB and session date (yyyy-MM-dd). */
export function approximateAgeYearsAtSession(dateOfBirth: string | undefined | null, sessionDate: string): number | null {
  if (!dateOfBirth?.trim()) return null;
  const dobM = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOfBirth.trim());
  const sesM = /^(\d{4})-(\d{2})-(\d{2})/.exec(sessionDate.trim());
  if (!dobM || !sesM) return null;
  const y = Number(dobM[1]);
  const mo = Number(dobM[2]);
  const d = Number(dobM[3]);
  const sy = Number(sesM[1]);
  const smo = Number(sesM[2]);
  const sd = Number(sesM[3]);
  if ([y, mo, d, sy, smo, sd].some((n) => Number.isNaN(n))) return null;
  let age = sy - y;
  if (smo < mo || (smo === mo && sd < d)) {
    age--;
  }
  return age >= 0 && age < 120 ? age : null;
}
