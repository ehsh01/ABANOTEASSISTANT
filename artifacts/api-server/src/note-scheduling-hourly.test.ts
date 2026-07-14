import { describe, expect, test } from "vitest";
import {
  collapseHourlyNoteNarrativeToSegments,
  replacementProgramSlotCount,
  replacementProgramSlotHours,
  replacementProgramSlotIdForHour,
} from "./note-scheduling";

describe("one narrative segment per billable hour", () => {
  test.each([1, 2, 3, 4, 5, 6])("keeps all assignments and trials for %i hour(s)", (sessionHours) => {
    const behaviors = Array.from({ length: sessionHours }, (_, h) => `Behavior ${h + 1}`);
    const programs = Array.from({ length: sessionHours }, (_, h) => `Program ${h + 1}`);
    const rbtOnly = Array.from({ length: sessionHours }, (_, h) => h % 2 === 0);
    const activities = Array.from({ length: sessionHours }, (_, h) => `Activity ${h + 1}`);
    const language = Array.from({ length: sessionHours }, (_, h) => h % 2 === 1);
    const trials = Array.from({ length: sessionHours }, (_, h) => ({
      totalTrials: h + 1,
      successfulTrialNumbers: [1],
    }));

    const result = collapseHourlyNoteNarrativeToSegments({
      sessionHours,
      maladaptiveBehaviorForHour: behaviors,
      replacementProgramForHour: programs,
      rbtActionsOnlyOutcomeForHour: rbtOnly,
      activityAntecedentForHour: activities,
      languageMaladaptiveEpisodeForHour: language,
      therapistTrialSummaryForReplacementHour: trials,
    });

    expect(result.narrativeSegmentCount).toBe(sessionHours);
    expect(result.maladaptiveBehaviorForHour).toEqual(behaviors);
    expect(result.replacementProgramForHour).toEqual(programs);
    expect(result.rbtActionsOnlyOutcomeForHour).toEqual(rbtOnly);
    expect(result.activityAntecedentForHour).toEqual(activities);
    expect(result.languageMaladaptiveEpisodeForHour).toEqual(language);
    expect(result.therapistTrialSummaryForReplacementHour).toEqual(trials);
    expect(replacementProgramSlotCount(sessionHours)).toBe(sessionHours);
    for (let h = 0; h < sessionHours; h++) {
      expect(replacementProgramSlotIdForHour(sessionHours, h)).toBe(h);
      expect(replacementProgramSlotHours(sessionHours, h)).toEqual([h]);
    }
  });
});
