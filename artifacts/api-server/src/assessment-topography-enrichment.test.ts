import { describe, expect, test } from "vitest";
import { enrichMaladaptiveTargetsWithAssessmentTopography } from "./assessment-extract";

const ASSESSMENT_TEXT = `
Disruptive Behavior
Description: The client pushes task materials away from the workspace, drops presented cards onto
the floor, and raises his voice above conversational level after a demand is presented.
Onset: Begins with the first observable action.

Elopement
Description: The client leaves the assigned activity area without permission by walking beyond
the supervising adult's arm's reach or moving toward a doorway or hallway.
Onset: Begins when the client crosses the activity boundary.
`;

describe("assessment topography enrichment", () => {
  test("fills missing profile topographies from the authoritative assessment", () => {
    const enriched = enrichMaladaptiveTargetsWithAssessmentTopography(
      [
        { name: "Disruptive Behavior", topography: null },
        { name: "Elopement", topography: null },
      ],
      ASSESSMENT_TEXT,
    );

    expect(enriched[0]?.topography).toContain("pushes task materials");
    expect(enriched[1]?.topography).toContain("leaves the assigned activity area");
  });

  test("preserves therapist-entered profile topography", () => {
    const enriched = enrichMaladaptiveTargetsWithAssessmentTopography(
      [{ name: "Elopement", topography: "Existing profile definition." }],
      ASSESSMENT_TEXT,
    );

    expect(enriched[0]?.topography).toBe("Existing profile definition.");
  });
});
