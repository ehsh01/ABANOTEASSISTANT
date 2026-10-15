import { describe, expect, it } from "vitest";
import { dedupeImportedProgramLists, dedupeProgramNames } from "./program-name-dedup";

describe("PDF program-name deduplication", () => {
  it("deduplicates case and whitespace variants while preserving the first spelling", () => {
    expect(
      dedupeProgramNames([
        "Request a Break",
        "  request   a break ",
        "Appropriate Social Skills",
        "appropriate social skills",
      ]),
    ).toEqual(["Request a Break", "Appropriate Social Skills"]);
  });

  it("removes a skill-acquisition duplicate already imported as a replacement program", () => {
    expect(
      dedupeImportedProgramLists({
        replacementPrograms: ["Request a Break", "Appropriate Social Skills"],
        skillAcquisitionPrograms: [
          "request a break",
          "Playing the Keyboard",
          "playing   the keyboard",
        ],
      }),
    ).toEqual({
      replacementPrograms: ["Request a Break", "Appropriate Social Skills"],
      skillAcquisitionPrograms: ["Playing the Keyboard"],
    });
  });
});
