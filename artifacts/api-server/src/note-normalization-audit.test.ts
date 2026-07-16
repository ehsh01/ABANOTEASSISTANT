import { describe, expect, it } from "vitest";
import {
  collapseDuplicateAdjacentWords,
  normalizeClauseAfterBy,
  normalizeClinicalBodyInterventionDetailPhrases,
  scrubAssembledNoteQcHotspots,
  scrubFirstThenProcedureLabels,
} from "./note-normalization";
import { assembleClinicalBodyFromNotePlan } from "./note-plan-assembly";
import type { NotePlan, SessionContext } from "./note-plan-schema";

describe("first-then Premack scrubbing", () => {
  it("rewrites first-then statement linking phrases into demand-before-access prose", () => {
    const input =
      'Following this intervention, the RBT used a first-then statement linking cleanup with access to the tablet.';
    const out = scrubFirstThenProcedureLabels(input);
    expect(out).not.toMatch(/first[\s\-\/]*then/i);
    expect(out).toMatch(/required cleanup before access to the tablet/i);
  });

  it("flags and rewrites first-then even when not linked to a named catalog intervention", () => {
    const body =
      "To address this behavior, the RBT implemented Premack principle. Following this intervention, the RBT used a first-then statement linking staying in the activity area with access to a spinning toy.";
    const out = normalizeClinicalBodyInterventionDetailPhrases(body, ["Premack principle"]);
    expect(out).not.toMatch(/first[\s\-\/]*then/i);
    expect(out).toContain("Premack principle");
    expect(out).toMatch(/required staying in the activity area before access to a spinning toy/i);
  });

  it("scrubs first-then from full assembled notes", () => {
    const out = scrubAssembledNoteQcHotspots(
      "Following this intervention, the RBT used a First/Then board linking waiting with access to yogurt. Playing with his tablet was available.",
    );
    expect(out).not.toMatch(/first[\s\-\/]*then/i);
    expect(out).toMatch(/Playing with the tablet/i);
  });
});

describe("clause-after-by grammar", () => {
  it("converts 'the RBT repeated…' into a gerund clause", () => {
    expect(normalizeClauseAfterBy("the RBT repeated the instruction in simple wording")).toBe(
      "repeating the instruction in simple wording.",
    );
  });

  it("converts 'the client swore…' / 'the client made…' into gerund clauses", () => {
    expect(normalizeClauseAfterBy("the client swore after the cleanup instruction")).toBe(
      "swearing after the cleanup instruction.",
    );
    expect(normalizeClauseAfterBy("the client made open-hand contact with the RBT's arm")).toBe(
      "making open-hand contact with the RBT's arm.",
    );
  });

  it("converts present-tense BIP verbs like 'sprints away'", () => {
    expect(
      normalizeClauseAfterBy("sprints away in open places without permission and without looking back at adults"),
    ).toBe(
      "sprinting away in open places without permission and without looking back at adults.",
    );
  });

  it("converts negative/stative BIP definitions instead of 'doing not initiate'", () => {
    expect(
      normalizeClauseAfterBy(
        "does not initiate the demand after 10 seconds of being delivered",
      ),
    ).toBe("not initiating the demand after 10 seconds of being delivered.");
    expect(normalizeClauseAfterBy("did not respond to the instruction")).toBe(
      "not responding to the instruction.",
    );
  });

  it("assembles manifested/replacement lines without 'by the RBT/client' subjects", () => {
    const context = {
      narrativeSegmentCount: 1,
      therapySetting: "home",
      gender: "male",
      clientAgeYears: 6,
      ageBand: "child",
      environmentalChanges: "",
      clientAssessmentTextExcerpt: "",
      assessmentReferenceFileName: null,
      reinforcementPreferences: ["tablet"],
      segments: [
        {
          segmentIndex: 0,
          acquisitionOnly: false,
          behaviorLabel: "Verbal Aggression",
          replacementLabel: "Follow instruction",
          interventionLabels: ["Premack principle"],
          activityAntecedent: null,
          behaviorTopography: "swearing after a demand",
          behaviorFunctions: ["escape"],
          trialSummary: null,
          rbtActionsOnlyOutcome: false,
        },
      ],
      planCatalogSnapshot: {
        behaviors: ["Verbal Aggression"],
        replacements: ["Follow instruction"],
        interventions: ["Premack principle"],
      },
      validationProfile: "phase-3-strict",
    } as unknown as SessionContext;

    const plan = {
      segments: [
        {
          segmentIndex: 0,
          acquisitionOnly: false,
          behaviorLabel: "Verbal Aggression",
          antecedent: "The RBT gave a cleanup instruction.",
          topography: "the client swore after the cleanup instruction",
          interventions: [
            {
              label: "Premack principle",
              application:
                "the RBT used a first-then statement linking cleanup with access to snacks",
            },
          ],
          responseToIntervention:
            "The client stopped swearing and placed toys in the bin.",
          replacementLabel: "Follow instruction",
          teachingOrPromptingSummary:
            "the RBT repeated the instruction in simple wording and pointed to the items",
          resultSummary: "The client completed the cleanup step.",
        },
      ],
    } as NotePlan;

    const body = assembleClinicalBodyFromNotePlan(plan, context);
    expect(body).toMatch(/manifested Verbal Aggression by swearing after the cleanup instruction/i);
    expect(body).toMatch(
      /replacement program "Follow instruction" by repeating the instruction in simple wording/i,
    );
    expect(body).not.toMatch(/by the client swore/i);
    expect(body).not.toMatch(/by the RBT repeated/i);
  });
});

describe("duplicate adjacent words", () => {
  it("collapses sensory sensory toys", () => {
    expect(collapseDuplicateAdjacentWords("access to sensory sensory toys when ready")).toBe(
      "access to sensory toys when ready",
    );
  });
});
