import { describe, expect, it } from "vitest";
import {
  collapseDuplicateAdjacentWords,
  normalizeClauseAfterBy,
  normalizeClinicalBodyInterventionDetailPhrases,
  normalizeClinicalBodySentenceInitialPronouns,
  scrubAssembledNoteQcHotspots,
  scrubFirstThenProcedureLabels,
  scrubMedicationReferences,
  scrubStrayPunctuationClusters,
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

describe("medication references (out of RBT scope)", () => {
  it("drops a medication instruction clause from the antecedent (reported case)", () => {
    const out = scrubMedicationReferences(
      "the RBT presented an instruction related to taking medications after a short break with sensory toys.",
    );
    expect(out).not.toMatch(/medication/i);
    expect(out).toBe(
      "the RBT presented an instruction after a short break with sensory toys.",
    );
  });

  it("rewrites 'take/administer medication' verb phrases to a neutral task", () => {
    expect(scrubMedicationReferences("prompting the client to take his medication")).toBe(
      "prompting the client to complete the task",
    );
    expect(scrubMedicationReferences("the RBT administered the medication")).not.toMatch(
      /medicat/i,
    );
  });

  it("neutralizes medication routine/schedule and standalone nouns", () => {
    expect(scrubMedicationReferences("the medication routine was next")).toBe(
      "the scheduled task was next",
    );
    expect(scrubMedicationReferences("the pills were on the counter")).not.toMatch(/pill/i);
    expect(scrubMedicationReferences("the medicine was ready")).not.toMatch(/medicine/i);
  });

  it("does not touch 'tablet' (a reinforcer) or 'medical history'", () => {
    expect(scrubMedicationReferences("access to the tablet after the task")).toBe(
      "access to the tablet after the task",
    );
    expect(scrubMedicationReferences("no medical history changes")).toBe(
      "no medical history changes",
    );
  });

  it("removes medication references from a full assembled note", () => {
    const out = scrubAssembledNoteQcHotspots(
      "The RBT presented an instruction to take medication before the sorting task.",
    );
    expect(out).not.toMatch(/medicat|\bmeds?\b|\bpills?\b/i);
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

describe("stray punctuation clusters", () => {
  it("collapses '.,.' and ',.' artifacts to a single period (reported William note)", () => {
    expect(
      scrubStrayPunctuationClusters(
        "presented simple sound models with sensory toys available after responding.,. Additionally, the RBT implemented",
      ),
    ).toBe(
      "presented simple sound models with sensory toys available after responding. Additionally, the RBT implemented",
    );
    expect(scrubStrayPunctuationClusters("to set up requesting opportunities.,.")).toBe(
      "to set up requesting opportunities.",
    );
  });

  it("collapses '.:.' and ':.' colon/semicolon artifacts (reported William note)", () => {
    expect(
      scrubStrayPunctuationClusters(
        "presented brief readiness directions.:. Additionally, the RBT implemented",
      ),
    ).toBe("presented brief readiness directions. Additionally, the RBT implemented");
    expect(scrubStrayPunctuationClusters("before the request opportunity.:.")).toBe(
      "before the request opportunity.",
    );
    expect(scrubStrayPunctuationClusters("modeled simple sounds for imitation.;.")).toBe(
      "modeled simple sounds for imitation.",
    );
  });

  it("leaves 'e.g.', decimals, and ordinary commas intact", () => {
    expect(scrubStrayPunctuationClusters('praise (e.g., "Good job")')).toBe(
      'praise (e.g., "Good job")',
    );
    expect(scrubStrayPunctuationClusters("more than 2.5 feet, then stopped")).toBe(
      "more than 2.5 feet, then stopped",
    );
  });

  it("removes stray clusters from a full assembled note", () => {
    const out = scrubAssembledNoteQcHotspots(
      "The RBT set up materials near the table.,. The RBT implemented the replacement program.",
    );
    expect(out).not.toMatch(/\.\s*,\s*\./);
  });
});

describe("sentence-initial client pronouns", () => {
  it("rewrites sentence-initial He/She to 'The client'", () => {
    expect(
      normalizeClinicalBodySentenceInitialPronouns(
        "He accepted praise and briefly handled a sensory toy. She placed both hands on the table.",
      ),
    ).toBe(
      "The client accepted praise and briefly handled a sensory toy. The client placed both hands on the table.",
    );
  });

  it("rewrites a paragraph-initial pronoun", () => {
    expect(
      normalizeClinicalBodySentenceInitialPronouns(
        "The RBT prompted the client.\n\nHe placed one item into the bin.",
      ),
    ).toBe("The RBT prompted the client.\n\nThe client placed one item into the bin.");
  });

  it("leaves mid-sentence pronouns and possessives intact", () => {
    expect(
      normalizeClinicalBodySentenceInitialPronouns(
        "The client lowered his hand and he touched the materials.",
      ),
    ).toBe("The client lowered his hand and he touched the materials.");
  });

  it("does not convert plural 'They' (may refer to objects)", () => {
    expect(
      normalizeClinicalBodySentenceInitialPronouns("The materials were ready. They were within reach."),
    ).toBe("The materials were ready. They were within reach.");
  });

  it("applies within a full assembled note", () => {
    const out = scrubAssembledNoteQcHotspots(
      "The RBT implemented the replacement program. He took the snack from the table.",
    );
    expect(out).toContain("The client took the snack from the table.");
    expect(out).not.toMatch(/\.\s+He\b/);
  });
});

describe("duplicate adjacent words", () => {
  it("collapses sensory sensory toys", () => {
    expect(collapseDuplicateAdjacentWords("access to sensory sensory toys when ready")).toBe(
      "access to sensory toys when ready",
    );
  });
});
