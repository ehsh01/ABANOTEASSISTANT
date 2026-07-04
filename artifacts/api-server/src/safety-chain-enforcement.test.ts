import assert from "node:assert/strict";
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

const ANTHONY_SIB_PARAGRAPH = `Later at the table, the RBT arranged a card-sorting task by placing a stack of cards and sorting trays within reach and delivered a clear instruction to continue sorting. During this activity, the client manifested Self-Injurious Behavior (SIB) by striking his head with an open hand and squeezing his forearms repeatedly. To address this behavior, the RBT immediately implemented Response blocking. Following this intervention, the RBT blocked further contact with the client's head and arms and maintained neutral attention while repositioning the materials in front of him. Once the client's hands were down and oriented toward the task, the RBT delivered brief verbal praise and re-presented the instruction to continue sorting. The RBT implemented the replacement program "Compliance Training" by delivering one-step instructions and using a prompt hierarchy to support task completion; criterion was met on approximately 20% of discrete trials.`;

assert.equal(
  paragraphHasResponseBlockFirst(ANTHONY_SIB_PARAGRAPH, "Response Blocking", INTERVENTIONS),
  true,
  "case-insensitive Response blocking must count as Response Blocking first",
);

assert.equal(
  hasFunctionMatchedInterventionAfterResponseBlock(
    ANTHONY_SIB_PARAGRAPH,
    "Response Blocking",
    ["Differential Reinforcement of Alternative Behavior (DRA)"],
  ),
  false,
  "Anthony SIB paragraph must lack DRA after Response Block before injection",
);

const injected = injectMissingSafetyChainFunctionIntervention(ANTHONY_SIB_PARAGRAPH, {
  narrativeSegmentCount: 1,
  maladaptiveBehaviorForHour: ["Self-Injurious Behavior (SIB)"],
  acquisitionOnlySegmentForHour: [false],
  interventions: INTERVENTIONS,
  maladaptiveBehaviorFunctionsForHour: [["attention"]],
  interventionCandidatesForHour: [["Differential Reinforcement of Alternative Behavior (DRA)"]],
});

assert.match(
  injected,
  /implemented Response Blocking\./,
  "injected body must normalize Response Block label",
);
assert.match(
  injected,
  /implemented Differential Reinforcement of Alternative Behavior \(DRA\)\./,
  "injected body must add DRA naming sentence",
);
assert.match(
  injected,
  /Following this intervention, attention was withheld during the maladaptive response/,
  "injected body must add DRA follow-up detail",
);

console.log("safety-chain-enforcement.test.ts: ok");
