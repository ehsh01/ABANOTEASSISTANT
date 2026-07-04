import { describe, expect, test } from "vitest";
import {
  classifyComplianceIssues,
  isCriticalComplianceIssue,
  validateClinicalBodyCompliance,
  type NoteComplianceContext,
} from "./note-validation";
import {
  injectMissingAttentionNcrIntervention,
  injectMissingSafetyChainFunctionIntervention,
} from "./safety-chain-enforcement";

const SIB = "Self-Injurious Behavior (SIB)";
const DRA = "Differential Reinforcement of Alternative Behavior (DRA)";
const INTERVENTIONS = ["Response Blocking", DRA, "Attention independent response delivery", "Compliance Training"];

/** Real reviewer failure case: RB named alone for attention-maintained SIB (Anthony's note). */
const ANTHONY_SIB_PARAGRAPH = `Later at the table, the RBT arranged a card-sorting task by placing a stack of cards and sorting trays within reach and delivered a clear instruction to continue sorting. During this activity, the client manifested Self-Injurious Behavior (SIB) by striking his head with an open hand and squeezing his forearms repeatedly. To address this behavior, the RBT immediately implemented Response blocking. Following this intervention, the RBT blocked further contact with the client's head and arms and maintained neutral attention while repositioning the materials in front of him. Once the client's hands were down and oriented toward the task, the RBT delivered brief verbal praise and re-presented the instruction to continue sorting. The RBT implemented the replacement program "Compliance Training" by delivering one-step instructions and using a prompt hierarchy to support task completion; criterion was met on approximately 20% of discrete trials.`;

function sibCtx(overrides: Partial<NoteComplianceContext> = {}): NoteComplianceContext {
  return {
    sessionHours: 1,
    narrativeSegmentCount: 1,
    replacementProgramsInOrder: ["Compliance Training"],
    replacementProgramForHour: ["Compliance Training"],
    maladaptiveBehaviors: [SIB],
    maladaptiveBehaviorForHour: [SIB],
    maladaptiveBehaviorFunctionsForHour: [["attention"]],
    interventions: INTERVENTIONS,
    clientAgeYears: 6,
    presentPeople: ["Mother"],
    ...overrides,
  };
}

describe("safety chain validation (attention-maintained SIB)", () => {
  test("Response Block alone is flagged even with lowercase 'blocking'", () => {
    const issues = validateClinicalBodyCompliance(ANTHONY_SIB_PARAGRAPH, sibCtx());
    const safetyIssues = issues.filter((i) =>
      /^(SIB attention function|SIB response blocking|Safety chain function match):/.test(i),
    );
    expect(safetyIssues.length).toBeGreaterThan(0);
  });

  test("safety-chain issues classify as critical", () => {
    const issues = validateClinicalBodyCompliance(ANTHONY_SIB_PARAGRAPH, sibCtx());
    const { critical } = classifyComplianceIssues(issues);
    expect(
      critical.some((i) =>
        /^(SIB attention function|SIB response blocking|Safety chain function match):/.test(i),
      ),
    ).toBe(true);
  });

  test("deterministic injection resolves the missing-DRA safety-chain issue", () => {
    const injected = injectMissingSafetyChainFunctionIntervention(ANTHONY_SIB_PARAGRAPH, {
      narrativeSegmentCount: 1,
      maladaptiveBehaviorForHour: [SIB],
      acquisitionOnlySegmentForHour: [false],
      interventions: INTERVENTIONS,
      maladaptiveBehaviorFunctionsForHour: [["attention"]],
      interventionCandidatesForHour: [[DRA]],
    });
    const issues = validateClinicalBodyCompliance(injected, sibCtx());
    const safetyIssues = issues.filter((i) =>
      /^(SIB attention function|SIB response blocking|Safety chain function match):/.test(i),
    );
    expect(safetyIssues).toEqual([]);
  });
});

describe("subjective wording", () => {
  test("value words like 'became upset' are rejected", () => {
    const body = ANTHONY_SIB_PARAGRAPH.replace(
      "the client manifested Self-Injurious Behavior (SIB) by striking his head",
      "the client became upset and manifested Self-Injurious Behavior (SIB) by striking his head",
    );
    const issues = validateClinicalBodyCompliance(body, sibCtx());
    expect(issues.some((i) => i.startsWith("Subjective wording:"))).toBe(true);
  });

  test("observable topography alone is not flagged as subjective", () => {
    const issues = validateClinicalBodyCompliance(ANTHONY_SIB_PARAGRAPH, sibCtx());
    expect(issues.some((i) => i.startsWith("Subjective wording:"))).toBe(false);
  });

  test("missing NCR for attention-maintained SIB raises a (non-blocking) Attention NCR warning", () => {
    // RB + DRA present but no NCR, even though NCR is on the approved list.
    const withDra = `${ANTHONY_SIB_PARAGRAPH} The RBT implemented Differential Reinforcement of Alternative Behavior (DRA). Following this intervention, attention was withheld during the maladaptive response and brief praise was delivered when the client displayed compatible behavior.`;
    const issues = validateClinicalBodyCompliance(withDra, sibCtx());
    const ncrIssues = issues.filter((i) => i.startsWith("Attention NCR:"));
    expect(ncrIssues.length).toBe(1);
    // Chain completeness is a warning, not a hard 422 block.
    expect(isCriticalComplianceIssue(ncrIssues[0]!)).toBe(false);
  });

  test("deterministic NCR injection resolves the Attention NCR warning", () => {
    const withDra = `${ANTHONY_SIB_PARAGRAPH} The RBT implemented Differential Reinforcement of Alternative Behavior (DRA). Following this intervention, attention was withheld during the maladaptive response and brief praise was delivered when the client displayed compatible behavior.`;
    const injected = injectMissingAttentionNcrIntervention(withDra, {
      narrativeSegmentCount: 1,
      maladaptiveBehaviorForHour: [SIB],
      acquisitionOnlySegmentForHour: [false],
      interventions: INTERVENTIONS,
      maladaptiveBehaviorFunctionsForHour: [["attention"]],
    });
    expect(injected).toMatch(/implemented Attention independent response delivery\./);
    const issues = validateClinicalBodyCompliance(injected, sibCtx());
    expect(issues.some((i) => i.startsWith("Attention NCR:"))).toBe(false);
  });

  test("no Attention NCR warning when NCR is absent from the approved intervention list", () => {
    const withDra = `${ANTHONY_SIB_PARAGRAPH} The RBT implemented Differential Reinforcement of Alternative Behavior (DRA). Following this intervention, attention was withheld during the maladaptive response and brief praise was delivered when the client displayed compatible behavior.`;
    const issues = validateClinicalBodyCompliance(
      withDra,
      sibCtx({ interventions: ["Response Blocking", DRA, "Compliance Training"] }),
    );
    expect(issues.some((i) => i.startsWith("Attention NCR:"))).toBe(false);
  });
});

describe("therapist trial percentages", () => {
  const trialCtx = sibCtx({
    therapistTrialSummaryForReplacementHour: [{ totalTrials: 5, successfulTrialNumbers: [2] }],
  });

  test("'N out of M trials' rollups are rejected", () => {
    const body = ANTHONY_SIB_PARAGRAPH.replace(
      "criterion was met on approximately 20% of discrete trials",
      "1 out of 5 trials were successful",
    );
    const issues = validateClinicalBodyCompliance(body, trialCtx);
    expect(issues.some((i) => i.startsWith("Therapist trial counts:"))).toBe(true);
    expect(issues.filter((i) => i.startsWith("Therapist trial counts:")).every(isCriticalComplianceIssue)).toBe(
      true,
    );
  });

  test("rounded percentage phrasing passes the trial-count rule", () => {
    const body = ANTHONY_SIB_PARAGRAPH.replace(
      "criterion was met on approximately 20% of discrete trials",
      "the client met criterion on 20% of trials",
    );
    const issues = validateClinicalBodyCompliance(body, trialCtx);
    expect(issues.some((i) => i.startsWith("Therapist trial counts:"))).toBe(false);
  });
});

describe("structure rules", () => {
  test("paragraph count must match narrative segments", () => {
    const twoParagraphs = `${ANTHONY_SIB_PARAGRAPH}\n\nSecond stray paragraph.`;
    const issues = validateClinicalBodyCompliance(twoParagraphs, sibCtx());
    expect(issues.some((i) => /^Expected exactly 1 clinical paragraph/.test(i))).toBe(true);
  });

  test("assigned replacement program must appear verbatim", () => {
    const body = ANTHONY_SIB_PARAGRAPH.replace('"Compliance Training"', '"Following Directions"');
    const issues = validateClinicalBodyCompliance(body, sibCtx());
    expect(issues.some((i) => i.startsWith("Replacement program for paragraph 1"))).toBe(true);
  });
});

describe("classifyComplianceIssues", () => {
  test("splits critical from stylistic by pattern", () => {
    const { critical, stylistic } = classifyComplianceIssues([
      "SIB response blocking: paragraph 1 must use exact catalog spelling",
      "Intervention function match: paragraph 1 pairs X with Y",
      "Therapist trial counts: paragraph 1 must state discrete-trial outcomes as a percentage",
      "Quotation marks: do not use backslash characters before quotes",
      "Expected exactly 2 clinical paragraph(s) separated by blank lines; found 1.",
    ]);
    expect(critical).toHaveLength(3);
    expect(stylistic).toHaveLength(2);
  });

  test("unauthorized program/intervention issues are critical", () => {
    expect(
      isCriticalComplianceIssue(
        'Replacement programs: paragraph 1: Unauthorized replacement program "Made Up" — use only the verbatim assigned program',
      ),
    ).toBe(true);
    expect(
      isCriticalComplianceIssue(
        'Interventions: paragraph 1: Interventions: do not use detail phrasing that resembles an unauthorized intervention name (found "token praise system").',
      ),
    ).toBe(true);
  });
});

describe("response block eligibility (Verbal Aggression)", () => {
  const VERBAL_PARAGRAPH = `During table work, the RBT delivered an instruction to sort cards. During this activity, the client manifested Verbal Aggression by shouting insults at the RBT. To address this behavior, the RBT immediately implemented Response Blocking. Following this intervention, the RBT maintained neutral attention. The RBT implemented Differential Reinforcement of Alternative Behavior (DRA).`;

  test("flags Response Block used for Verbal Aggression as critical", () => {
    const issues = validateClinicalBodyCompliance(VERBAL_PARAGRAPH, {
      sessionHours: 1,
      narrativeSegmentCount: 1,
      replacementProgramsInOrder: ["Functional Communication Training (FCT)"],
      replacementProgramForHour: ["Functional Communication Training (FCT)"],
      maladaptiveBehaviors: ["Verbal Aggression"],
      maladaptiveBehaviorForHour: ["Verbal Aggression"],
      maladaptiveBehaviorFunctionsForHour: [["attention"]],
      interventions: INTERVENTIONS,
      clientAgeYears: 8,
      presentPeople: ["Mother"],
    });
    const { critical } = classifyComplianceIssues(issues);
    expect(critical.some((i) => i.startsWith("Response Block prohibited:"))).toBe(true);
    expect(isCriticalComplianceIssue("Response Block prohibited: paragraph 1 addresses Verbal Aggression")).toBe(true);
  });
});
