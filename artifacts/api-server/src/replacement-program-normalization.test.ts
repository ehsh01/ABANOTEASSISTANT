import { describe, expect, it } from "vitest";
import {
  isMisfitReplacementForMaladaptiveBehavior,
  normalizeReplacementProgramKey,
  pickBestReplacementProgramForBehavior,
} from "./note-scheduling";
import {
  assignInterventionsForSegment,
  shouldPreferStoredTopographyOverModel,
} from "./note-plan-validation";
import { findUnauthorizedQuotedReplacementProgramIssue } from "./note-validation";

/**
 * Regression coverage for client BIP data where `behavior_to_replacements_map` values differ from the
 * assigned/authorized catalog strings only by casing and quote glyph (curly “No” vs straight 'No',
 * "Request for Break" vs "Request for break"). Those are the same program and must not be flagged as
 * function mismatches, nor split into a bogus "Accept" unauthorized-program token.
 */
describe("replacement program name normalization (case + quote glyph)", () => {
  const behaviorToReplacementsMap: Record<string, string[]> = {
    "Task Refusal": [
      "Follow Instruction",
      "Delay of reinforcers",
      "Request for Break",
      "Accept \u201CNo\u201D as an answer",
    ],
    Tantrum: [
      "Request Attention",
      "Request for Break",
      "Accept \u201CNo\u201D as an answer",
    ],
  };
  const escape = ["escape"] as const;

  it("normalizes casing and quote glyphs to a shared key", () => {
    expect(normalizeReplacementProgramKey("Request for Break")).toBe(
      normalizeReplacementProgramKey("Request for break"),
    );
    expect(normalizeReplacementProgramKey("Accept \u201CNo\u201D as an answer")).toBe(
      normalizeReplacementProgramKey("Accept 'No' as an answer"),
    );
  });

  it("does not flag a casing-only variant as a function mismatch", () => {
    expect(
      isMisfitReplacementForMaladaptiveBehavior(
        "Task Refusal",
        "Request for break",
        behaviorToReplacementsMap,
        [...escape],
      ),
    ).toBe(false);
  });

  it("does not flag a curly-vs-straight quote variant as a function mismatch", () => {
    expect(
      isMisfitReplacementForMaladaptiveBehavior(
        "Tantrum",
        "Accept 'No' as an answer",
        behaviorToReplacementsMap,
        [...escape],
      ),
    ).toBe(false);
  });

  it("still flags a program that is genuinely not mapped to the behavior", () => {
    const elopementMap: Record<string, string[]> = {
      Elopement: ["Follow Instruction", "Request for Break", "safety Skills"],
    };
    expect(
      isMisfitReplacementForMaladaptiveBehavior(
        "Elopement",
        "Stay on task",
        elopementMap,
        [...escape],
      ),
    ).toBe(true);
  });

  it("picks a mapped candidate using the authorized catalog spelling", () => {
    const authorized = [
      "Request for break",
      "Accept 'No' as an answer",
      "Follow Instruction",
      "Delay of reinforcers",
    ];
    const pick = pickBestReplacementProgramForBehavior(
      "Task Refusal",
      behaviorToReplacementsMap,
      authorized,
      [...escape],
    );
    expect(pick).not.toBeNull();
    expect(authorized).toContain(pick);
  });
});

describe('unauthorized quoted replacement program detection with quoted program names', () => {
  it('does not split "Accept \'No\' as an answer" into a bogus "Accept" token', () => {
    const paragraph =
      "Additionally, the RBT implemented the replacement program 'Accept 'No' as an answer' by offering choices.";
    expect(
      findUnauthorizedQuotedReplacementProgramIssue(paragraph, "Accept 'No' as an answer", [
        "Accept 'No' as an answer",
        "Request for break",
      ]),
    ).toBeNull();
  });

  it("still flags a genuinely unauthorized quoted program", () => {
    const paragraph = "The RBT implemented the replacement program 'Made-up program' by prompting.";
    const issue = findUnauthorizedQuotedReplacementProgramIssue(paragraph, "Request for break", [
      "Request for break",
    ]);
    expect(issue).toContain("Made-up program");
  });
});

describe("SIB intervention assignment without approved Response Block", () => {
  const approved = [
    "Differential Reinforcement of Alternative Behaviors (DRA)",
    "Environmental Manipulation",
    "Redirection",
    "Premack principle",
  ];

  it("assigns ONLY Environmental Manipulation for SIB when Response Block is unavailable", () => {
    // Without an approved Response Block label, INTERVENTION_COUNT permits exactly one catalog naming
    // sentence for the SIB segment, so assignment must return a single intervention (protective blocking
    // is described in plain prose, not as a second catalog intervention).
    const assigned = assignInterventionsForSegment({
      acquisitionOnly: false,
      behaviorLabel: "Self-Injurious Behavior (SIB)",
      approvedInterventions: approved,
      behaviorFunctions: ["automatic"],
    });
    expect(assigned).toEqual(["Environmental Manipulation"]);
  });
});

describe("SIB behavior topography grounding threshold", () => {
  const storedSib =
    "hurts himself by slapping himself in the face and pulling his hair";

  it("prefers stored topography when the model omits the observable actions", () => {
    // Model wrote a generic, non-reflective topography -> fall back to stored so the final
    // BEHAVIOR_TOPOGRAPHY gate (>=2 stored action tokens) passes deterministically.
    expect(
      shouldPreferStoredTopographyOverModel(
        "engaged in unsafe behavior directed at himself",
        storedSib,
        "Self-Injurious Behavior (SIB)",
      ),
    ).toBe(true);
  });

  it("keeps natural model topography when it reflects the stored actions", () => {
    expect(
      shouldPreferStoredTopographyOverModel(
        "slapping his face and pulling his hair",
        storedSib,
        "Self-Injurious Behavior (SIB)",
      ),
    ).toBe(false);
  });
});
