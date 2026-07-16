import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards that the accuracy normalizers (implemented + unit-tested in note-normalization.ts) are
 * actually wired into the production scrub chain in notes-service.ts. They previously existed but
 * were never invoked on the real generation path, so noncompliant labels slipped into saved notes.
 */
describe("notes-service scrub chain wiring", () => {
  const source = readFileSync(join(__dirname, "notes-service.ts"), "utf8");

  const wiredNormalizers = [
    "normalizeClinicalBodyEscapedQuotes",
    "normalizeClinicalBodyInterventionLabels",
    "normalizeClinicalBodyMaladaptiveBehaviorLabels",
    "normalizeClinicalBodyReplacementLikePhrases",
  ];

  for (const fn of wiredNormalizers) {
    it(`invokes ${fn} on the assembled clinical body via applyBodyRewrite`, () => {
      expect(source).toContain(`import {`);
      // Imported from note-normalization.
      expect(source).toMatch(new RegExp(`\\b${fn}\\b[\\s\\S]*from "./note-normalization"`));
      // Called on finalClinicalBody inside an applyBodyRewrite(...) rewrite.
      expect(source).toMatch(new RegExp(`${fn}\\(\\s*\\n?\\s*finalClinicalBody`));
    });
  }
});
