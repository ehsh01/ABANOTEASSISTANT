import { describe, expect, test } from "vitest";
import {
  assignedBehaviorAllowsResponseBlockSafetyChain,
  isPhysicalAggressionBehaviorLabel,
  isResponseBlockProhibitedBehavior,
} from "./response-block-eligibility";

describe("response block eligibility", () => {
  test("prohibits Response Block for verbal and non-physical topographies", () => {
    for (const label of [
      "Verbal Aggression",
      "Task Refusal",
      "Inappropriate Language",
      "Screaming",
      "Yelling",
      "Noncompliance",
      "Inappropriate Social Behavior",
      "Disruption",
    ]) {
      expect(isResponseBlockProhibitedBehavior(label)).toBe(true);
      expect(assignedBehaviorAllowsResponseBlockSafetyChain(label)).toBe(false);
    }
  });

  test("allows Response Block for physical safety topographies", () => {
    for (const label of [
      "Physical Aggression",
      "Self-Injurious Behavior (SIB)",
      "Bolting",
      "Elopement",
      "Property Destruction",
    ]) {
      expect(isResponseBlockProhibitedBehavior(label)).toBe(false);
      expect(assignedBehaviorAllowsResponseBlockSafetyChain(label)).toBe(true);
    }
  });

  test("distinguishes Physical Aggression from Verbal Aggression", () => {
    expect(isPhysicalAggressionBehaviorLabel("Physical Aggression")).toBe(true);
    expect(isPhysicalAggressionBehaviorLabel("Verbal Aggression")).toBe(false);
    expect(isPhysicalAggressionBehaviorLabel("Aggression")).toBe(true);
  });
});
