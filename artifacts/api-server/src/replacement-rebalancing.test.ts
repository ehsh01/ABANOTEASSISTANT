import { describe, expect, test } from "vitest";
import {
  ensureReplacementProgramAlignmentForSegments,
  rebalanceBehaviorMappedReplacementProgramsHourly,
  rebalanceDistinctReplacementProgramsByFunction,
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
