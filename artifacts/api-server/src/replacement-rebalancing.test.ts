import { describe, expect, test } from "vitest";
import {
  ensureReplacementProgramAlignmentForSegments,
  rebalanceBehaviorMappedReplacementProgramsHourly,
  rebalanceDistinctReplacementProgramsByFunction,
  rebalanceRepeatedReplacementProgramsAcrossSegments,
} from "./note-validation";

const PROGRAM_A = "Request attention appropriately";
const PROGRAM_B = "Request for break when presented with non-preferred activities";
const LEAVE_AREA = "Request permission to leave the unsupervised area";
const REQUEST_TANGIBLES = "Requesting Tangibles";
const COMPLIANCE = "Compliance Training";

function poolFixture() {
  const idToName = new Map<number, string>([
    [1, PROGRAM_A],
    [2, PROGRAM_B],
  ]);
  return {
    idToName,
    poolIds: [1, 2],
    selectedIdSet: new Set<number>([1, 2]),
    authorizedProgramNames: [PROGRAM_A, PROGRAM_B],
  };
}

describe("rebalanceBehaviorMappedReplacementProgramsHourly", () => {
  test("swaps a BIP-map-mismatched program to the mapped candidate", () => {
    const fx = poolFixture();
    const names = [PROGRAM_B];
    const pids: (number | null)[] = [2];
    const rbt = [false];
    const swaps = rebalanceBehaviorMappedReplacementProgramsHourly({
      sessionHours: 1,
      maladaptiveBehaviorForHour: ["Self-Injurious Behavior (SIB)"],
      names,
      rbtActionsOnlyOutcomeForHour: rbt,
      programIdForHour: pids,
      explicitProgramIdByHour: [undefined],
      poolIds: fx.poolIds,
      idToName: fx.idToName,
      selectedIdSet: fx.selectedIdSet,
      behaviorToReplacementsMap: { "Self-Injurious Behavior (SIB)": [PROGRAM_A] },
      authorizedProgramNames: fx.authorizedProgramNames,
      maladaptiveBehaviorFunctionsForHour: [["attention"]],
    });
    expect(names[0]).toBe(PROGRAM_A);
    expect(pids[0]).toBe(1);
    expect(swaps.length).toBe(1);
    expect(swaps[0]).toContain("rebalanced");
  });

  test("does not override an explicitly pinned hour", () => {
    const fx = poolFixture();
    const names = [PROGRAM_B];
    const pids: (number | null)[] = [2];
    const swaps = rebalanceBehaviorMappedReplacementProgramsHourly({
      sessionHours: 1,
      maladaptiveBehaviorForHour: ["Self-Injurious Behavior (SIB)"],
      names,
      rbtActionsOnlyOutcomeForHour: [false],
      programIdForHour: pids,
      explicitProgramIdByHour: [2],
      poolIds: fx.poolIds,
      idToName: fx.idToName,
      selectedIdSet: fx.selectedIdSet,
      behaviorToReplacementsMap: { "Self-Injurious Behavior (SIB)": [PROGRAM_A] },
      authorizedProgramNames: fx.authorizedProgramNames,
      maladaptiveBehaviorFunctionsForHour: [["attention"]],
    });
    expect(names[0]).toBe(PROGRAM_B);
    expect(swaps).toEqual([]);
  });
});

describe("rebalanceDistinctReplacementProgramsByFunction", () => {
  test("splits one shared program across behaviors with different functions", () => {
    const fx = poolFixture();
    const names = [PROGRAM_A, PROGRAM_A];
    const pids: (number | null)[] = [1, 1];
    const rbt = [false, false];
    const swaps = rebalanceDistinctReplacementProgramsByFunction({
      sessionHours: 2,
      maladaptiveBehaviorForHour: ["Self-Injurious Behavior (SIB)", "Task Refusal"],
      names,
      rbtActionsOnlyOutcomeForHour: rbt,
      programIdForHour: pids,
      explicitProgramIdByHour: [undefined, undefined],
      poolIds: fx.poolIds,
      idToName: fx.idToName,
      selectedIdSet: fx.selectedIdSet,
      behaviorToReplacementsMap: {
        "Self-Injurious Behavior (SIB)": [PROGRAM_A],
        "Task Refusal": [PROGRAM_B],
      },
      authorizedProgramNames: fx.authorizedProgramNames,
      maladaptiveBehaviorFunctionsForHour: [["attention"], ["escape"]],
    });
    expect(new Set(names).size).toBe(2);
    expect(swaps.length).toBeGreaterThan(0);
  });

  test("leaves hours alone when functions agree", () => {
    const fx = poolFixture();
    const names = [PROGRAM_A, PROGRAM_A];
    const swaps = rebalanceDistinctReplacementProgramsByFunction({
      sessionHours: 2,
      maladaptiveBehaviorForHour: ["Self-Injurious Behavior (SIB)", "Physical Aggression"],
      names,
      rbtActionsOnlyOutcomeForHour: [false, false],
      programIdForHour: [1, 1],
      explicitProgramIdByHour: [undefined, undefined],
      poolIds: fx.poolIds,
      idToName: fx.idToName,
      selectedIdSet: fx.selectedIdSet,
      behaviorToReplacementsMap: {},
      authorizedProgramNames: fx.authorizedProgramNames,
      maladaptiveBehaviorFunctionsForHour: [["attention"], ["attention"]],
    });
    expect(names).toEqual([PROGRAM_A, PROGRAM_A]);
    expect(swaps).toEqual([]);
  });
});

describe("rebalanceRepeatedReplacementProgramsAcrossSegments", () => {
  const REQUEST_BREAK = "Request for break";
  const ACCEPT_NO = "Accept 'No' as an answer";
  const ACCEPT_ALT = "Accept alternatives when being redirected to more appropriate behavior";

  function distinctFixture() {
    const idToName = new Map<number, string>([
      [1, REQUEST_BREAK],
      [2, ACCEPT_NO],
      [3, ACCEPT_ALT],
    ]);
    const behaviors = [
      "Verbal Aggression",
      "Physical Aggression",
      "Self-Injurious Behavior (SIB)",
    ];
    const map = Object.fromEntries(
      behaviors.map((b) => [b, [REQUEST_BREAK, ACCEPT_NO, ACCEPT_ALT]]),
    );
    return {
      idToName,
      behaviors,
      map,
      poolIds: [1, 2, 3],
      selectedIdSet: new Set<number>([1, 2, 3]),
      authorizedProgramNames: [REQUEST_BREAK, ACCEPT_NO, ACCEPT_ALT],
    };
  }

  test("diversifies a program repeated across same-function behaviors", () => {
    const fx = distinctFixture();
    const names = [REQUEST_BREAK, REQUEST_BREAK, REQUEST_BREAK];
    const pids: (number | null)[] = [1, 1, 1];
    const rbt = [false, false, false];
    const swaps = rebalanceRepeatedReplacementProgramsAcrossSegments({
      segmentCount: 3,
      maladaptiveBehaviorForHour: fx.behaviors,
      names,
      rbtActionsOnlyOutcomeForHour: rbt,
      programIdForHour: pids,
      explicitProgramIdByHour: [undefined, undefined, undefined],
      poolIds: fx.poolIds,
      idToName: fx.idToName,
      selectedIdSet: fx.selectedIdSet,
      behaviorToReplacementsMap: fx.map,
      authorizedProgramNames: fx.authorizedProgramNames,
      maladaptiveBehaviorFunctionsForHour: [["escape"], ["escape"], ["escape"]],
    });
    expect(names[0]).toBe(REQUEST_BREAK);
    expect(new Set(names).size).toBe(3);
    expect(swaps.length).toBe(2);
  });

  test("honors an explicit pin even if it repeats", () => {
    const fx = distinctFixture();
    const names = [REQUEST_BREAK, REQUEST_BREAK];
    const pids: (number | null)[] = [1, 1];
    const rbt = [false, false];
    rebalanceRepeatedReplacementProgramsAcrossSegments({
      segmentCount: 2,
      maladaptiveBehaviorForHour: [fx.behaviors[0]!, fx.behaviors[1]!],
      names,
      rbtActionsOnlyOutcomeForHour: rbt,
      programIdForHour: pids,
      explicitProgramIdByHour: [undefined, 1],
      poolIds: fx.poolIds,
      idToName: fx.idToName,
      selectedIdSet: fx.selectedIdSet,
      behaviorToReplacementsMap: fx.map,
      authorizedProgramNames: fx.authorizedProgramNames,
      maladaptiveBehaviorFunctionsForHour: [["escape"], ["escape"]],
    });
    expect(names).toEqual([REQUEST_BREAK, REQUEST_BREAK]);
  });

  test("leaves a legitimate repeat when no distinct authorized alternative exists", () => {
    const idToName = new Map<number, string>([[1, REQUEST_BREAK]]);
    const names = [REQUEST_BREAK, REQUEST_BREAK];
    const pids: (number | null)[] = [1, 1];
    const swaps = rebalanceRepeatedReplacementProgramsAcrossSegments({
      segmentCount: 2,
      maladaptiveBehaviorForHour: ["Verbal Aggression", "Physical Aggression"],
      names,
      rbtActionsOnlyOutcomeForHour: [false, false],
      programIdForHour: pids,
      explicitProgramIdByHour: [undefined, undefined],
      poolIds: [1],
      idToName,
      selectedIdSet: new Set<number>([1]),
      behaviorToReplacementsMap: {
        "Verbal Aggression": [REQUEST_BREAK],
        "Physical Aggression": [REQUEST_BREAK],
      },
      authorizedProgramNames: [REQUEST_BREAK],
      maladaptiveBehaviorFunctionsForHour: [["escape"], ["escape"]],
    });
    expect(names).toEqual([REQUEST_BREAK, REQUEST_BREAK]);
    expect(swaps).toEqual([]);
  });
});

describe("ensureReplacementProgramAlignmentForSegments", () => {
  test("corrects escape behaviors paired with leave-area and tangible programs using full catalog", () => {
    const idToName = new Map<number, string>([
      [1, LEAVE_AREA],
      [2, REQUEST_TANGIBLES],
      [3, PROGRAM_B],
      [4, COMPLIANCE],
    ]);
    const names = [LEAVE_AREA, REQUEST_TANGIBLES];
    const pids: (number | null)[] = [1, 2];
    const rbt = [true, true];
    const swaps = ensureReplacementProgramAlignmentForSegments({
      segmentCount: 2,
      maladaptiveBehaviorForHour: ["Physical aggression", "Verbal aggression"],
      names,
      rbtActionsOnlyOutcomeForHour: rbt,
      programIdForHour: pids,
      explicitProgramIdByHour: [1, 2],
      rebalancePoolIds: [1, 2, 3, 4],
      idToName,
      selectedIdSet: new Set([1, 2]),
      behaviorToReplacementsMap: {},
      authorizedProgramNames: [LEAVE_AREA, REQUEST_TANGIBLES, PROGRAM_B, COMPLIANCE],
      maladaptiveBehaviorFunctionsForHour: [["escape"], ["escape"]],
      overrideExplicitOnHardMisfit: true,
      slotLabel: "Segment",
    });
    expect(names[0]).not.toBe(LEAVE_AREA);
    expect(names[1]).not.toBe(REQUEST_TANGIBLES);
    expect(names[0]).toBe(PROGRAM_B);
    expect(names[1]).toBe(PROGRAM_B);
    expect(swaps.length).toBeGreaterThan(0);
  });
});
