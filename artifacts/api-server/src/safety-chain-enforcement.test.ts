import { describe, expect, test } from "vitest";
import {
  hasFunctionMatchedInterventionAfterResponseBlock,
  injectMissingSafetyChainFunctionIntervention,
  paragraphHasResponseBlockFirst,
} from "./safety-chain-enforcement";

const INTERVENTIONS = [
  "Response Blocking",
  "Differential Reinforcement of Alternative Behavior (DRA)",
  "Attention independent response delivery",
  "Compliance Training",
];

export const ANTHONY_SIB_PARAGRAPH = `Later at the table, the RBT arranged a card-sorting task by placing a stack of cards and sorting trays within reach and delivered a clear instruction to continue sorting. During this activity, the client manifested Self-Injurious Behavior (SIB) by striking his head with an open hand and squeezing his forearms repeatedly. To address this behavior, the RBT immediately implemented Response blocking. Following this intervention, the RBT blocked further contact with the client's head and arms and maintained neutral attention while repositioning the materials in front of him. Once the client's hands were down and oriented toward the task, the RBT delivered brief verbal praise and re-presented the instruction to continue sorting. The RBT implemented the replacement program "Compliance Training" by delivering one-step instructions and using a prompt hierarchy to support task completion; criterion was met on approximately 20% of discrete trials.`;

describe("safety-chain enforcement (Anthony SIB regression)", () => {
  test("case-insensitive Response blocking counts as Response Blocking first", () => {
    expect(
      paragraphHasResponseBlockFirst(ANTHONY_SIB_PARAGRAPH, "Response Blocking", INTERVENTIONS),
    ).toBe(true);
  });

  test("paragraph lacks DRA after Response Block before injection", () => {
    expect(
      hasFunctionMatchedInterventionAfterResponseBlock(ANTHONY_SIB_PARAGRAPH, "Response Blocking", [
        "Differential Reinforcement of Alternative Behavior (DRA)",
      ]),
    ).toBe(false);
  });

  test("injection adds DRA naming sentence and follow-up detail", () => {
    const injected = injectMissingSafetyChainFunctionIntervention(ANTHONY_SIB_PARAGRAPH, {
      narrativeSegmentCount: 1,
      maladaptiveBehaviorForHour: ["Self-Injurious Behavior (SIB)"],
      acquisitionOnlySegmentForHour: [false],
      interventions: INTERVENTIONS,
      maladaptiveBehaviorFunctionsForHour: [["attention"]],
      interventionCandidatesForHour: [["Differential Reinforcement of Alternative Behavior (DRA)"]],
    });

    expect(injected).toMatch(/implemented Response Blocking\./);
    expect(injected).toMatch(/implemented Differential Reinforcement of Alternative Behavior \(DRA\)\./);
    expect(injected).toMatch(
      /Following this intervention, attention was withheld during the maladaptive response/,
    );
  });

  test("injection is a no-op when a function-matched intervention is already named", () => {
    const withDra = `${ANTHONY_SIB_PARAGRAPH} The RBT implemented Differential Reinforcement of Alternative Behavior (DRA). Following this intervention, attention was provided contingent on appropriate requesting.`;
    const injected = injectMissingSafetyChainFunctionIntervention(withDra, {
      narrativeSegmentCount: 1,
      maladaptiveBehaviorForHour: ["Self-Injurious Behavior (SIB)"],
      acquisitionOnlySegmentForHour: [false],
      interventions: INTERVENTIONS,
      maladaptiveBehaviorFunctionsForHour: [["attention"]],
      interventionCandidatesForHour: [["Differential Reinforcement of Alternative Behavior (DRA)"]],
    });
    const namingSentences = injected.match(
      /implemented Differential Reinforcement of Alternative Behavior \(DRA\)\./g,
    );
    expect(namingSentences?.length).toBe(1);
  });
});
