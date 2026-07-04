import { describe, expect, test } from "vitest";
import { repairClinicalBodyReplacementProgramAssignments } from "./replacement-program-repair";

describe("repairClinicalBodyReplacementProgramAssignments", () => {
  test("rewrites the replacement program sentence when assignment is corrected", () => {
    const body = `During table work, the client manifested Physical aggression by hitting the table. The RBT implemented Response Blocking. The RBT implemented the replacement program "Request permission to leave the unsupervised area" by prompting the client to ask before leaving.`;
    const repaired = repairClinicalBodyReplacementProgramAssignments(
      body,
      ["Request permission to leave the unsupervised area"],
      ["Request for break when presented with non-preferred activities"],
    );
    expect(repaired).toContain(
      'replacement program "Request for break when presented with non-preferred activities"',
    );
    expect(repaired).not.toContain("Request permission to leave the unsupervised area");
  });
});
