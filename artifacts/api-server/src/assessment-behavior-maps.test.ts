import { describe, expect, test } from "vitest";
import { extractBehaviorMapsFromBipText } from "./assessment-extract";
import { mergeAutoExtractedBehaviorMapsIntoStructured } from "./assessment-structured";

const BIP_TEXT = `
Behavior Intervention Plan

Self-Injurious Behavior (SIB)
Description: The client strikes his own head with an open hand and squeezes his forearms.
Hypothesized function: Attention
Recommended Interventions:
Response Blocking
Differential Reinforcement of Alternative Behavior (DRA)
Replacement Skills:
Request attention appropriately

Task Refusal
Description: The client turns away from presented materials and pushes them off the table.
Hypothesized function: Escape
Recommended Interventions:
Escape Extinction
Replacement Programs:
Request a break when presented with a demand
`;

const BEHAVIORS = ["Self-Injurious Behavior (SIB)", "Task Refusal"];
const PROGRAMS = ["Request attention appropriately", "Request a break when presented with a demand"];
const INTERVENTIONS = [
  "Response Blocking",
  "Differential Reinforcement of Alternative Behavior (DRA)",
  "Escape Extinction",
];

describe("extractBehaviorMapsFromBipText", () => {
  test("parses per-behavior replacement and intervention lists", () => {
    const maps = extractBehaviorMapsFromBipText(BIP_TEXT, BEHAVIORS, PROGRAMS, INTERVENTIONS);
    expect(maps.behaviorToReplacements["Self-Injurious Behavior (SIB)"]).toEqual([
      "Request attention appropriately",
    ]);
    expect(maps.behaviorToReplacements["Task Refusal"]).toEqual([
      "Request a break when presented with a demand",
    ]);
    expect(maps.behaviorToInterventions["Self-Injurious Behavior (SIB)"]).toEqual([
      "Response Blocking",
      "Differential Reinforcement of Alternative Behavior (DRA)",
    ]);
    expect(maps.behaviorToInterventions["Task Refusal"]).toEqual(["Escape Extinction"]);
  });

  test("only emits values matching the catalog lists", () => {
    const maps = extractBehaviorMapsFromBipText(BIP_TEXT, BEHAVIORS, ["Some Other Program"], INTERVENTIONS);
    expect(maps.behaviorToReplacements).toEqual({});
  });

  test("returns empty maps for text without behavior sections", () => {
    const maps = extractBehaviorMapsFromBipText("No behavior sections here.", BEHAVIORS, PROGRAMS, INTERVENTIONS);
    expect(maps.behaviorToReplacements).toEqual({});
    expect(maps.behaviorToInterventions).toEqual({});
  });
});

describe("mergeAutoExtractedBehaviorMapsIntoStructured", () => {
  test("creates a structured row mirroring profile lists when none exists", () => {
    const merged = mergeAutoExtractedBehaviorMapsIntoStructured({
      existing: null,
      profileBehaviors: BEHAVIORS,
      profileReplacementPrograms: PROGRAMS,
      profileInterventions: INTERVENTIONS,
      behaviorToReplacements: { "Self-Injurious Behavior (SIB)": ["Request attention appropriately"] },
      behaviorToInterventions: {},
    });
    expect(merged).not.toBeNull();
    expect(merged!.behaviors).toEqual(BEHAVIORS);
    expect(merged!.replacement_programs).toEqual(PROGRAMS);
    expect(merged!.behavior_to_replacements_map["Self-Injurious Behavior (SIB)"]).toEqual([
      "Request attention appropriately",
    ]);
  });

  test("returns null when nothing was extracted and no row exists", () => {
    const merged = mergeAutoExtractedBehaviorMapsIntoStructured({
      existing: null,
      profileBehaviors: BEHAVIORS,
      profileReplacementPrograms: PROGRAMS,
      profileInterventions: INTERVENTIONS,
      behaviorToReplacements: {},
      behaviorToInterventions: {},
    });
    expect(merged).toBeNull();
  });

  test("never overwrites curated map entries on an existing row", () => {
    const existing = {
      behaviors: BEHAVIORS,
      replacement_programs: PROGRAMS,
      interventions: INTERVENTIONS,
      behavior_to_replacements_map: {
        "Self-Injurious Behavior (SIB)": ["Request a break when presented with a demand"],
      },
      behavior_to_interventions_map: {},
    };
    const merged = mergeAutoExtractedBehaviorMapsIntoStructured({
      existing,
      profileBehaviors: BEHAVIORS,
      profileReplacementPrograms: PROGRAMS,
      profileInterventions: INTERVENTIONS,
      behaviorToReplacements: {
        "Self-Injurious Behavior (SIB)": ["Request attention appropriately"],
        "Task Refusal": ["Request a break when presented with a demand"],
      },
      behaviorToInterventions: {},
    });
    expect(merged!.behavior_to_replacements_map["Self-Injurious Behavior (SIB)"]).toEqual([
      "Request a break when presented with a demand",
    ]);
    expect(merged!.behavior_to_replacements_map["Task Refusal"]).toEqual([
      "Request a break when presented with a demand",
    ]);
  });

  test("drops values not on the existing allow-lists", () => {
    const existing = {
      behaviors: BEHAVIORS,
      replacement_programs: ["Request attention appropriately"],
      interventions: INTERVENTIONS,
      behavior_to_replacements_map: {},
      behavior_to_interventions_map: {},
    };
    const merged = mergeAutoExtractedBehaviorMapsIntoStructured({
      existing,
      profileBehaviors: BEHAVIORS,
      profileReplacementPrograms: PROGRAMS,
      profileInterventions: INTERVENTIONS,
      behaviorToReplacements: {
        "Task Refusal": ["Request a break when presented with a demand"],
      },
      behaviorToInterventions: {},
    });
    expect(merged!.behavior_to_replacements_map["Task Refusal"]).toBeUndefined();
  });
});
