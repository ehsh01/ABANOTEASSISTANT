import { describe, expect, it } from "vitest";
import {
  criterionPercentage,
  criterionPercentageOrZero,
  resolveHourlyProgramIds,
  ZERO_CRITERION_TRIAL_ENTRY,
} from "./flexible-note-input";

describe("criterionPercentageOrZero", () => {
  it("returns 0 for missing trial data", () => {
    expect(criterionPercentageOrZero(null)).toBe(0);
    expect(criterionPercentageOrZero(undefined)).toBe(0);
    expect(criterionPercentageOrZero({ count: null, effectiveTrials: [] })).toBe(0);
  });

  it("matches criterionPercentage for complete entries", () => {
    const entry = { count: 10, effectiveTrials: [1, 2, 3] };
    expect(criterionPercentageOrZero(entry)).toBe(criterionPercentage(entry));
    expect(criterionPercentageOrZero(ZERO_CRITERION_TRIAL_ENTRY)).toBe(0);
  });
});

describe("resolveHourlyProgramIds", () => {
  it("fills four hours from two selected plus two linked extras", () => {
    expect(
      resolveHourlyProgramIds({
        sessionHours: 4,
        hintProgramIds: [1, 2, 1, 2],
        selectedIds: [1, 2],
        linkedIds: [1, 2, 3, 4],
      }),
    ).toEqual([1, 2, 3, 4]);
  });
});
