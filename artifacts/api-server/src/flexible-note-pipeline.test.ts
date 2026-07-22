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
    profileBehaviorTargets: [
      { name: "Task refusal", topography: "pushing work materials away" },
      { name: "Physical Aggression", topography: "hitting with an open hand" },
    ],
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
        behaviorLabel: "Physical Aggression",
        interventionLabels: ["Differential Reinforcement of Alternative Behavior (DRA)"],
        paragraph:
          "The RBT presented a task and the client manifested Physical Aggression by hitting with an open hand. The RBT implemented Differential Reinforcement of Alternative Behavior (DRA). Following this intervention, the RBT reinforced hands remaining on the table. The RBT implemented the replacement program Compliance Training; 0% of discrete trials met criterion.",
      },
      {
        segmentIndex: 1,
        behaviorLabel: "Task refusal",
        interventionLabels: [
          "Response blocking",
          "Differential Reinforcement of Alternative Behavior (DRA)",
        ],
        paragraph:
          "During table work, the client manifested Task refusal by pushing materials away. The RBT implemented Response blocking. Following this intervention, the RBT prevented additional contact with the materials. The RBT implemented Differential Reinforcement of Alternative Behavior (DRA). Following this intervention, the RBT reinforced keeping materials on the table. The RBT implemented the replacement program Request for Break; 30% of discrete trials met criterion.",
      },
      {
        segmentIndex: 2,
        behaviorLabel: "Task refusal",
        interventionLabels: ["Premack Principle"],
        paragraph:
          "The RBT presented a second task and the client manifested Task refusal by pushing materials away. The RBT implemented Premack Principle. Following this intervention, the RBT presented one task step before preferred-item access. The RBT implemented the replacement program Compliance Training; 100% of discrete trials met criterion.",
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
    plan.segments[1]!.paragraph = plan.segments[1]!.paragraph
      .replace("Request for Break", "Time on Task")
      .replace("30%", "40%");
    const codes = validateNotePlan(plan, context()).map((issue) => issue.code);
    expect(codes).toContain("PROGRAM_MISSING");
    expect(codes).toContain("PERCENTAGE_MISSING");
  });

  it("keeps model-authored behavior and multiple interventions unchanged", () => {
    const plan = validPlan();
    const paragraph = plan.segments[1]!.paragraph;
    const body = assembleClinicalBodyFromNotePlan(plan, context());
    expect(body).toContain(paragraph);
    expect(body).toContain("The RBT implemented Response blocking.");
    expect(body).toContain(
      "The RBT implemented Differential Reinforcement of Alternative Behavior (DRA).",
    );
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

  it("reports Austin-style unapproved, renamed, and mentalistic prose as advisories", () => {
    const plan = validPlan();
    plan.segments[1] = {
      ...plan.segments[1]!,
      interventionLabels: ["Errorless teaching", "redirection"],
      paragraph: plan.segments[1]!.paragraph
        .replace(
          "The RBT implemented Response blocking.",
          "The RBT applied Errorless teaching with minimal frustration and used redirection to continue.",
        )
        .replace(
          "The RBT implemented Differential Reinforcement of Alternative Behavior (DRA).",
          "",
        ),
    };
    const codes = validateNotePlan(plan, context()).map((issue) => issue.code);
    expect(codes).toContain("INTERVENTION_NOT_APPROVED");
    expect(codes).toContain("MENTALISTIC_LANGUAGE");
    expect(validateNotePlan(plan, context()).every((issue) => issue.severity === "advisory")).toBe(
      true,
    );
  });

  it("allows ordinary application details and the phrase used picture cards", () => {
    const plan = validPlan();
    plan.segments[2]!.paragraph = plan.segments[2]!.paragraph.replace(
      "Following this intervention, the RBT presented one task step before preferred-item access.",
      "Following this intervention, the RBT used picture cards to represent each activity, arranged accessible materials, and delivered a verbal cue.",
    );
    expect(validateNotePlan(plan, context())).toEqual([]);
  });

  it("requires registered topography grounding and omits unsupported trends", () => {
    const plan = validPlan();
    plan.segments[1]!.paragraph = plan.segments[1]!.paragraph
      .replace("pushing materials away", "looking toward the window")
      .replace("During table work", "Compared with the previous session, during table work");
    const codes = validateNotePlan(plan, context()).map((issue) => issue.code);
    expect(codes).toContain("TOPOGRAPHY_NOT_GROUNDED");
    expect(codes).toContain("UNSUPPORTED_TREND");
  });

  it("rejects vague overlap that does not identify one registered topography", () => {
    const ctx = context();
    ctx.sessionHours = 1;
    ctx.profileBehaviors = ["Repetitive Behavior"];
    ctx.profileBehaviorTargets = [
      {
        name: "Repetitive Behavior",
        topography:
          "moving around the room for more than 10 seconds, continuous movements with hands up and down or sideways, or tapping furniture with hands more than three times",
      },
    ];
    ctx.hourlyAssignments = [ctx.hourlyAssignments[0]!];
    const plan: NotePlan = {
      segments: [
        {
          segmentIndex: 0,
          behaviorLabel: "Repetitive Behavior",
          interventionLabels: ["Premack Principle"],
          paragraph:
            "At the table, the client manifested Repetitive Behavior by looking away and engaging in hand movements. The RBT implemented Premack Principle. Following this intervention, the RBT presented one step before access to a toy. The RBT implemented the replacement program Compliance Training; 0% of discrete trials met criterion.",
        },
      ],
    };

    expect(validateNotePlan(plan, ctx).map((issue) => issue.code)).toContain(
      "TOPOGRAPHY_NOT_GROUNDED",
    );

    plan.segments[0]!.paragraph = plan.segments[0]!.paragraph.replace(
      "looking away and engaging in hand movements",
      "engaging in continuous hand movements up and down",
    );
    expect(validateNotePlan(plan, ctx).map((issue) => issue.code)).not.toContain(
      "TOPOGRAPHY_NOT_GROUNDED",
    );
  });

  it("rejects off-property therapy settings and medication content", () => {
    const plan = validPlan();
    plan.segments[0]!.paragraph = plan.segments[0]!.paragraph
      .replace("The RBT presented a task", "In the street area, the RBT presented a task")
      .replace(
        "Following this intervention,",
        "The RBT suggested medication before continuing. Following this intervention,",
      );

    const codes = validateNotePlan(plan, context()).map((issue) => issue.code);
    expect(codes).toContain("SETTING_OUTSIDE_HOME");
    expect(codes).toContain("MEDICATION_CONTENT");
  });

  it("uses a final constrained-AI fallback after bounded repairs", async () => {
    const invalid = JSON.stringify({
      segments: [
        {
          segmentIndex: 0,
          behaviorLabel: "Task refusal",
          interventionLabels: ["Errorless teaching"],
          paragraph: "The RBT applied Errorless teaching with minimal frustration.",
        },
      ],
    });
    const modelCall = vi
      .fn()
      .mockResolvedValueOnce(invalid)
      .mockResolvedValueOnce(invalid)
      .mockResolvedValueOnce(invalid)
      .mockResolvedValueOnce(JSON.stringify(validPlan()));
    const result = await generateClinicalBodyOpenAI(context(), { modelCall });
    expect(result.repairAttempts).toBe(3);
    expect(result.repairActions).toContain("Started final constrained-AI fallback.");
    expect(modelCall).toHaveBeenCalledTimes(4);
  });

  it("saves structurally valid output with residual advisories after bounded repair", async () => {
    const advisoryPlan = validPlan();
    advisoryPlan.segments[1]!.paragraph = advisoryPlan.segments[1]!.paragraph.replace(
      "pushing materials away",
      "appearing frustrated and looking toward the window",
    );
    const originalFirstHour = advisoryPlan.segments[0]!.paragraph;
    const modelCall = vi.fn().mockImplementation(({ attempt }: { attempt: number }) => {
      const next = structuredClone(advisoryPlan);
      if (attempt > 0) {
        next.segments[0]!.paragraph = "The model incorrectly rewrote a valid hour.";
      }
      return Promise.resolve(JSON.stringify(next));
    });

    const result = await generateClinicalBodyOpenAI(context(), { modelCall });

    expect(modelCall).toHaveBeenCalledTimes(4);
    expect(result.body).toContain("appearing frustrated");
    expect(result.notePlan.segments[0]!.paragraph).toBe(originalFirstHour);
    expect(result.finalPlanIssues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["MENTALISTIC_LANGUAGE", "TOPOGRAPHY_NOT_GROUNDED"]),
    );
    expect(result.warnings).toEqual([]);
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
