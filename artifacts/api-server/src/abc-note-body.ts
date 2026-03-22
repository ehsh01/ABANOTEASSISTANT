/**
 * Deterministic ABC narrative assembly (one continuous paragraph per hour).
 * Wording patterns follow docs/note-generation/SAMPLE-NOTE-REFERENCE.md and
 * COMPLETE-NOTE-GENERATION-RULES.md. Uses client profile strings verbatim where provided.
 */

export type AbcBodyInput = {
  clientName: string;
  sessionHours: number;
  /** Replacement program names in wizard selection order */
  programNames: string[];
  /** From client.profile — must match BIP in production */
  maladaptiveBehaviors: string[];
  interventions: string[];
  hasEnvironmentalChanges: boolean;
  environmentalChanges: string;
};

function nonEmptyStrings(xs: string[] | undefined | null): string[] {
  return (xs ?? []).map((s) => s.trim()).filter((s) => s.length > 0);
}

function pick<T>(arr: T[], i: number): T {
  if (arr.length === 0) throw new Error("pick: empty array");
  return arr[i % arr.length]!;
}

/** Session-phase openers — vary by hour (sample: "Upon arrival" / "Later during the session"). */
const PHASE_OPENERS = [
  "Upon arrival",
  "Later during the session",
  "Further into the session",
  "During a mid-session activity block",
  "In a subsequent portion of the session",
  "During the latter part of the session",
  "Earlier in the session",
  "Following a brief break between activities",
];

/** Observable antecedent / activity stems (no clinical invention beyond activity type). */
const ACTIVITY_STEMS: ((name: string) => string)[] = [
  (name) => `${name} was engaged in free play with toys in the living room`,
  (name) => `${name} was seated at a table for structured work with visual materials`,
  (name) => `${name} was participating in a transition from a preferred activity to a non-preferred task`,
  (name) => `${name} was working on a daily living routine with caregiver support nearby`,
  (name) => `${name} was at a table completing a fine-motor coloring activity`,
  (name) => `${name} was engaged in gross motor play in an open area of the home`,
  (name) => `${name} was presented with a compliance task involving clean-up of play materials`,
  (name) => `${name} was participating in a simple social turn-taking activity with the RBT`,
];

const DEMANDS = [
  "The RBT provided a clear, single-step instruction aligned with the session targets.",
  "The RBT delivered a specific demand related to the ongoing activity and waited for a response.",
  "The RBT presented a transition-related instruction and allowed a brief window for independent compliance.",
  "The RBT gave a concise instruction to initiate the next step of the task.",
  "The RBT restated the expectation and signaled that it was time to begin the requested task.",
];

const PAUSE_PHRASES = [
  "After a pause of approximately ten to fifteen seconds",
  "Following a brief wait period",
  "After allowing several seconds for independent responding",
  "Following a short interval for processing the demand",
];

const RESPONSE_LEADS = [
  "The client responded with visible noncompliance, resisting the demand and disengaging from the materials.",
  "The client responded by resisting the instruction and moving away from the designated activity area.",
  "The client responded by refusing to initiate the task and verbally protesting the demand.",
  "The client responded by engaging in escape-oriented behavior and failing to follow the instruction after the initial prompt.",
];

/** Follows "manifested [BEHAVIOR] by ..." */
const TOPOGRAPHY_BY_PHRASES = [
  "not complying with the instruction after the initial prompt and disengaging from the presented materials",
  "turning away from the task, verbally protesting, and failing to initiate the requested response",
  "leaving the work area and failing to complete the requested step within the expected timeframe",
  "repeatedly avoiding the demand and requiring additional prompts to re-orient to the task",
];

/** Used when profile has no behavior names — "engaged in challenging behavior, including ..." */
const CHALLENGING_TOPO = [
  "refusal to follow the instruction after the initial prompt and disengagement from the task materials",
  "vocal protest, turning away from materials, and failure to initiate the requested response",
  "moving away from the designated activity area prior to task completion",
];

const INTERVENTION_IMPLEMENTATIONS = [
  "applying the procedure with fidelity to the written plan and documenting the client's response.",
  "delivering the strategy in a calm, consistent manner while maintaining session structure and safety.",
  "implementing the strategy as written and shaping opportunities for appropriate responding.",
  "following the prescribed steps and pairing the intervention with clear expectations and reinforcement for appropriate behavior.",
];

const OUTCOME_SUFFIXES = [
  "completed the requested step and re-engaged with the activity.",
  "returned to the activity area and participated in the next instructional opportunity.",
  "demonstrated improved compliance with the demand and resumed participation in the session.",
  "reduced the targeted response and followed the next instruction with caregiver and RBT support as needed.",
];

const REPLACEMENT_BY_PHRASES = [
  "using prompting, modeling, and reinforcement schedules consistent with the behavior plan.",
  "through repeated practice, errorless prompts where appropriate, and contingent reinforcement for correct responding.",
  "by embedding trials into the natural activity and reinforcing successive approximations toward the terminal goal.",
  "through clear discriminative stimuli, systematic prompting, and immediate reinforcement for appropriate behavior.",
];

const GENERIC_INTERVENTION = "the behavior intervention strategy specified in the BIP";

/**
 * Builds the clinical body: optional env paragraph, then one ABC paragraph per hour (no markdown headings).
 */
export function buildAbcClinicalBody(input: AbcBodyInput): { text: string; warnings: string[] } {
  const warnings: string[] = [];
  const { clientName, sessionHours, hasEnvironmentalChanges, environmentalChanges } = input;

  let behaviors = nonEmptyStrings(input.maladaptiveBehaviors);
  let interventions = nonEmptyStrings(input.interventions);
  const programs = nonEmptyStrings(input.programNames);
  let useGenericBehaviorNarrative = false;

  if (behaviors.length === 0) {
    warnings.push(
      "Client profile has no maladaptive behaviors listed. Narrative describes challenging behavior without a named BIP label; add BIP-exact behavior names to the client profile for compliant notes.",
    );
    useGenericBehaviorNarrative = true;
    behaviors = ["challenging behavior"];
  }
  if (interventions.length === 0) {
    warnings.push(
      "Client profile has no interventions listed. Narrative uses a generic BIP reference; add BIP-exact intervention names to the client profile.",
    );
    interventions = [GENERIC_INTERVENTION];
  }
  if (programs.length === 0) {
    warnings.push(
      "No replacement programs were selected or resolved for this note. ABC text references the behavior plan only; select programs in the wizard or sync profile programs.",
    );
  }

  const parts: string[] = [];

  if (hasEnvironmentalChanges && environmentalChanges.trim().length > 0) {
    parts.push(
      `During the period relevant to this session, the following environmental factors were documented: ${environmentalChanges.trim()}`,
    );
  }

  const programForHour = (hourIndex: number) =>
    programs.length > 0 ? pick(programs, hourIndex) : "replacement targets outlined in the behavior plan";

  for (let h = 0; h < sessionHours; h++) {
    const phase = pick(PHASE_OPENERS, h);
    const activity = pick(ACTIVITY_STEMS, h)(clientName);
    const demand = pick(DEMANDS, h);
    const pause = pick(PAUSE_PHRASES, h);
    const responseLead = pick(RESPONSE_LEADS, h);
    const topoBy = pick(TOPOGRAPHY_BY_PHRASES, h);
    const challengingTopo = pick(CHALLENGING_TOPO, h);
    const behavior = pick(behaviors, h);
    const intervention = pick(interventions, h);
    const impl = pick(INTERVENTION_IMPLEMENTATIONS, h);
    const outcome = pick(OUTCOME_SUFFIXES, h);
    const byPhrase = pick(REPLACEMENT_BY_PHRASES, h);
    const programName = programForHour(h);

    const behaviorClause = useGenericBehaviorNarrative
      ? `During this activity, ${clientName} engaged in challenging behavior, including ${challengingTopo}.`
      : `During this activity, ${clientName} manifested ${behavior} by ${topoBy}.`;

    const reductionPhrase = useGenericBehaviorNarrative
      ? "exhibited a reduction in the targeted challenging behavior"
      : `exhibited a reduction in ${behavior}`;

    const paragraph = `${phase}, ${activity}. ${demand} ${pause}, ${clientName} was prompted to follow through. ${responseLead} ${behaviorClause} To address this behavior, the RBT implemented ${intervention}, ${impl} Following this intervention, ${clientName} ${reductionPhrase} and ${outcome}. Additionally, the RBT implemented the replacement program "${programName}" ${byPhrase}`;

    parts.push(paragraph);
  }

  return { text: parts.join("\n\n"), warnings };
}
