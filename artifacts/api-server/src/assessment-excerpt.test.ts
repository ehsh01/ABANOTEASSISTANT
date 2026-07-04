import { describe, expect, test } from "vitest";
import {
  MAX_ASSESSMENT_TEXT_NOTE_CONTEXT_CHARS,
  truncateAssessmentTextForNoteContext,
} from "./assessment-extract";

const FILLER = "Narrative filler line about daily routines and general observations.\n";

function block(lines: string, repeat: number): string {
  return lines.repeat(repeat);
}

describe("truncateAssessmentTextForNoteContext", () => {
  test("returns full text unchanged when under budget", () => {
    const text = "Short assessment text.";
    expect(truncateAssessmentTextForNoteContext(text)).toEqual({ text, truncated: false });
  });

  test("keeps late high-priority sections that naive truncation would drop", () => {
    const boilerplate = `Insurance\n${block("Policy and claims boilerplate line.\n", 900)}`;
    const preamble = block(FILLER, 400);
    const behaviorSection = `Maladaptive Behaviors\nSelf-Injurious Behavior (SIB)\nDescription: The client strikes his own head with an open hand.\nHypothesized function: Attention\n`;
    const replacementSection = `Replacement Programs\nRequest attention appropriately\nRequest for break when presented with non-preferred activities\n`;
    const text = [preamble, boilerplate, block(FILLER, 300), behaviorSection, replacementSection].join("\n");
    expect(text.length).toBeGreaterThan(MAX_ASSESSMENT_TEXT_NOTE_CONTEXT_CHARS);

    const naive = text.slice(0, MAX_ASSESSMENT_TEXT_NOTE_CONTEXT_CHARS);
    const result = truncateAssessmentTextForNoteContext(text);

    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(MAX_ASSESSMENT_TEXT_NOTE_CONTEXT_CHARS);
    // The naive head would have cut the behavior definitions; section-aware selection keeps them.
    expect(naive).not.toContain("Hypothesized function: Attention");
    expect(result.text).toContain("Hypothesized function: Attention");
    expect(result.text).toContain("Request attention appropriately");
  });

  test("drops boilerplate sections before clinical ones", () => {
    const clinical = `Maladaptive Behaviors\n${block("Description: observable behavior detail line for the client.\n", 300)}`;
    const signatures = `Signatures\n${block("Signature line for approvals and dates.\n", 800)}`;
    const text = [clinical, signatures, block(FILLER, 400)].join("\n");
    if (text.length <= MAX_ASSESSMENT_TEXT_NOTE_CONTEXT_CHARS) {
      throw new Error("fixture must exceed the excerpt budget");
    }
    const result = truncateAssessmentTextForNoteContext(text);
    expect(result.text).toContain("Description: observable behavior detail line");
    expect(result.text.length).toBeLessThanOrEqual(MAX_ASSESSMENT_TEXT_NOTE_CONTEXT_CHARS);
  });

  test("preserves original document order of selected sections", () => {
    const a = `Preference Assessment\nAttention listed for SIB.\n`;
    const b = `Replacement Programs\nRequest attention appropriately.\n`;
    const text = [a, block(FILLER, 500), b, block("Insurance\n" + FILLER, 400)].join("\n");
    const result = truncateAssessmentTextForNoteContext(text);
    if (result.truncated) {
      expect(result.text.indexOf("Preference Assessment")).toBeLessThan(
        result.text.indexOf("Replacement Programs"),
      );
    }
  });
});
