import { describe, expect, test } from "vitest";
import {
  ensureReplacementProgramAlignmentForSegments,
  rebalanceBehaviorMappedReplacementProgramsHourly,
  rebalanceDistinctReplacementProgramsByFunction,
  rebalanceRepeatedReplacementProgramsAcrossSegments,
  rebalanceWanderingSafetyProximityPrograms,
  replacementProgramPoolForAutoAssignment,
} from "./note-validation";
import { enrichInterventionApplicationForBehavior } from "./note-plan-validation";

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

  const FOLLOW_INSTRUCTIONS = "Follow instructions";

  /** A behavior whose BIP map has only one program, but the client has another authorized program. */
  function restrictiveMapFixture() {
    return {
      idToName: new Map<number, string>([
        [1, REQUEST_BREAK],
        [2, FOLLOW_INSTRUCTIONS],
      ]),
      behaviors: ["Verbal Aggression", "Physical Aggression"],
      // Each escape behavior is only mapped to Request for break in the BIP.
      map: {
        "Verbal Aggression": [REQUEST_BREAK],
        "Physical Aggression": [REQUEST_BREAK],
      },
      poolIds: [1, 2],
      // Request for break was selected; Follow instructions is an extra authorized client program.
      selectedIdSet: new Set<number>([1]),
      authorizedProgramNames: [REQUEST_BREAK, FOLLOW_INSTRUCTIONS],
    };
  }

  test("leaves the repeat by default when only a non-mapped (but function-matched) program remains", () => {
    const fx = restrictiveMapFixture();
    const names = [REQUEST_BREAK, REQUEST_BREAK];
    const pids: (number | null)[] = [1, 1];
    const swaps = rebalanceRepeatedReplacementProgramsAcrossSegments({
      segmentCount: 2,
      maladaptiveBehaviorForHour: fx.behaviors,
      names,
      rbtActionsOnlyOutcomeForHour: [false, false],
      programIdForHour: pids,
      explicitProgramIdByHour: [undefined, undefined],
      poolIds: fx.poolIds,
      idToName: fx.idToName,
      selectedIdSet: fx.selectedIdSet,
      behaviorToReplacementsMap: fx.map,
      authorizedProgramNames: fx.authorizedProgramNames,
      maladaptiveBehaviorFunctionsForHour: [["escape"], ["escape"]],
    });
    expect(names).toEqual([REQUEST_BREAK, REQUEST_BREAK]);
    expect(swaps).toEqual([]);
  });

  test("diversifies with a function-matched authorized program when relaxed distinctness is enabled", () => {
    const fx = restrictiveMapFixture();
    const names = [REQUEST_BREAK, REQUEST_BREAK];
    const pids: (number | null)[] = [1, 1];
    const rbt = [false, false];
    const swaps = rebalanceRepeatedReplacementProgramsAcrossSegments({
      segmentCount: 2,
      maladaptiveBehaviorForHour: fx.behaviors,
      names,
      rbtActionsOnlyOutcomeForHour: rbt,
      programIdForHour: pids,
      explicitProgramIdByHour: [undefined, undefined],
      poolIds: fx.poolIds,
      idToName: fx.idToName,
      selectedIdSet: fx.selectedIdSet,
      behaviorToReplacementsMap: fx.map,
      authorizedProgramNames: fx.authorizedProgramNames,
      maladaptiveBehaviorFunctionsForHour: [["escape"], ["escape"]],
      allowFunctionRelaxedDistinctness: true,
    });
    expect(names[0]).toBe(REQUEST_BREAK);
    expect(names[1]).toBe(FOLLOW_INSTRUCTIONS);
    expect(new Set(names).size).toBe(2);
    expect(swaps.length).toBe(1);
    // The swapped-in program is a non-selected (extra) client program.
    expect(rbt[1]).toBe(true);
  });

  test("still leaves a repeat under relaxed distinctness when the only alternative is a safety misfit", () => {
    const idToName = new Map<number, string>([
      [1, REQUEST_BREAK],
      [2, LEAVE_AREA],
    ]);
    const names = [REQUEST_BREAK, REQUEST_BREAK];
    const pids: (number | null)[] = [1, 1];
    const swaps = rebalanceRepeatedReplacementProgramsAcrossSegments({
      segmentCount: 2,
      maladaptiveBehaviorForHour: ["Verbal Aggression", "Physical Aggression"],
      names,
      rbtActionsOnlyOutcomeForHour: [false, false],
      programIdForHour: pids,
      explicitProgramIdByHour: [undefined, undefined],
      poolIds: [1, 2],
      idToName,
      selectedIdSet: new Set<number>([1]),
      behaviorToReplacementsMap: {
        "Verbal Aggression": [REQUEST_BREAK],
        "Physical Aggression": [REQUEST_BREAK],
      },
      authorizedProgramNames: [REQUEST_BREAK, LEAVE_AREA],
      maladaptiveBehaviorFunctionsForHour: [["escape"], ["escape"]],
      allowFunctionRelaxedDistinctness: true,
    });
    // Leave-area is a safety misfit for non-elopement aggression, so the repeat is retained.
    expect(names).toEqual([REQUEST_BREAK, REQUEST_BREAK]);
    expect(swaps).toEqual([]);
  });
});

describe("replacementProgramPoolForAutoAssignment (session-effective pool)", () => {
  test("uses selected programs only when selection covers every hour", () => {
    expect(replacementProgramPoolForAutoAssignment([10, 20, 30], [10, 20, 30, 40, 50], 3)).toEqual([
      10, 20, 30,
    ]);
  });

  test("appends linked/assessment programs only when hours exceed the selection", () => {
    expect(replacementProgramPoolForAutoAssignment([10, 20], [10, 20, 40, 50], 4)).toEqual([
      10, 20, 40, 50,
    ]);
  });
});

describe("ensureReplacementProgramAlignmentForSegments", () => {
  test("corrects escape behaviors paired with leave-area and tangible programs using session pool", () => {
    const idToName = new Map<number, string>([
      [1, LEAVE_AREA],
      [2, REQUEST_TANGIBLES],
      [3, PROGRAM_B],
      [4, COMPLIANCE],
    ]);
    const names = [LEAVE_AREA, REQUEST_TANGIBLES];
    const pids: (number | null)[] = [1, 2];
    const rbt = [true, true];
    // Hours exceed selection (2 selected, but pool includes fill-ins 3+4) — fill-ins are eligible.
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

  test("never introduces programs outside the session-effective pool even when authorized names are wider", () => {
    const EXTRA = "Echoic Skills";
    const idToName = new Map<number, string>([
      [1, PROGRAM_A],
      [2, PROGRAM_B],
      [3, EXTRA],
    ]);
    // Selection covers hours: pool is selected-only. Authorized names still list EXTRA (assessment).
    const names = [PROGRAM_A, PROGRAM_A];
    const pids: (number | null)[] = [1, 1];
    const rbt = [false, false];
    ensureReplacementProgramAlignmentForSegments({
      segmentCount: 2,
      maladaptiveBehaviorForHour: ["Task Refusal", "Tantrum"],
      names,
      rbtActionsOnlyOutcomeForHour: rbt,
      programIdForHour: pids,
      explicitProgramIdByHour: [undefined, undefined],
      rebalancePoolIds: [1, 2],
      idToName,
      selectedIdSet: new Set([1, 2]),
      behaviorToReplacementsMap: {
        "Task Refusal": [PROGRAM_A],
        Tantrum: [PROGRAM_A],
      },
      authorizedProgramNames: [PROGRAM_A, PROGRAM_B, EXTRA],
      maladaptiveBehaviorFunctionsForHour: [["escape"], ["escape"]],
      overrideExplicitOnHardMisfit: true,
      slotLabel: "Segment",
    });
    expect(names.every((n) => n === PROGRAM_A || n === PROGRAM_B)).toBe(true);
    expect(names).not.toContain(EXTRA);
  });
});

describe("rebalanceWanderingSafetyProximityPrograms", () => {
  const WALK_CLOSE = "Walk within close distance of adult (Safety Skills)";
  const TIME_ON_TASK = "Time on task";

  test("swaps Time on task to Walk within close distance for Wandering Away", () => {
    const idToName = new Map<number, string>([
      [1, TIME_ON_TASK],
      [2, WALK_CLOSE],
    ]);
    const names = [TIME_ON_TASK];
    const pids: (number | null)[] = [1];
    const rbt = [false];
    const swaps = rebalanceWanderingSafetyProximityPrograms({
      segmentCount: 1,
      maladaptiveBehaviorForHour: ["Wandering Away"],
      names,
      rbtActionsOnlyOutcomeForHour: rbt,
      programIdForHour: pids,
      explicitProgramIdByHour: [undefined],
      poolIds: [1, 2],
      idToName,
      selectedIdSet: new Set([1, 2]),
      authorizedProgramNames: [TIME_ON_TASK, WALK_CLOSE],
    });
    expect(names[0]).toBe(WALK_CLOSE);
    expect(pids[0]).toBe(2);
    expect(swaps.length).toBe(1);
  });

  test("leaves Time on task alone when Walk within close is not authorized", () => {
    const idToName = new Map<number, string>([[1, TIME_ON_TASK]]);
    const names = [TIME_ON_TASK];
    const swaps = rebalanceWanderingSafetyProximityPrograms({
      segmentCount: 1,
      maladaptiveBehaviorForHour: ["Wandering Away"],
      names,
      rbtActionsOnlyOutcomeForHour: [false],
      programIdForHour: [1],
      explicitProgramIdByHour: [undefined],
      poolIds: [1],
      idToName,
      selectedIdSet: new Set([1]),
      authorizedProgramNames: [TIME_ON_TASK],
    });
    expect(names[0]).toBe(TIME_ON_TASK);
    expect(swaps).toEqual([]);
  });
});

describe("enrichInterventionApplicationForBehavior", () => {
  test("enriches thin Premack application for Physical Aggression", () => {
    const out = enrichInterventionApplicationForBehavior(
      "requiring cleanup before access to the tablet",
      "Physical Aggression",
      "Premack principle",
    );
    expect(out).toMatch(/restating the contingency/i);
    expect(out).toMatch(/re-presenting the demand/i);
    expect(out).toMatch(/before access to the tablet/i);
  });

  test("enriches Property Destruction application with redirect-to-retrieve", () => {
    const out = enrichInterventionApplicationForBehavior(
      "requiring completion of the activity before access to the reinforcer",
      "Property Destruction",
      "Premack principle",
    );
    expect(out).toMatch(/redirecting the client to retrieve the item/i);
    expect(out).toMatch(/re-presenting the task demand/i);
  });

  test("leaves already-rich RBT action detail unchanged", () => {
    const rich =
      "restating the contingency, re-presenting the cleanup demand, and requiring completion of the cleanup task before access to the tablet";
    expect(
      enrichInterventionApplicationForBehavior(rich, "Physical Aggression", "Premack principle"),
    ).toBe(rich);
  });
});
