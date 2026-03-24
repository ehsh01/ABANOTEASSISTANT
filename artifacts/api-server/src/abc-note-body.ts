/**
 * Rich ABC narrative assembly (one continuous paragraph per hour).
 * Mirrors structure and specificity of docs/note-generation/SAMPLE-NOTE-REFERENCE.md:
 * concrete antecedents, observable responses, one maladaptive behavior per hour,
 * "these behaviors" / "applied" vs "implemented", alternating replacement-program openings.
 */

export type AbcBodyInput = {
  clientName: string;
  /** From client.profile.gender — drives he/she/they in narrative */
  gender?: string | null;
  sessionHours: number;
  programNames: string[];
  maladaptiveBehaviors: string[];
  interventions: string[];
  hasEnvironmentalChanges: boolean;
  environmentalChanges: string;
  /** When ≤3, template avoids attributed complex speech to the client */
  clientAgeYears?: number | null;
};

function nonEmptyStrings(xs: string[] | undefined | null): string[] {
  return (xs ?? []).map((s) => s.trim()).filter((s) => s.length > 0);
}

function firstName(full: string): string {
  const p = full.trim().split(/\s+/).filter(Boolean);
  return p[0] ?? full;
}

function pronouns(gender: string | null | undefined): {
  Subj: string;
  subj: string;
  pos: string;
  obj: string;
} {
  const g = (gender ?? "").toLowerCase().trim();
  if (g === "male" || g === "m" || g === "boy" || g === "man") {
    return { Subj: "He", subj: "he", pos: "his", obj: "him" };
  }
  if (g === "female" || g === "f" || g === "girl" || g === "woman") {
    return { Subj: "She", subj: "she", pos: "her", obj: "her" };
  }
  return { Subj: "They", subj: "they", pos: "their", obj: "them" };
}

/** Light polish only — preserves BIP intent; fixes common duplicate-acronym typos. */
function polishInterventionLabel(raw: string): string {
  let s = raw.trim().replace(/\s+/g, " ");
  s = s.replace(
    /\bDifferential Reinforcement of Alternative Behaviors?\s+DRA\b/gi,
    "Differential Reinforcement of Alternative Behaviors (DRA)",
  );
  s = s.replace(/\bPremack\s+principle\b/gi, "Premack Principle");
  if (s.length > 0 && s === s.toLowerCase()) {
    s = s.charAt(0).toUpperCase() + s.slice(1);
  }
  return s;
}

function pick<T>(arr: T[], i: number): T {
  if (arr.length === 0) throw new Error("pick: empty array");
  return arr[i % arr.length]!;
}

function addressVerb(intervention: string): "implemented" | "applied" {
  const i = intervention.toLowerCase();
  if (/\bpremack\b/.test(i)) return "applied";
  if (/environmental\s+manipulation/.test(i)) return "applied";
  if (/^redirection$/i.test(i.trim()) || /\bredirection\b/.test(i)) return "applied";
  return "implemented";
}

/** Clause after intervention name — no trailing period. */
function implementationNarrative(
  intervention: string,
  first: string,
  scenarioKey: string,
): string {
  const i = intervention.toLowerCase();
  if (/differential reinforcement|\(dra\)|\bdra\b/.test(i)) {
    return `reinforcing ${first} for brief periods of compliance and appropriate responding during the activity`;
  }
  if (/\bpremack\b/.test(i)) {
    return `by allowing ${first} access to a preferred activity contingent upon completing the requested transition or task step`;
  }
  if (/environmental\s+manipulation/.test(i)) {
    return `by adjusting the immediate environment to reduce competing stimuli and support re-engagement with the task`;
  }
  if (/\bredirection\b/.test(i)) {
    return `by redirecting ${first} back to the designated activity area and calmly re-presenting the demand`;
  }
  if (scenarioKey === "coloringTransition") {
    return `by allowing ${first} access to a preferred activity contingent upon completing the transition to the next task`;
  }
  if (scenarioKey === "freePlayCars") {
    return `reinforcing ${first} for placing materials away when compliance occurred`;
  }
  return `carrying out the procedure with fidelity to the written plan while documenting ${first}'s response`;
}

const REPLACEMENT_BY_DETAILS = [
  "by providing clear, concise directions and systematically increasing wait times before prompts to encourage independent compliance within the expected timeframe",
  "by providing clear transition warnings, offering choices when possible, and reinforcing successful transitions with verbal praise and preferred items",
  "by embedding trials into the natural activity, shaping successive approximations, and delivering reinforcement contingent on correct responding",
  "through systematic prompting, immediate reinforcement for appropriate behavior, and gradual fading of prompts as independence increased",
  "using modeling, error correction, and contingent access to preferred items upon demonstration of the target response",
  "by pairing the target skill with high-probability requests and reinforcing accurate responses during embedded practice trials",
  "through repeated practice opportunities, clear discriminative stimuli, and praise tied to the specific target behavior",
  "by supporting communication attempts, honoring appropriate requests, and reinforcing successive steps toward the terminal goal",
];

function replacementClosing(hourIndex: number, programName: string, byDetail: string): string {
  const lead =
    hourIndex % 2 === 0
      ? "Additionally, the RBT implemented the replacement program"
      : "The RBT implemented the replacement program";
  return `${lead} "${programName}" ${byDetail}`;
}

const GENERIC_INTERVENTION = "the behavior intervention strategy specified in the BIP";

type P = ReturnType<typeof pronouns>;

type ScenarioCtx = {
  first: string;
  p: P;
  behavior: string;
  intervention: string;
  programName: string;
  byDetail: string;
  hourIndex: number;
  scenarioKey: string;
  /** Avoid quoted speech / "stated" when true */
  isToddler: boolean;
};

/** Single-behavior opening (hour 0): one catalog behavior only. */
function paragraphSingleToyBin(ctx: ScenarioCtx): string {
  const { first, p, behavior, intervention, programName, byDetail, hourIndex, isToddler } = ctx;
  const verb = addressVerb(intervention);
  const impl = implementationNarrative(intervention, first, "freePlayCars");
  const responseClause = isToddler
    ? `${p.Subj} responded by throwing several toy cars across the floor, vocalizing loudly, and turning ${p.pos} body away from the RBT`
    : `${p.Subj} responded by throwing several toy cars across the floor and stating, "I don't want to do this," while turning ${p.pos} body away from the RBT`;
  return `Upon arrival, ${first} was engaged in free play with toy cars in the living room. The RBT provided a clear instruction to place the toys in the storage bin. After a pause of approximately 15 seconds, ${first} was prompted to follow the instruction. ${responseClause}. During this activity, ${first} manifested ${behavior} by not complying with the instruction after the initial prompt and disengaging from the presented materials. To address this behavior, the RBT ${verb} ${intervention}, ${impl}. Following this intervention, ${first} exhibited a reduction in ${behavior} and completed the assigned task with additional prompts as needed. ${replacementClosing(hourIndex, programName, byDetail)}`;
}

function paragraphColoringTransition(ctx: ScenarioCtx): string {
  const { first, p, behavior, intervention, programName, byDetail, hourIndex, isToddler: _isToddler } = ctx;
  const verb = addressVerb(intervention);
  const impl = implementationNarrative(intervention, first, "coloringTransition");
  const body = `Later during the session, ${first} was engaged in coloring with markers at the art table when ${p.subj} was informed that coloring time was finished and it was time to transition to a puzzle activity on the floor. Upon this transition demand, ${first} threw multiple markers across the room and knocked over the marker container. This ${behavior} manifested as forcefully throwing multiple markers and overturning the marker container onto the floor. To address this behavior, the RBT ${verb} ${intervention}, ${impl}.`;
  return `${body} Following this intervention, ${first} exhibited a reduction in ${behavior} and participated in the transition. ${replacementClosing(hourIndex, programName, byDetail)}`;
}

function paragraphSnackHandWashing(ctx: ScenarioCtx): string {
  const { first, p, behavior, intervention, programName, byDetail, hourIndex, isToddler: _isToddler } = ctx;
  const verb = addressVerb(intervention);
  const impl = implementationNarrative(intervention, first, "snack");
  const body = `Further into the session, ${first} was seated at the kitchen snack area when the RBT presented a hand-washing routine prior to snack. The RBT gave a step-by-step instruction to walk to the sink and begin washing. After allowing several seconds for independent initiation, ${first} was prompted to start the routine. ${p.Subj} responded by pushing snack items off the placemat and turning away from the sink. During this activity, ${first} manifested ${behavior} by refusing to initiate the routine after the initial prompt and disengaging from the expected sequence. To address this behavior, the RBT ${verb} ${intervention}, ${impl}.`;
  return `${body} Following this intervention, ${first} exhibited a reduction in ${behavior} and completed the hand-washing sequence with prompts as needed. ${replacementClosing(hourIndex, programName, byDetail)}`;
}

function paragraphGrossMotorBall(ctx: ScenarioCtx): string {
  const { first, p, behavior, intervention, programName, byDetail, hourIndex, isToddler: _isToddler } = ctx;
  const verb = addressVerb(intervention);
  const impl = implementationNarrative(intervention, first, "motor");
  return `During a mid-session activity block, ${first} was engaged in gross motor play with a soft ball in an open area of the home. The RBT provided a clear instruction to place the ball in a designated bin to end the activity. Following a brief wait period, ${first} was prompted to follow through. ${p.Subj} responded by kicking the ball toward the hallway and running from the instruction area. During this activity, ${first} manifested ${behavior} by leaving the designated play space and failing to complete the clean-up demand within the expected timeframe. To address this behavior, the RBT ${verb} ${intervention}, ${impl}. Following this intervention, ${first} exhibited a reduction in ${behavior} and returned to the activity area to complete the requested step. ${replacementClosing(hourIndex, programName, byDetail)}`;
}

function paragraphTabletTransition(ctx: ScenarioCtx): string {
  const { first, p, behavior, intervention, programName, byDetail, hourIndex, isToddler: _isToddler } = ctx;
  const verb = addressVerb(intervention);
  const impl = implementationNarrative(intervention, first, "tablet");
  return `In a subsequent portion of the session, ${first} was viewing a short preferred video on a tablet when the RBT signaled that screen time was ending and it was time to move to a tabletop task. Upon this transition demand, ${first} pushed the tablet away sharply and raised ${p.pos} voice in protest. During this activity, ${first} manifested ${behavior} by refusing to close the activity and attempting to retain access to the device after the instruction was given. To address this behavior, the RBT ${verb} ${intervention}, ${impl}. Following this intervention, ${first} exhibited a reduction in ${behavior} and transitioned to the next activity with additional prompts as needed. ${replacementClosing(hourIndex, programName, byDetail)}`;
}

function paragraphBlockCleanup(ctx: ScenarioCtx): string {
  const { first, p, behavior, intervention, programName, byDetail, hourIndex, isToddler } = ctx;
  const verb = addressVerb(intervention);
  const impl = implementationNarrative(intervention, first, "blocks");
  const protestClause = isToddler
    ? `${p.Subj} responded by sweeping blocks off the mat and scattering them across the floor while vocalizing protest`
    : `${p.Subj} responded by sweeping blocks off the mat and scattering them across the floor while stating that ${p.subj} did not want to clean up`;
  return `Earlier in the session, ${first} was building with interlocking blocks on the floor when the RBT directed ${p.obj} to begin cleaning up materials into a storage container. After a pause of approximately ten to fifteen seconds, ${first} was prompted to pick up the first item. ${protestClause}. During this activity, ${first} manifested ${behavior} by not complying with the clean-up instruction after the initial prompt and displacing materials from the work area. To address this behavior, the RBT ${verb} ${intervention}, ${impl}. Following this intervention, ${first} exhibited a reduction in ${behavior} and re-engaged with the clean-up routine. ${replacementClosing(hourIndex, programName, byDetail)}`;
}

function paragraphSocialGame(ctx: ScenarioCtx): string {
  const { first, p, behavior, intervention, programName, byDetail, hourIndex, isToddler: _isToddler } = ctx;
  const verb = addressVerb(intervention);
  const impl = implementationNarrative(intervention, first, "social");
  return `During the latter part of the session, ${first} was participating in a simple turn-taking game with the RBT at the table. The RBT delivered an instruction to wait for a designated cue before taking a turn. Following a short interval for processing the demand, ${first} was prompted to pause before reaching. ${p.Subj} responded by grabbing materials out of turn and turning away from the RBT. During this activity, ${first} manifested ${behavior} by failing to wait for the cue and interfering with the shared materials. To address this behavior, the RBT ${verb} ${intervention}, ${impl}. Following this intervention, ${first} exhibited a reduction in ${behavior} and completed a brief period of appropriate turn-taking. ${replacementClosing(hourIndex, programName, byDetail)}`;
}

function paragraphPretendKitchen(ctx: ScenarioCtx): string {
  const { first, p, behavior, intervention, programName, byDetail, hourIndex, isToddler: _isToddler } = ctx;
  const verb = addressVerb(intervention);
  const impl = implementationNarrative(intervention, first, "pretend");
  return `Following a brief break between activities, ${first} was engaged in pretend play at a toy kitchen when the RBT presented a demand to transition to a tabletop instruction. The RBT stated the expectation clearly and allowed a brief window for independent compliance. After allowing several seconds for independent responding, ${first} was prompted to stand and move to the table. ${p.Subj} responded by knocking play food items to the floor and leaving the play area. During this activity, ${first} manifested ${behavior} by refusing the transition and displacing materials during the demand. To address this behavior, the RBT ${verb} ${intervention}, ${impl}. Following this intervention, ${first} exhibited a reduction in ${behavior} and participated in the transition with prompts. ${replacementClosing(hourIndex, programName, byDetail)}`;
}

function paragraphWorksheetAcademic(ctx: ScenarioCtx): string {
  const { first, p, behavior, intervention, programName, byDetail, hourIndex, isToddler: _isToddler } = ctx;
  const verb = addressVerb(intervention);
  const impl = implementationNarrative(intervention, first, "academic");
  return `During a structured tabletop block, ${first} was seated at a table for structured work with a worksheet and crayons. The RBT provided a specific instruction to complete the next row of items and set a brief work interval. After a pause of approximately ten to fifteen seconds, ${first} was prompted to begin marking the page. ${p.Subj} responded by pushing the paper aside and resting ${p.pos} head on the table. During this activity, ${first} manifested ${behavior} by not initiating the academic response after the prompt and disengaging from the materials. To address this behavior, the RBT ${verb} ${intervention}, ${impl}. Following this intervention, ${first} exhibited a reduction in ${behavior} and completed a short segment of the assigned work. ${replacementClosing(hourIndex, programName, byDetail)}`;
}

const SINGLE_SCENARIO_BUILDERS = [
  paragraphColoringTransition,
  paragraphSnackHandWashing,
  paragraphGrossMotorBall,
  paragraphTabletTransition,
  paragraphBlockCleanup,
  paragraphSocialGame,
  paragraphPretendKitchen,
  paragraphWorksheetAcademic,
];

function paragraphGenericChallenging(ctx: ScenarioCtx): string {
  const { first, p, behavior, intervention, programName, byDetail, hourIndex, isToddler: _isToddler } = ctx;
  const verb = addressVerb(intervention);
  const impl = implementationNarrative(intervention, first, "generic");
  return `During this session segment, ${first} was participating in a structured home-based activity when the RBT delivered a clear instruction related to the task. Following a brief wait period, ${first} was prompted to comply. ${p.Subj} responded by resisting the demand and disengaging from the materials. During this activity, ${first} engaged in challenging behavior, including refusal to follow the instruction after the initial prompt and disengagement from the task materials. To address this behavior, the RBT ${verb} ${intervention}, ${impl}. Following this intervention, ${first} exhibited a reduction in the targeted challenging behavior and re-engaged with the activity. ${replacementClosing(hourIndex, programName, byDetail)}`;
}

export function buildAbcClinicalBody(input: AbcBodyInput): { text: string; warnings: string[] } {
  const warnings: string[] = [];
  const { clientName, sessionHours, hasEnvironmentalChanges, environmentalChanges, gender } = input;

  let behaviors = nonEmptyStrings(input.maladaptiveBehaviors);
  let interventions = nonEmptyStrings(input.interventions).map(polishInterventionLabel);
  const programs = nonEmptyStrings(input.programNames);
  let useGenericBehaviorNarrative = false;

  if (behaviors.length === 0) {
    warnings.push(
      "Client profile has no maladaptive behaviors listed. Narrative uses a generic challenging-behavior description; add BIP-exact behavior names to the client profile.",
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
      "No replacement programs were selected or resolved for this note. Select programs in the wizard or sync profile programs.",
    );
  }

  const first = firstName(clientName);
  const p = pronouns(gender);
  const isToddler =
    input.clientAgeYears !== null &&
    input.clientAgeYears !== undefined &&
    input.clientAgeYears <= 3;
  const parts: string[] = [];

  if (hasEnvironmentalChanges && environmentalChanges.trim().length > 0) {
    parts.push(
      `During the period relevant to this session, the following environmental factors were documented: ${environmentalChanges.trim()}`,
    );
  }

  const programForHour = (hourIndex: number) =>
    programs.length > 0 ? pick(programs, hourIndex) : "replacement targets outlined in the behavior plan";

  let behaviorCursor = 0;
  const nextBehavior = (): string => {
    const b = behaviors[behaviorCursor % behaviors.length]!;
    behaviorCursor++;
    return b;
  };

  for (let h = 0; h < sessionHours; h++) {
    const programName = programForHour(h);
    const byDetail = pick(REPLACEMENT_BY_DETAILS, h);
    const intervention = pick(interventions, h);

    if (useGenericBehaviorNarrative) {
      const ctx: ScenarioCtx = {
        first,
        p,
        behavior: "challenging behavior",
        intervention,
        programName,
        byDetail,
        hourIndex: h,
        scenarioKey: "generic",
        isToddler,
      };
      parts.push(paragraphGenericChallenging(ctx));
      continue;
    }

    /** Hour 0 always uses one catalog behavior only (first in profile list). */
    if (h === 0) {
      const b0 = behaviors[0]!;
      behaviorCursor = 1;
      const ctx: ScenarioCtx = {
        first,
        p,
        behavior: b0,
        intervention,
        programName,
        byDetail,
        hourIndex: h,
        scenarioKey: "freePlayCars",
        isToddler,
      };
      parts.push(paragraphSingleToyBin(ctx));
      continue;
    }

    const behavior = nextBehavior();
    const builder = pick(SINGLE_SCENARIO_BUILDERS, Math.max(0, h - 1));
    const ctx: ScenarioCtx = {
      first,
      p,
      behavior,
      intervention,
      programName,
      byDetail,
      hourIndex: h,
      scenarioKey: "single",
      isToddler,
    };
    parts.push(builder(ctx));
  }

  return { text: parts.join("\n\n"), warnings };
}
