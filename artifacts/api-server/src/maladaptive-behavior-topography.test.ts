import { describe, expect, it } from "vitest";
import {
  lastResortObservableTopographyForBehavior,
  looksLikePastedBipDefinitionTopography,
  pickSingleTopographyActionForSegment,
  pickStoredTopographyActionForSegment,
  splitTopographyActionAlternatives,
  taskRefusalTopographyDescribesAppropriateBehavior,
  taskRefusalTopographyFromAntecedent,
} from "./maladaptive-behavior-topography";

describe("Physical Aggression topography single-action selection", () => {
  it("does not truncate 'open or closed hand' into 'with an open'", () => {
    const bip =
      "contacting any part of another person's body with an open or closed hand";
    const actions = splitTopographyActionAlternatives(bip);
    expect(actions.every((a) => !/\bwith an open$/i.test(a))).toBe(true);
    expect(actions.every((a) => /\b(?:open|closed)\s+hand\b/i.test(a))).toBe(true);

    const picked = pickSingleTopographyActionForSegment(bip, 0);
    expect(picked).not.toMatch(/with an open$/i);
    expect(picked).toMatch(/\b(?:open|closed)\s+hand\b/i);
    // One concrete means — not the BIP "open or closed" hedge.
    expect(picked).not.toMatch(/\bopen or closed\b/i);
  });

  it("rotates open vs closed hand across hours", () => {
    const bip =
      "contacting any part of another person's body with an open or closed hand";
    const hour0 = pickSingleTopographyActionForSegment(bip, 0);
    const hour1 = pickSingleTopographyActionForSegment(bip, 1);
    expect(hour0.toLowerCase()).not.toBe(hour1.toLowerCase());
    expect(hour0).toMatch(/\bopen hand\b/i);
    expect(hour1).toMatch(/\bclosed hand\b/i);
  });

  it("expands means lists after 'with' into complete single-action phrases", () => {
    const bip =
      "contacting any part of another person's body with an open hand, fist, foot, or object";
    const actions = splitTopographyActionAlternatives(bip);
    expect(actions.length).toBeGreaterThanOrEqual(2);
    expect(actions.every((a) => /\bwith\b/i.test(a))).toBe(true);
    expect(actions.every((a) => a.length >= 20)).toBe(true);

    const picked = pickSingleTopographyActionForSegment(bip, 0);
    expect(picked).not.toMatch(/,/);
    expect(picked).toMatch(/\bwith an open hand\b/i);
    expect(picked).toMatch(/contacting/i);
  });

  it("keeps shared-complement verb lists as complete person-directed actions", () => {
    const bip = "hitting, kicking, pushing, or scratching another person";
    const actions = splitTopographyActionAlternatives(bip);
    expect(actions).toEqual([
      "hitting another person",
      "kicking another person",
      "pushing another person",
      "scratching another person",
    ]);
    expect(pickSingleTopographyActionForSegment(bip, 0)).toBe("hitting another person");
    expect(pickSingleTopographyActionForSegment(bip, 2)).toBe("pushing another person");
  });

  it("strips 'any instance' frames without leaving incomplete contact phrases", () => {
    const bip =
      "Any instance in which the client contacts any part of another person's body with an open or closed hand or with an object";
    const picked = pickStoredTopographyActionForSegment(bip, 0);
    expect(picked).not.toMatch(/with an open$/i);
    expect(picked).toMatch(/\b(?:open hand|closed hand|object)\b/i);
    expect(picked.length).toBeGreaterThan(25);
  });

  it("still rotates Excessive Motor alternative actions without comma dumps", () => {
    const full =
      "frequently flapping his hands, continuous side-to-side head movement without interruption, walking back and forth repetitively, or engaging in the same activity repeatedly";
    expect(pickSingleTopographyActionForSegment(full, 0)).toBe("flapping his hands");
    expect(pickSingleTopographyActionForSegment(full, 1)).toMatch(/head movement/i);
    expect(pickSingleTopographyActionForSegment(full, 0)).not.toMatch(/,/);
  });
});

describe("semicolon-delimited BIP topography lists", () => {
  const bip =
    "contacting any part of another person's body with foot; headbutts; scratching; pinching; throwing items at a person;";

  it("splits the semicolon dump into complete single actions (no trailing semicolon, no 'with foot')", () => {
    const actions = splitTopographyActionAlternatives(bip);
    expect(actions.length).toBeGreaterThanOrEqual(4);
    expect(actions.every((a) => !/;/.test(a))).toBe(true);
    expect(actions.every((a) => !/\bwith foot\b/i.test(a))).toBe(true);
    expect(actions).toContain("contacting any part of another person's body with a foot");
    expect(actions).toContain("headbutting another person");
    expect(actions).toContain("scratching another person");
    expect(actions).toContain("pinching another person");
    expect(actions).toContain("throwing items at a person");
  });

  it("picks exactly one action per hour and rotates across hours", () => {
    const hour0 = pickSingleTopographyActionForSegment(bip, 0);
    const hour1 = pickSingleTopographyActionForSegment(bip, 1);
    expect(hour0).not.toMatch(/;/);
    expect(hour1).not.toMatch(/;/);
    expect(hour0.toLowerCase()).not.toBe(hour1.toLowerCase());
  });

  it("fixes a bare 'with foot' means even without a list", () => {
    expect(
      pickSingleTopographyActionForSegment(
        "contacting any part of another person's body with foot",
        0,
      ),
    ).toBe("contacting any part of another person's body with a foot");
  });
});

describe("Task Refusal / Wandering topography audit guards", () => {
  it("detects Task Refusal topography that names the appropriate activity", () => {
    expect(taskRefusalTopographyDescribesAppropriateBehavior("washing hands")).toBe(true);
    expect(taskRefusalTopographyDescribesAppropriateBehavior("brushing teeth")).toBe(true);
    expect(
      taskRefusalTopographyDescribesAppropriateBehavior(
        "not initiating the handwashing routine within 10 seconds after the instruction was delivered",
      ),
    ).toBe(false);
  });

  it("rebuilds refusal topography from the antecedent activity", () => {
    expect(
      taskRefusalTopographyFromAntecedent(
        "The RBT presented a toothbrushing routine with the toothbrush and sink materials ready.",
      ),
    ).toMatch(/not initiating the toothbrushing routine/i);
  });

  it("detects pasted BIP definition dumps for wandering", () => {
    expect(
      looksLikePastedBipDefinitionTopography(
        "Defined as any instance in which the client leaves the supervised area without permission from an adult when the client is expected to remain within the designated area.",
      ),
    ).toBe(true);
    expect(
      looksLikePastedBipDefinitionTopography(
        "walking several feet away from the RBT toward the hallway without permission",
      ),
    ).toBe(false);
  });

  it("provides last-resort topography for Task Refusal and Wandering Away", () => {
    expect(lastResortObservableTopographyForBehavior("Task Refusal")).toMatch(/not initiating/i);
    expect(lastResortObservableTopographyForBehavior("Wandering Away")).toMatch(
      /walking several feet away/i,
    );
  });
});
