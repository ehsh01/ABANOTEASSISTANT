import { describe, expect, it, vi } from "vitest";
import {
  buildLockedClosingParagraph,
  buildLockedOpening,
  buildNextSessionSentence,
  buildPerformanceSentence,
} from "./note-assembly";
import { assembleClinicalBodyFromNotePlan, countClinicalParagraphs } from "./note-plan-assembly";
import type { NotePlan, SessionContext } from "./note-plan-schema";
import { validateNotePlan } from "./note-plan-validation";
import { generateClinicalBodyOpenAI } from "./openai-notes";
import { criterionPercentage, scrubAssessmentNames } from "./flexible-note-input";

function context(): SessionContext {
  return {
    sessionHours: 3,
    sessionDate: "2026-07-20",
    therapySetting: "Home",
    environmentalChanges: "",
    profileBehaviors: ["Task refusal", "Physical Aggression"],
    profileInterventions: [
      "Premack Principle",
      "Response blocking",
      "Differential Reinforcement of Alternative Behavior (DRA)",
    ],
    reinforcementPreferences: ["bubbles"],
    assessmentExcerpt: "The client pushes materials away during work.",
    assessmentReferenceFileName: "assessment.pdf",
    hourlyAssignments: [
      {
        segmentIndex: 0,
        programId: 1,
        programName: "Compliance Training",
        criterionPercentage: 0,
        activityHint: null,
        behaviorHint: null,
      },
      {
        segmentIndex: 1,
        programId: 2,
        programName: "Request for Break",
        criterionPercentage: 30,
        activityHint: "table work",
        behaviorHint: "Task refusal",
      },
      {
        segmentIndex: 2,
        programId: 1,
        programName: "Compliance Training",
        criterionPercentage: 100,
        activityHint: null,
        behaviorHint: null,
      },
    ],
  };
}

function validPlan(): NotePlan {
  return {
    segments: [
      {
        segmentIndex: 0,
        paragraph:
          "The RBT presented a task. The RBT used Premack Principle. The RBT implemented Compliance Training; 0% of discrete trials met criterion.",
      },
      {
        segmentIndex: 1,
        paragraph:
          "During table work, the client pushed materials away. The RBT used Response blocking and Differential Reinforcement of Alternative Behavior (DRA). The RBT implemented Request for Break; 30% of discrete trials met criterion.",
      },
      {
        segmentIndex: 2,
        paragraph:
          "The RBT presented a second task and implemented Compliance Training; 100% of discrete trials met criterion.",
      },
    ],
  };
}

describe("flexible note contract", () => {
  it("derives the app-selected integer percentage once", () => {
    expect(criterionPercentage({ count: 10, effectiveTrials: [] })).toBe(0);
    expect(criterionPercentage({ count: 10, effectiveTrials: [1] })).toBe(10);
    expect(criterionPercentage({ count: 10, effectiveTrials: [1, 2, 3] })).toBe(30);
    expect(criterionPercentage({ count: 10, effectiveTrials: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] })).toBe(100);
  });

  it("allows repeated programs while preserving exact hourly percentages", () => {
    const plan = validPlan();
    expect(validateNotePlan(plan, context())).toEqual([]);
    const body = assembleClinicalBodyFromNotePlan(plan, context());
    expect(countClinicalParagraphs(body)).toBe(3);
    expect(body.match(/Compliance Training/g)).toHaveLength(2);
    expect(body).toContain("0%");
    expect(body).toContain("30%");
    expect(body).toContain("100%");
  });

  it("rejects missing, remapped, or wrong-percentage hourly content", () => {
    const plan = validPlan();
    plan.segments[1]!.paragraph = "The RBT implemented Time on Task; 40% of trials met criterion.";
    expect(validateNotePlan(plan, context()).map((issue) => issue.code)).toEqual([
      "PROGRAM_MISSING",
      "PERCENTAGE_MISSING",
    ]);
  });

  it("keeps model-authored behavior and multiple interventions unchanged", () => {
    const plan = validPlan();
    const paragraph = plan.segments[1]!.paragraph;
    const body = assembleClinicalBodyFromNotePlan(plan, context());
    expect(body).toContain(paragraph);
    expect(body).toContain("Response blocking and Differential Reinforcement");
  });

  it("repairs only structural program/percentage failures", async () => {
    const modelCall = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify({ segments: [{ segmentIndex: 0, paragraph: "wrong" }] }))
      .mockResolvedValueOnce(JSON.stringify(validPlan()));
    const result = await generateClinicalBodyOpenAI(context(), { modelCall });
    expect(result.repairAttempts).toBe(1);
    expect(result.notePlan).toEqual(validPlan());
    expect(modelCall).toHaveBeenCalledTimes(2);
  });

  it("scrubs client names while retaining assessment grounding", () => {
    expect(
      scrubAssessmentNames("Anthony Smith pushed materials. Anthony returned.", {
        firstName: "Anthony",
        lastName: "Smith",
      }),
    ).toBe("the client the client pushed materials. the client returned.");
  });

  it("keeps the locked opening and final sequence byte-stable", () => {
    const opening = buildLockedOpening(["Mother"], false, "Home", "Anthony");
    const closing = buildLockedClosingParagraph([]);
    const performance = buildPerformanceSentence(
      1,
      [{ totalTrials: 10, successfulTrialNumbers: [1, 2] }],
      "Anthony",
    );
    const next = buildNextSessionSentence("2026-12-10");
    expect(opening).toBe(
      "The RBT met with Anthony and Mother to implement program targets. There have been no environmental changes recently.",
    );
    expect(closing).toContain(
      'praise (e.g., "Good job," "Wow," and "Good attention to detail")',
    );
    expect(`${closing}\n\n${performance}\n\n${next}`).toMatch(
      /The session was completed as planned\.\n\nAnthony participated in session activities with inconsistent responding and required prompting across tasks\.\n\nThe next session is tentatively scheduled for 12\/10\/2026\.$/,
    );
  });
});
