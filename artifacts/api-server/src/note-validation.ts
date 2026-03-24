/**
 * Post-generation compliance checks for session note clinical bodies and full notes.
 * Complements prompt rules in openai-notes.ts; does not replace clinical judgment by the RBT.
 */

export type NoteComplianceContext = {
  sessionHours: number;
  replacementProgramsInOrder: string[];
  /** BIP maladaptive behavior names (exact strings) — used for one-behavior-per-paragraph checks */
  maladaptiveBehaviors: string[];
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

/** How many distinct catalog behavior names appear in a paragraph (longest names matched first to reduce substring double-counts). */
export function countCatalogBehaviorsInParagraph(paragraph: string, catalog: string[]): number {
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
  const behaviorCatalog = ctx.maladaptiveBehaviors ?? [];

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

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i]!;
    if (behaviorCatalog.length > 0) {
      const bCount = countCatalogBehaviorsInParagraph(p, behaviorCatalog);
      if (bCount > 1) {
        issues.push(
          `One maladaptive behavior per ABC: paragraph ${i + 1} references more than one behavior name from the client catalog; use exactly one catalog behavior per hour.`,
        );
        break;
      }
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
